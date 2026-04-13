from __future__ import annotations

from typing import Any


def to_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(str(value).replace(",", "").strip())
    except Exception:
        return None


def score_row(row: dict[str, Any]) -> tuple[float, list[str]]:
    flags: list[str] = []
    score = 0.55

    if row.get("source_chunk_id"):
        score += 0.1
    else:
        flags.append("missing_source_chunk_id")

    if row.get("page_number") is not None:
        score += 0.1
    else:
        flags.append("missing_page_number")

    if row.get("year"):
        score += 0.1
    else:
        flags.append("missing_year")

    if to_float(row.get("value")) is not None:
        score += 0.1
    else:
        flags.append("non_numeric_value")

    if row.get("canonical_label"):
        score += 0.05
    else:
        flags.append("missing_canonical_label")

    return max(0.0, min(1.0, score)), flags
