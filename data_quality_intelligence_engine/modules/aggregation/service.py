from __future__ import annotations

from typing import Any


def normalize_label(label: Any) -> str:
    text = str(label or "unknown").strip().lower()
    aliases = {
        "total revenue": "revenue",
        "sales": "revenue",
        "turnover": "revenue",
        "net profit": "net_profit",
        "profit after tax": "net_profit",
        "total assets": "assets",
        "total liabilities": "liabilities",
        "total equity": "equity",
    }
    return aliases.get(text, text.replace(" ", "_"))


def collect_rows(base_payload: dict[str, Any], report_id: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    keys = ["income_statement", "balance_sheet", "cashflow_statement", "income_notes", "segments"]

    for key in keys:
        value = base_payload.get(key)
        if not isinstance(value, list):
            continue

        for idx, row in enumerate(value):
            if not isinstance(row, dict):
                continue
            rows.append(
                {
                    "row_id": row.get("row_id") or f"{report_id}:{key}:{idx}",
                    "canonical_label": normalize_label(row.get("label")),
                    "original_label": row.get("label"),
                    "value": row.get("value"),
                    "year": row.get("year"),
                    "entity_type": row.get("entity_type"),
                    "statement_type": row.get("statement_type"),
                    "unit": row.get("unit"),
                    "currency": row.get("currency"),
                    "source_chunk_id": row.get("source_chunk_id"),
                    "page_number": row.get("page_number"),
                    "lineage": row.get("lineage") or [],
                }
            )

    deduped: dict[tuple[Any, ...], dict[str, Any]] = {}
    for row in rows:
        dedupe_key = (
            row.get("canonical_label"),
            row.get("year"),
            row.get("value"),
            row.get("entity_type"),
            row.get("statement_type"),
        )
        if dedupe_key not in deduped:
            deduped[dedupe_key] = row

    return list(deduped.values())
