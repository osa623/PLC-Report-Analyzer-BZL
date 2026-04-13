from __future__ import annotations

from typing import Any


def build_diagnostics(inspection_payload: dict[str, Any]) -> dict[str, Any]:
    validated = inspection_payload.get("canonical_validated") or {}
    summary = validated.get("validation_summary") or {}
    return {
        "has_raw": inspection_payload.get("raw") is not None,
        "has_canonical_raw": inspection_payload.get("canonical_raw") is not None,
        "has_canonical_validated": inspection_payload.get("canonical_validated") is not None,
        "failed_rule_count": summary.get("failed_rule_count", 0),
        "total_rows": summary.get("total_rows", 0),
        "quality_score": validated.get("overall_data_quality_score"),
    }
