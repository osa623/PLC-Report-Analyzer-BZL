from __future__ import annotations

from statistics import mean
from typing import Any

from modules.confidence_scoring.service import score_row, to_float


def validate_rows(rows: list[dict[str, Any]]) -> dict[str, Any]:
    validated_rows: list[dict[str, Any]] = []
    validation_errors: list[str] = []
    by_year: dict[str, dict[str, float]] = {}

    for row in rows:
        confidence, flags = score_row(row)
        value_num = to_float(row.get("value"))

        validated = {
            **row,
            "value": value_num if value_num is not None else row.get("value"),
            "confidence_score": confidence,
            "validation_flags": flags,
        }
        validated_rows.append(validated)

        year_key = str(row.get("year") or "unknown")
        label = str(row.get("canonical_label") or "").lower()
        if value_num is not None:
            by_year.setdefault(year_key, {})[label] = value_num

    for year, label_map in by_year.items():
        assets = label_map.get("assets")
        liabilities = label_map.get("liabilities")
        equity = label_map.get("equity")
        revenue = label_map.get("revenue")
        net_profit = label_map.get("net_profit")

        if assets is not None and liabilities is not None and equity is not None:
            if abs(assets - (liabilities + equity)) > max(1.0, abs(assets) * 0.05):
                validation_errors.append(f"balance_mismatch:{year}")

        if revenue is not None and net_profit is not None and revenue < net_profit:
            validation_errors.append(f"revenue_lt_net_profit:{year}")

    scores = [float(row.get("confidence_score") or 0.0) for row in validated_rows]
    base_quality = mean(scores) if scores else 0.0
    penalty = min(0.35, len(validation_errors) * 0.03)
    overall_quality = max(0.0, min(1.0, base_quality - penalty))

    return {
        "validated_rows": validated_rows,
        "overall_data_quality_score": overall_quality,
        "validation_summary": {
            "total_rows": len(validated_rows),
            "failed_rule_count": len(validation_errors),
            "passed": len(validation_errors) == 0,
        },
        "error_catalog": validation_errors,
        "missing_value_index": [
            {"row_id": row.get("row_id"), "flags": row.get("validation_flags", [])}
            for row in validated_rows
            if row.get("validation_flags")
        ],
        "confidence_distribution": {
            "min": min(scores) if scores else 0.0,
            "max": max(scores) if scores else 0.0,
            "avg": base_quality,
        },
    }
