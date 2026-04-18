"""
Table reconstruction and normalization utilities.

Provides layered fallback helpers to coerce financial statement outputs into a
unified table schema:
- Detect table-like text blocks
- Reconstruct rows/columns from text alignment and numeric clusters
- Normalize values and headers
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from src.pdf.loader import PDFLoader
from src.pdf.table_extractor import TableExtractor


YEAR_HEADER_RE = re.compile(r"\b(19|20)\d{2}\b")
NUMBER_RE = re.compile(r"\(?-?\d[\d,]*(?:\.\d+)?\)?")


@dataclass
class TableShape:
    headers: List[str]
    rows: List[List[Any]]


def normalize_numeric(value: Any) -> Any:
    """Parse numeric strings while preserving non-numeric text."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return value

    text = str(value).strip()
    if text == "":
        return None

    low = text.lower()
    if low in {"-", "--", "—", "–", "n/a", "na", "nil", "none", "null"}:
        return None

    is_negative = text.startswith("(") and text.endswith(")")
    cleaned = text.replace("(", "").replace(")", "").replace(",", "")

    if not re.fullmatch(r"-?\d+(?:\.\d+)?", cleaned):
        return value

    num = float(cleaned)
    if is_negative:
        num = -abs(num)

    if num.is_integer():
        return int(num)
    return num


def _coerce_row_values(row: Sequence[Any]) -> List[Any]:
    return [normalize_numeric(v) for v in row]


def _drop_empty_rows(rows: Iterable[Sequence[Any]]) -> List[List[Any]]:
    out: List[List[Any]] = []
    for row in rows:
        values = [None if (v is None or str(v).strip() == "") else v for v in row]
        if any(v is not None for v in values):
            out.append(list(row))
    return out


def _dedupe_headers(headers: Sequence[Any]) -> List[str]:
    normalized = [str(h).strip() if h is not None else "" for h in headers]
    out: List[str] = []
    for idx, h in enumerate(normalized):
        if not h:
            h = f"Column{idx + 1}"
        if out and h == out[-1]:
            h = f"{h}_{idx + 1}"
        out.append(h)
    return out


def normalize_table(headers: Sequence[Any], rows: Sequence[Sequence[Any]]) -> Dict[str, Any]:
    """Normalize table shape and add row/column counts."""
    clean_rows = _drop_empty_rows(rows)
    coerced_rows = [_coerce_row_values(r) for r in clean_rows]

    # Ensure rectangular rows.
    width = max(len(headers), max((len(r) for r in coerced_rows), default=0))
    if width == 0:
        width = len(headers) if headers else 1

    normalized_headers = _dedupe_headers(list(headers) + [""] * max(0, width - len(headers)))
    normalized_rows = [list(r) + [None] * (width - len(r)) for r in coerced_rows]

    return {
        "headers": normalized_headers,
        "rows": normalized_rows,
        "row_count": len(normalized_rows),
        "column_count": width,
    }


def detect_table_lines(lines: Sequence[str], min_rows: int = 2) -> Tuple[bool, List[str]]:
    """
    Detect likely table rows using repeating numeric columns and spacing patterns.
    """
    candidates: List[str] = []
    numeric_count_hist: Dict[int, int] = {}

    for line in lines:
        text = line.strip()
        if not text:
            continue
        nums = NUMBER_RE.findall(text)
        if len(nums) < 2:
            continue
        numeric_count_hist[len(nums)] = numeric_count_hist.get(len(nums), 0) + 1
        candidates.append(text)

    if not candidates:
        return False, []

    common_numeric_cols = max(numeric_count_hist, key=numeric_count_hist.get)
    stable_lines = [ln for ln in candidates if len(NUMBER_RE.findall(ln)) == common_numeric_cols]

    is_table = len(stable_lines) >= min_rows
    return is_table, stable_lines


def _split_line_to_row(line: str, expected_numeric_cols: int) -> Optional[List[str]]:
    nums = NUMBER_RE.findall(line)
    if len(nums) < expected_numeric_cols:
        return None

    # Use right-most numeric clusters as value columns.
    vals = nums[-expected_numeric_cols:]
    # Remove only the last matched value chunks to keep the full label text.
    label = line
    for value in reversed(vals):
        idx = label.rfind(value)
        if idx >= 0:
            label = label[:idx].rstrip()
    label = re.sub(r"\s{2,}", " ", label).strip()
    if not label:
        label = "Item"

    return [label, *vals]


def reconstruct_table_from_text_block(text: str, default_header_prefix: str = "Year") -> Optional[TableShape]:
    """Reconstruct a structured table from plain text lines."""
    if not text or not text.strip():
        return None

    lines = [ln.rstrip() for ln in text.splitlines() if ln.strip()]
    is_table, table_lines = detect_table_lines(lines, min_rows=2)
    if not is_table:
        return None

    numeric_counts = [len(NUMBER_RE.findall(ln)) for ln in table_lines]
    expected_numeric_cols = max(set(numeric_counts), key=numeric_counts.count)

    header_candidates = [ln for ln in lines[:6] if YEAR_HEADER_RE.search(ln)]
    year_tokens: List[str] = []
    for cand in header_candidates:
        years = YEAR_HEADER_RE.findall(cand)
        if len(years) >= expected_numeric_cols:
            year_tokens = re.findall(r"\b(?:19|20)\d{2}\b", cand)
            break

    if year_tokens and len(year_tokens) >= expected_numeric_cols:
        headers = ["Item", *year_tokens[-expected_numeric_cols:]]
    else:
        headers = ["Item", *[f"{default_header_prefix}{i + 1}" for i in range(expected_numeric_cols)]]

    rows: List[List[str]] = []
    for ln in table_lines:
        row = _split_line_to_row(ln, expected_numeric_cols)
        if row:
            rows.append(row)

    if len(rows) < 2:
        return None

    return TableShape(headers=headers, rows=rows)


def extract_table_from_pdf_layers(pdf_path: str, section_keywords: Sequence[str], max_pages: int = 50) -> Optional[TableShape]:
    """
    Layered extraction order:
    1) Camelot / Tabula (if available)
    2) Layout tables via existing pdfplumber TableExtractor
    3) Text reconstruction fallback
    """
    loader = PDFLoader(pdf_path)
    table_extractor = TableExtractor({"method": "pdfplumber"})

    page_hits = set()
    for kw in section_keywords:
        for hit in loader.search_text(kw, case_sensitive=False):
            page_hits.add(hit["page"])

    if not page_hits:
        page_hits = set(range(min(max_pages, max(loader.get_pdf_info().get("total_pages", 0), 0))))

    candidate_pages = sorted(page_hits)[:max_pages]

    # Layer 1: Camelot / Tabula (optional dependencies).
    try:
        import camelot  # type: ignore

        pages_arg = ",".join(str(p + 1) for p in candidate_pages[:10])
        for flavor in ("lattice", "stream"):
            tables = camelot.read_pdf(pdf_path, pages=pages_arg, flavor=flavor)
            if tables and len(tables) > 0:
                df = tables[0].df
                if not df.empty and df.shape[1] >= 2:
                    headers = list(df.iloc[0].fillna("").astype(str))
                    rows = df.iloc[1:].fillna("").values.tolist()
                    return TableShape(headers=headers, rows=rows)
    except Exception:
        pass

    try:
        import tabula  # type: ignore

        dfs = tabula.read_pdf(pdf_path, pages=[p + 1 for p in candidate_pages[:10]], multiple_tables=True)
        for df in dfs or []:
            if getattr(df, "empty", True):
                continue
            if df.shape[1] < 2:
                continue
            headers = [str(h) for h in list(df.columns)]
            rows = df.fillna("").values.tolist()
            return TableShape(headers=headers, rows=rows)
    except Exception:
        pass

    # Layer 2: layout-based extraction via pdfplumber table extractor.
    page_tables = table_extractor.extract_tables_from_pages(pdf_path, candidate_pages[:15])
    for _page, tables in page_tables.items():
        for df in tables:
            if df is None or getattr(df, "empty", True):
                continue
            if df.shape[1] < 2:
                continue
            rows = df.fillna("").values.tolist()
            headers = [f"Column{i + 1}" for i in range(df.shape[1])]
            return TableShape(headers=headers, rows=rows)

    # Layer 3: text reconstruction.
    for page in candidate_pages[:20]:
        page_text = loader.extract_text_pdfplumber(page)
        shape = reconstruct_table_from_text_block(page_text)
        if shape:
            return shape

    return None


def extract_plain_text_blob(data: Any) -> str:
    """Best-effort extraction of plain text blocks from mixed section payloads."""
    if data is None:
        return ""

    if isinstance(data, str):
        return data

    if isinstance(data, list):
        parts = [extract_plain_text_blob(item) for item in data]
        return "\n".join([p for p in parts if p])

    if isinstance(data, dict):
        chunks: List[str] = []
        for key in ("text", "content", "summary", "raw_text"):
            val = data.get(key)
            if isinstance(val, str) and val.strip():
                chunks.append(val)

        paragraphs = data.get("paragraphs")
        if isinstance(paragraphs, list):
            chunks.extend(str(p) for p in paragraphs if str(p).strip())

        rows = data.get("rows")
        if isinstance(rows, list) and rows and isinstance(rows[0], str):
            chunks.extend(rows)

        subsections = data.get("subsections")
        if isinstance(subsections, list):
            for subsection in subsections:
                text = extract_plain_text_blob(subsection)
                if text:
                    chunks.append(text)

        return "\n".join(chunks)

    return str(data)
