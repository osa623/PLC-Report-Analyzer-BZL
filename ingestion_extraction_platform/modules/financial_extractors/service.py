from __future__ import annotations

import re
from typing import Any

ROW_PATTERN = re.compile(r"([A-Za-z][A-Za-z\s\-/&,().]{2,}?)\s+([\(\-]?[0-9][0-9,\.\)]*)")
YEAR_PATTERN = re.compile(r"(20\d{2})")


def _to_number(value: str) -> float | None:
    cleaned = value.replace(",", "").replace("(", "-").replace(")", "").strip()
    try:
        return float(cleaned)
    except Exception:
        return None


def _extract_rows(chunks: list[dict[str, Any]], statement_type: str, keywords: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for chunk in chunks:
        text = chunk.get("text", "")
        if not any(keyword in text.lower() for keyword in keywords):
            continue

        year_match = YEAR_PATTERN.search(text)
        year = year_match.group(1) if year_match else "unknown"

        for match in ROW_PATTERN.finditer(text):
            label = " ".join(match.group(1).split())
            value = _to_number(match.group(2))
            if value is None:
                continue

            rows.append(
                {
                    "label": label,
                    "value": value,
                    "year": year,
                    "entity_type": "consolidated",
                    "statement_type": statement_type,
                    "source_chunk_id": chunk.get("chunk_id"),
                    "page_number": chunk.get("page_number"),
                }
            )

    return rows


def run_financial_extractors(chunks: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    return {
        "income_statement": _extract_rows(chunks, "income_statement", ["revenue", "profit", "income statement"]),
        "balance_sheet": _extract_rows(chunks, "balance_sheet", ["assets", "liabilities", "equity", "balance sheet"]),
        "cashflow_statement": _extract_rows(chunks, "cashflow_statement", ["cash flow", "operating", "investing", "financing"]),
        "income_notes": _extract_rows(chunks, "income_notes", ["note", "breakdown", "segment"]),
        "segments": _extract_rows(chunks, "segments", ["segment", "business unit", "geographical"]),
    }
