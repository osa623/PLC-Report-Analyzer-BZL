from __future__ import annotations

import io
import logging
import os
import re
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple

import pdfplumber
from pdf2image import convert_from_bytes

from src.pipeline.llm_extractor import LLMFinancialExtractor

logger = logging.getLogger(__name__)

_TOC_MARKERS = ["contents", "table of contents"]

_STATEMENT_KEYWORDS: Dict[str, List[str]] = {
    "income_statement": [
        "statement of profit or loss",
        "statement of profit or loss and other comprehensive income",
        "statement of profit or loss and other comprehensive",
    ],
    "balance_sheet": [
        "statement of financial position",
    ],
    "cash_flow": [
        "statement of cash flows",
        "statement of cash flow",
    ],
    "equity": [
        "statement of changes in equity",
    ],
    "comprehensive_income": [
        "statement of comprehensive income",
    ],
}

_TOC_LINE_REJECT = ["usd", "us$", "$"]

_EXTRACTOR = LLMFinancialExtractor()


def extract_statement_from_image(image_bytes: bytes) -> dict:
    """
    Reuse the existing image extractor exactly as-is by calling it with a temp file.
    """
    if not image_bytes:
        raise ValueError("image_bytes is empty")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_file:
            tmp_file.write(image_bytes)
            tmp_path = tmp_file.name
        return _EXTRACTOR.extract_from_image(tmp_path)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                logger.warning("Failed to remove temp image: %s", tmp_path)


def process_annual_reports(pdf_files: List[bytes]) -> List[dict]:
    """
    Process up to 5 PDF files sequentially and return per-PDF extraction results.
    """
    if len(pdf_files) > 5:
        raise ValueError("Maximum PDF files exceeded (max 5)")

    results: List[dict] = []
    for index, pdf_bytes in enumerate(pdf_files, start=1):
        pdf_name = f"pdf_{index}"
        try:
            result = _process_single_pdf(pdf_bytes, pdf_name)
        except Exception as exc:
            logger.error("PDF %s failed: %s", pdf_name, exc, exc_info=True)
            result = {
                "pdf_name": pdf_name,
                "error": str(exc),
            }
        results.append(result)

    return results


def _process_single_pdf(pdf_bytes: bytes, pdf_name: str) -> dict:
    if not pdf_bytes:
        raise ValueError("PDF bytes are empty")

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        toc_index = _find_toc_page(pdf)
        toc_text = pdf.pages[toc_index - 1].extract_text() or ""

        printed_page = _extract_printed_page_number(toc_text)
        statement_refs = _parse_statement_references(toc_text)

        logger.info("PDF %s TOC page index y=%s", pdf_name, toc_index)
        logger.info("PDF %s printed page number x=%s", pdf_name, printed_page)

        total_pages = len(pdf.pages)
        statement_pages = _resolve_statement_pages(
            pdf,
            toc_index,
            printed_page,
            statement_refs,
            total_pages,
            pdf_name,
        )

    statement_images = _render_statement_images(pdf_bytes, statement_pages, pdf_name)
    extracted = _extract_statements_parallel(statement_images, pdf_name)

    return {
        "pdf_name": pdf_name,
        "statements": extracted,
    }


def _find_toc_page(pdf: pdfplumber.PDF) -> int:
    for page_idx in range(min(20, len(pdf.pages))):
        text = pdf.pages[page_idx].extract_text() or ""
        haystack = text.lower()
        if any(marker in haystack for marker in _TOC_MARKERS):
            return page_idx + 1
    raise RuntimeError("Table of Contents page not found in first 20 pages")


def _extract_printed_page_number(toc_text: str) -> int:
    lines = [line.strip() for line in toc_text.splitlines() if line.strip()]
    header_footer = lines[:5] + lines[-5:]
    numbers = _extract_isolated_numbers("\n".join(header_footer))

    if not numbers:
        numbers = _extract_isolated_numbers(toc_text)

    if not numbers:
        raise RuntimeError("Printed page number not found on TOC page")

    return min(numbers)


def _extract_isolated_numbers(text: str) -> List[int]:
    matches = re.findall(r"(?<!\d)(\d{1,4})(?!\d)", text)
    return [int(m) for m in matches]


def _parse_statement_references(toc_text: str) -> Dict[str, int]:
    references: Dict[str, int] = {}

    for raw_line in toc_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        lowered = line.lower()
        if any(token in lowered for token in _TOC_LINE_REJECT):
            continue

        for statement_key, keywords in _STATEMENT_KEYWORDS.items():
            if statement_key in references:
                continue
            if any(keyword in lowered for keyword in keywords):
                page_number = _extract_toc_line_page_number(line)
                if page_number is not None:
                    references[statement_key] = page_number
                    logger.info("TOC detected %s at r=%s", statement_key, page_number)
                break

    return references


def _extract_toc_line_page_number(line: str) -> Optional[int]:
    match = re.search(r"(\d{1,4})\s*$", line)
    if match:
        return int(match.group(1))

    numbers = _extract_isolated_numbers(line)
    if numbers:
        return numbers[-1]

    return None


def _resolve_statement_pages(
    pdf: pdfplumber.PDF,
    toc_index: int,
    printed_page: int,
    references: Dict[str, int],
    total_pages: int,
    pdf_name: str,
) -> Dict[str, Optional[int]]:
    resolved: Dict[str, Optional[int]] = {
        "income_statement": None,
        "balance_sheet": None,
        "cash_flow": None,
        "equity": None,
        "comprehensive_income": None,
    }

    for statement_key, toc_page in references.items():
        real_page = toc_index - printed_page + toc_page
        logger.info(
            "PDF %s computed %s real page = %s (y=%s, x=%s, r=%s)",
            pdf_name,
            statement_key,
            real_page,
            toc_index,
            printed_page,
            toc_page,
        )

        resolved_page = _validate_statement_page(pdf, real_page, statement_key, total_pages)
        if resolved_page is None:
            logger.warning("PDF %s could not validate %s", pdf_name, statement_key)
        resolved[statement_key] = resolved_page

    return resolved


def _validate_statement_page(
    pdf: pdfplumber.PDF,
    real_page: int,
    statement_key: str,
    total_pages: int,
) -> Optional[int]:
    keywords = _STATEMENT_KEYWORDS.get(statement_key, [])

    candidate = _safe_page_index(real_page, total_pages)
    if candidate and _page_has_keywords(pdf, candidate, keywords):
        return candidate

    search_min = max(1, real_page - 2)
    search_max = min(total_pages, real_page + 2)

    for page_index in range(search_min, search_max + 1):
        if _page_has_keywords(pdf, page_index, keywords):
            return page_index

    return None


def _safe_page_index(page_index: int, total_pages: int) -> Optional[int]:
    if page_index < 1 or page_index > total_pages:
        return None
    return page_index


def _page_has_keywords(pdf: pdfplumber.PDF, page_index: int, keywords: List[str]) -> bool:
    text = pdf.pages[page_index - 1].extract_text() or ""
    lowered = text.lower()
    return any(keyword in lowered for keyword in keywords)


def _render_statement_images(
    pdf_bytes: bytes,
    statement_pages: Dict[str, Optional[int]],
    pdf_name: str,
) -> Dict[str, bytes]:
    poppler_path = _get_poppler_path()
    rendered: Dict[str, bytes] = {}

    targets = {k: v for k, v in statement_pages.items() if v is not None}
    if not targets:
        return rendered

    max_workers = min(4, len(targets))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(_render_page_png, pdf_bytes, page_index, poppler_path): (key, page_index)
            for key, page_index in targets.items()
        }
        for future in as_completed(future_map):
            statement_key, page_index = future_map[future]
            try:
                rendered[statement_key] = future.result()
                logger.info("PDF %s screenshot success for %s page %s", pdf_name, statement_key, page_index)
            except Exception as exc:
                logger.error(
                    "PDF %s screenshot failed for %s page %s: %s",
                    pdf_name,
                    statement_key,
                    page_index,
                    exc,
                )

    return rendered


def _render_page_png(pdf_bytes: bytes, page_index: int, poppler_path: Optional[str]) -> bytes:
    images = convert_from_bytes(
        pdf_bytes,
        dpi=350,
        first_page=page_index,
        last_page=page_index,
        poppler_path=poppler_path,
    )
    if not images:
        raise RuntimeError("Failed to render page to image")

    image = images[0]
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def _extract_statements_parallel(statement_images: Dict[str, bytes], pdf_name: str) -> Dict[str, Optional[dict]]:
    extracted: Dict[str, Optional[dict]] = {
        "income_statement": None,
        "balance_sheet": None,
        "cash_flow": None,
        "equity": None,
        "comprehensive_income": None,
    }

    if not statement_images:
        return extracted

    max_workers = min(4, len(statement_images))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(extract_statement_from_image, image_bytes): statement_key
            for statement_key, image_bytes in statement_images.items()
        }
        for future in as_completed(future_map):
            statement_key = future_map[future]
            try:
                extracted[statement_key] = future.result()
                logger.info("PDF %s extraction success for %s", pdf_name, statement_key)
            except Exception as exc:
                logger.error("PDF %s extraction failed for %s: %s", pdf_name, statement_key, exc)
                extracted[statement_key] = None

    return extracted


def _get_poppler_path() -> Optional[str]:
    try:
        from config.ocr_config import POPPLER_PATH

        return POPPLER_PATH
    except Exception:
        return None
