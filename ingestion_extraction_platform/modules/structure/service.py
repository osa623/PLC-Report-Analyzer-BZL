from __future__ import annotations

import re
from typing import Any

SECTION_PATTERNS = {
    "income_statement": re.compile(r"income\s+statement|statement\s+of\s+profit", re.IGNORECASE),
    "balance_sheet": re.compile(r"balance\s+sheet|statement\s+of\s+financial\s+position", re.IGNORECASE),
    "cashflow_statement": re.compile(r"cash\s*flow|statement\s+of\s+cash\s+flows", re.IGNORECASE),
    "notes": re.compile(r"notes\s+to\s+the\s+financial", re.IGNORECASE),
    "governance": re.compile(r"governance|board\s+of\s+directors", re.IGNORECASE),
    "risk": re.compile(r"risk|uncertaint", re.IGNORECASE),
    "esg": re.compile(r"sustainability|esg|environment", re.IGNORECASE),
    "strategy": re.compile(r"strategy|strategic", re.IGNORECASE),
}


def detect_structure(chunks: list[dict[str, Any]]) -> dict[str, Any]:
    sections: list[dict[str, Any]] = []
    detected_tables: list[dict[str, Any]] = []

    for chunk in chunks:
        text = chunk.get("text", "")
        chunk_id = chunk.get("chunk_id")
        page_number = chunk.get("page_number")

        for section_name, pattern in SECTION_PATTERNS.items():
            if pattern.search(text):
                sections.append(
                    {
                        "section_name": section_name,
                        "chunk_id": chunk_id,
                        "page_number": page_number,
                    }
                )

        if any(token in text.lower() for token in ["|", "table", "total", "year ended"]):
            detected_tables.append(
                {
                    "chunk_id": chunk_id,
                    "page_number": page_number,
                    "confidence": 0.6,
                }
            )

    statement_regions = [s for s in sections if s["section_name"] in {"income_statement", "balance_sheet", "cashflow_statement"}]
    narrative_regions = [s for s in sections if s["section_name"] not in {"income_statement", "balance_sheet", "cashflow_statement"}]

    return {
        "sections": sections,
        "detected_tables": detected_tables,
        "statement_regions": statement_regions,
        "narrative_regions": narrative_regions,
    }
