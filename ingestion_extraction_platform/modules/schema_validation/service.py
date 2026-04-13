from __future__ import annotations

from typing import Any

MANDATORY_FIELDS = [
    "label",
    "value",
    "year",
    "entity_type",
    "statement_type",
    "source_chunk_id",
    "page_number",
]


def enforce_row_schema(rows: list[dict[str, Any]], default_statement_type: str) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item.setdefault("statement_type", default_statement_type)
        item.setdefault("entity_type", "consolidated")
        item.setdefault("year", "unknown")
        item.setdefault("source_chunk_id", "unknown")
        item.setdefault("page_number", 1)

        if any(item.get(field) is None for field in MANDATORY_FIELDS):
            continue

        cleaned.append(item)

    return cleaned
