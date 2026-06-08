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

from .llm_extractor import LLMFinancialExtractor

logger = logging.getLogger(__name__)

_TOC_MARKERS = ["contents", "table of contents", "Contents"]

_STATEMENT_KEYWORDS: Dict[str, List[str]] = {
    "income_statement": [
        "statement of income",  
        "income statement",
        "statement of profit or loss",
        "Statement of profit or loss",
        "statement of profit or loss and other comprehensive income",
        "profit or loss",
        "profit and loss",
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
        "Statement of Profit or Loss and Other Comprehensive Income"
    ],
}

_TOC_LINE_REJECT = ["usd", "us$", "$", "USD"]

_EXTRACTOR = LLMFinancialExtractor()


def extract_statement_from_images(images_list: List[bytes]) -> dict:
    """
    Call the LLM extractor with multiple page images.
    """
    if not images_list:
        raise ValueError("images_list is empty")

    tmp_paths = []
    try:
        for image_bytes in images_list:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_file:
                tmp_file.write(image_bytes)
                tmp_paths.append(tmp_file.name)
        return _EXTRACTOR.extract_from_images(tmp_paths)
    finally:
        for tmp_path in tmp_paths:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    logger.warning("Failed to remove temp image: %s", tmp_path)


def extract_statement_from_image(image_bytes: bytes) -> dict:
    """
    Wrapper around extract_statement_from_images for compatibility.
    """
    return extract_statement_from_images([image_bytes])


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
        toc_page_indices = _find_toc_page(pdf)
        # Anchor y/x to the first TOC page (offset is constant across the document)
        toc_index = toc_page_indices[0]
        first_toc_text = pdf.pages[toc_index - 1].extract_text() or ""

        # Concatenate text from ALL detected TOC pages for complete regex coverage
        toc_text = ""
        for page_num in toc_page_indices:
            text = pdf.pages[page_num - 1].extract_text() or ""
            toc_text += "\n" + text

        printed_page = _extract_printed_page_number(first_toc_text)
        statement_refs = _parse_statement_references(toc_text)

        logger.info("PDF %s TOC pages detected: %s", pdf_name, toc_page_indices)
        logger.info("PDF %s TOC anchor y=%s, printed page x=%s", pdf_name, toc_index, printed_page)

        total_pages = len(pdf.pages)
        statement_pages = _resolve_statement_pages(
            pdf,
            toc_index,
            printed_page,
            statement_refs,
            total_pages,
            pdf_name,
        )

        statement_texts: Dict[str, str] = {}
        for key, page_indices in statement_pages.items():
            combined_text = ""
            for page_idx in page_indices:
                if page_idx and 1 <= page_idx <= total_pages:
                    combined_text += f"\n--- Page {page_idx} ---\n" + (pdf.pages[page_idx - 1].extract_text() or "")
            statement_texts[key] = combined_text

    statement_images = _render_statement_images(pdf_bytes, statement_pages, pdf_name)
    extracted = _extract_statements_parallel(statement_images, statement_texts, pdf_name)

    return {
        "pdf_name": pdf_name,
        "statement_pages": statement_pages,
        "statements": extracted,
    }


def _find_toc_page(pdf: pdfplumber.PDF) -> list[int]:
    """
    Detect ALL consecutive TOC pages at the beginning of the report.

    Behaviour:
    - Find first page containing TOC markers.
    - Continue scanning forward while pages still look like TOC pages.
    - Stops automatically when normal content begins.
    - Returns 1-based page numbers.
    """

    def _looks_like_toc_continuation(text: str) -> bool:
        import re
        if not text:
            return False

        t = text.lower()

        # Still contains TOC keywords
        if any(m in t for m in _TOC_MARKERS):
            return True

        # Many dotted leader patterns → strong TOC signal
        dotted_lines = len(re.findall(r"\.{3,}", text))

        # Many short lines ending with numbers → section listings
        numbered_lines = len(re.findall(r".+\s\d{1,4}\s*$", text, re.MULTILINE))

        # Heuristic threshold tuned to avoid false positives
        return dotted_lines >= 5 or numbered_lines >= 8

    max_scan = min(20, len(pdf.pages))
    toc_pages = []

    # Step 1 — find first TOC page
    start_idx = None
    for i in range(max_scan):
        text = pdf.pages[i].extract_text() or ""
        if any(marker in text.lower() for marker in _TOC_MARKERS):
            start_idx = i
            toc_pages.append(i + 1)
            break

    if start_idx is None:
        raise RuntimeError("Table of Contents page not found in first 20 pages")

    # Step 2 — detect continuation pages
    for i in range(start_idx + 1, max_scan):
        text = pdf.pages[i].extract_text() or ""
        if _looks_like_toc_continuation(text):
            toc_pages.append(i + 1)
        else:
            break

    return toc_pages

def _extract_printed_page_number(toc_text: str) -> int:
    """
    Extract the printed page number from the footer of the first TOC page.

    Common footer patterns observed:
      - "HATTON NATIONAL BANK PLC | 2 | ANNUAL REPORT 2024"
      - "2 | Annual Report 2022"
      - "3"
      - "Page 3"
      - "- 3 -"
    """
    lines = [l.strip() for l in toc_text.splitlines() if l.strip()]
    if not lines:
        raise RuntimeError("Empty TOC page")

    # Scan header (first 3) and footer (last 5) lines
    candidates = lines[:3] + lines[-5:]

    for line in reversed(candidates):
        # Pattern 1a: "TEXT | N | TEXT" (pipe-delimited footer with number in middle)
        m = re.search(r"\|\s*(\d{1,3})\s*\|", line)
        if m:
            return int(m.group(1))

        # Pattern 1b: "N | text" (number at start before pipe)
        m = re.match(r"^(\d{1,3})\s*\|", line)
        if m:
            return int(m.group(1))

        # Pattern 2: standalone number, possibly with decorators "- 3 -", "(3)"
        if re.fullmatch(r"[\(\[\-–—\s]*(\d{1,3})[\)\]\-–—\s]*", line):
            n = int(re.search(r"\d+", line).group())
            if n < 100:
                return n

        # Pattern 3: "Page N"
        m = re.match(r"(?i)page\s+(\d{1,3})", line)
        if m:
            return int(m.group(1))

    # Fallback: smallest isolated number from header/footer band
    header_footer = "\n".join(lines[:5] + lines[-5:])
    numbers = _extract_isolated_numbers(header_footer)
    small = [n for n in numbers if n < 50]
    if small:
        return min(small)

    raise RuntimeError("Printed page number not found on TOC page")


def _extract_isolated_numbers(text: str) -> List[int]:
    matches = re.findall(r"(?<!\d)(\d{1,4})(?!\d)", text)
    return [int(m) for m in matches]


def _parse_statement_references(toc_text: str) -> Dict[str, int]:
    references: Dict[str, int] = {}

    for statement_key, keywords in _STATEMENT_KEYWORDS.items():
        best_page = None
        best_pos = -1
        
        escaped_keywords = [re.escape(k) for k in keywords]
        pattern_str = r"(?i)(" + "|".join(escaped_keywords) + r")[\s\.\_]*(\d{1,4})(?!\d)"
        pattern = re.compile(pattern_str)
        
        for match in pattern.finditer(toc_text):
            pos = match.start()
            if pos > best_pos:
                best_pos = pos
                best_page = int(match.group(2))
                    
        if best_page is not None:
            references[statement_key] = best_page
            logger.info("TOC detected %s at r=%s", statement_key, best_page)

    return references


def _extract_toc_line_page_number(line: str) -> Optional[int]:
    match = re.search(r"(\d{1,4})\s*$", line)
    if match:
        return int(match.group(1))

    numbers = _extract_isolated_numbers(line)
    if numbers:
        return numbers[-1]

    return None


def _is_next_page_continuation(
    pdf: pdfplumber.PDF,
    current_page_idx: int, # 1-based index
    next_page_idx: int,    # 1-based index
    statement_key: str,
) -> bool:
    """
    Determine if next_page_idx is a continuation of the statement starting/continuing on current_page_idx.
    """
    if next_page_idx > len(pdf.pages):
        return False
        
    next_page = pdf.pages[next_page_idx - 1]
    next_text = (next_page.extract_text() or "")
    next_text_lower = next_text.lower()
    
    # 1. If the next page contains a header/title for a DIFFERENT statement, it is NOT a continuation.
    for key, keywords in _STATEMENT_KEYWORDS.items():
        if key == statement_key:
            continue
        for kw in keywords:
            if kw in next_text_lower[:500]:
                lines = [l.strip() for l in next_text[:500].splitlines() if l.strip()]
                for line in lines[:10]:
                    if kw in line.lower() and (len(line) < len(kw) + 15 or line.isupper()):
                        logger.info(f"Page {next_page_idx} starts a different statement: '{line}'")
                        return False
                        
    # 2. Check for note section headers
    note_headers = [
        "notes to the financial statements",
        "notes to the accounts",
        "accounting policies"
    ]
    if any(h in next_text_lower[:400] for h in note_headers):
        return False
        
    # 3. Check table/numeric characteristics
    numbers = re.findall(r'[\d,]{3,}', next_text)
    if len(numbers) < 5:
        return False
        
    # 4. Check for key statement components
    statement_context_words = {
        "income_statement": ["revenue", "profit", "loss", "expense", "tax", "earnings", "operating", "finance"],
        "balance_sheet": ["liabilities", "equity", "assets", "payable", "borrowings", "capital", "reserves", "provisions"],
        "cash_flow": ["cash", "flow", "operating", "investing", "financing", "activities", "interest", "receipts"],
        "equity": ["equity", "stated capital", "reserves", "retained earnings", "balance", "changes"],
        "comprehensive_income": ["comprehensive", "income", "profit", "loss", "foci", "other comprehensive"]
    }
    
    context_words = statement_context_words.get(statement_key, [])
    matches = sum(1 for w in context_words if w in next_text_lower)
    if matches < 1:
        return False
        
    # 5. Check if it repeats the column headers or contains table structures
    has_headers = any(w in next_text_lower[:500] for w in ["consolidated", "company", "bank", "group"])
    has_currency = any(w in next_text_lower[:500] for w in ["rs.", "lkr", "usd", "rs '000", "rs. '000"])
    
    if not (has_headers or has_currency):
        return False
        
    logger.info(f"Page {next_page_idx} identified as continuation of {statement_key}")
    return True


def _resolve_statement_pages(
    pdf: pdfplumber.PDF,
    toc_index: int,
    printed_page: int,
    references: Dict[str, int],
    total_pages: int,
    pdf_name: str,
) -> Dict[str, List[int]]:
    resolved: Dict[str, List[int]] = {
        "income_statement": [],
        "balance_sheet": [],
        "cash_flow": [],
        "equity": [],
        "comprehensive_income": [],
    }

    for statement_key in resolved.keys():
        resolved_page = None
        if statement_key in references:
            toc_page = references[statement_key]
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
            logger.warning("PDF %s could not validate %s via TOC equation. Attempting direct scan fallback...", pdf_name, statement_key)
            resolved_page = _direct_scan_for_statement(pdf, statement_key, total_pages)
            if resolved_page:
                logger.info("PDF %s found %s via direct scan at page %s", pdf_name, statement_key, resolved_page)
            else:
                logger.error("PDF %s completely failed to find %s", pdf_name, statement_key)
                
        if resolved_page:
            resolved[statement_key].append(resolved_page)
            
            # Scan ahead for continuation pages
            current_page = resolved_page
            max_scan = 3
            for offset in range(1, max_scan + 1):
                next_page = current_page + offset
                if _is_next_page_continuation(pdf, current_page, next_page, statement_key):
                    resolved[statement_key].append(next_page)
                    current_page = next_page
                else:
                    break

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


def _direct_scan_for_statement(pdf: pdfplumber.PDF, statement_key: str, total_pages: int) -> Optional[int]:
    keywords = _STATEMENT_KEYWORDS.get(statement_key, [])
    if not keywords:
        return None
        
    start_page = max(1, min(50, total_pages // 4))
    
    for page_idx in range(start_page, total_pages + 1):
        text = pdf.pages[page_idx - 1].extract_text() or ""
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        
        # Scan headers in the first few lines of the page
        for line in lines[:15]:
            for keyword in keywords:
                expected_header = keyword.upper()
                if expected_header in line and len(line) < len(expected_header) + 20 and line.isupper():
                    return page_idx
                if line.lower() == keyword.lower():
                    return page_idx
                    
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
    statement_pages: Dict[str, List[int]],
    pdf_name: str,
) -> Dict[str, List[bytes]]:
    poppler_path = _get_poppler_path()
    rendered: Dict[str, List[bytes]] = {}

    # Gather all tasks to render pages in parallel
    render_tasks = []
    for key, pages in statement_pages.items():
        for page_index in pages:
            render_tasks.append((key, page_index))

    if not render_tasks:
        return rendered

    max_workers = min(8, len(render_tasks))
    temp_rendered = {} # (key, page_index) -> bytes
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(_render_page_png, pdf_bytes, page_index, poppler_path): (key, page_index)
            for key, page_index in render_tasks
        }
        for future in as_completed(future_map):
            key, page_index = future_map[future]
            try:
                temp_rendered[(key, page_index)] = future.result()
                logger.info("PDF %s screenshot success for %s page %s", pdf_name, key, page_index)
            except Exception as exc:
                logger.error(
                    "PDF %s screenshot failed for %s page %s: %s",
                    pdf_name,
                    key,
                    page_index,
                    exc,
                )

    # Reconstruct the list of images per statement key in the correct order
    for key, pages in statement_pages.items():
        images_list = []
        for page_index in pages:
            if (key, page_index) in temp_rendered:
                images_list.append(temp_rendered[(key, page_index)])
        if images_list:
            rendered[key] = images_list

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


def _detect_scale_multiplier(page_text: str) -> int:
    if not page_text:
        return 1
    text = page_text.lower()
    
    # Check billions first
    if any(pattern in text for pattern in ["rs. bn", "rs.bn", "rs bn", "lkr. bn", "lkr.bn", "lkr bn", "in billions", "'000,000,000"]):
        return 1_000_000_000
    if re.search(r"\b(bn|billion|billions)\b", text):
        return 1_000_000_000
        
    # Check millions
    if any(pattern in text for pattern in ["rs. mn", "rs.mn", "rs mn", "lkr. mn", "lkr.mn", "lkr mn", "in millions", "'000,000"]):
        return 1_000_000
    if re.search(r"\b(mn|million|millions)\b", text):
        return 1_000_000
        
    # Check thousands
    if any(pattern in text for pattern in [
        "rs. '000", "rs.'000", "rs 000", "rs. 000", 
        "lkr. '000", "lkr.'000", "lkr 000", "lkr. 000", 
        "lkr '000", "lkr 000", 
        "(000)", "in thousands", "'000"
    ]):
        return 1_000
    if re.search(r"\b(thousand|thousands)\b", text):
        return 1_000
        
    return 1

def _apply_multiplier(data: Any, multiplier: int) -> Any:
    if multiplier == 1:
        return data
        
    def is_ratio_or_percentage_key(key: str) -> bool:
        if not key:
            return False
        k_low = key.lower()
        return any(term in k_low for term in ["ratio", "margin", "percent", "eps", "growth", "yoy", "yield", "rate", "interest_rate"])

    def multiply_value(val, key: str = ""):
        if is_ratio_or_percentage_key(key):
            return val
            
        if isinstance(val, (int, float)):
            # Don't multiply small ratio/percentage values like 4.50, 5.50
            if abs(val) < 100.0:
                return val
            return val * multiplier
        elif isinstance(val, str):
            clean_str = val.strip()
            # If it has a percent sign, it's a percentage
            if clean_str.endswith('%'):
                return val
            # Very basic check for numeric strings with commas and optional parens
            if re.fullmatch(r"\(?-?\d[\d,]*(\.\d+)?\)?", clean_str):
                is_negative = False
                if clean_str.startswith('(') and clean_str.endswith(')'):
                    is_negative = True
                    clean_str = clean_str[1:-1]
                clean_str = clean_str.replace(',', '')
                try:
                    num_val = float(clean_str)
                    if is_negative:
                        num_val = -num_val
                    # Don't multiply if it's a small ratio/percentage value
                    if abs(num_val) < 100.0:
                        return num_val if not is_negative else -num_val
                    ans = num_val * multiplier
                    if ans.is_integer():
                        return int(ans)
                    return ans
                except ValueError:
                    pass
        return val

    if isinstance(data, dict):
        for k, v in data.items():
            if isinstance(v, dict):
                data[k] = _apply_multiplier(v.copy(), multiplier)
            elif isinstance(v, list):
                new_list = []
                for item in v:
                    if isinstance(item, dict):
                        new_list.append(_apply_multiplier(item.copy(), multiplier))
                    else:
                        new_list.append(multiply_value(item))
                data[k] = new_list
            else:
                data[k] = multiply_value(v)
    elif isinstance(data, list):
        new_list = []
        for item in data:
            if isinstance(item, dict):
                new_list.append(_apply_multiplier(item.copy(), multiplier))
            elif isinstance(item, list):
                new_list.append(_apply_multiplier(item, multiplier))
            else:
                new_list.append(multiply_value(item))
        return new_list
            
    return data



def _extract_statements_parallel(
    statement_images: Dict[str, List[bytes]],
    statement_texts: Dict[str, str],
    pdf_name: str
) -> Dict[str, Optional[dict]]:
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
            executor.submit(extract_statement_from_images, images_list): statement_key
            for statement_key, images_list in statement_images.items()
        }
        for future in as_completed(future_map):
            statement_key = future_map[future]
            try:
                result_data = future.result()
                if result_data:
                    # Apply multiplier based on detected scale from actual page text
                    multiplier = _detect_scale_multiplier(statement_texts.get(statement_key, ""))
                    if multiplier != 1:
                        logger.info(f"Applying scale multiplier {multiplier} to {statement_key} for {pdf_name}")
                        result_data = _apply_multiplier(result_data, multiplier)
                
                extracted[statement_key] = result_data
                logger.info("PDF %s extraction success for %s", pdf_name, statement_key)
            except Exception as exc:
                logger.error("PDF %s extraction failed for %s: %s", pdf_name, statement_key, exc)
                extracted[statement_key] = None

    return extracted


def _get_poppler_path() -> Optional[str]:
    try:
        from services.extraction_service.config.ocr_config import POPPLER_PATH
        return POPPLER_PATH
    except ImportError:
        try:
            from config.ocr_config import POPPLER_PATH
            return POPPLER_PATH
        except ImportError:
            return None
