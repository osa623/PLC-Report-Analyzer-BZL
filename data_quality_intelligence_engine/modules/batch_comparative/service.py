from __future__ import annotations

from typing import Any


def run_comparative(batch_id: str, report_payloads: list[dict[str, Any]]) -> dict[str, Any]:
    eligibility: list[dict[str, Any]] = []
    comparative_rows: list[dict[str, Any]] = []

    for payload in report_payloads:
        report_id = payload.get("report_id")
        quality = float(payload.get("overall_data_quality_score") or 0.0)
        eligible = quality >= 0.65 and bool(payload.get("validated_rows"))

        eligibility.append(
            {
                "report_id": report_id,
                "eligible": eligible,
                "quality_score": quality,
                "reason": "ok" if eligible else "low_confidence_or_missing_validated_rows",
            }
        )

        if eligible:
            comparative_rows.append(
                {
                    "report_id": report_id,
                    "quality_score": quality,
                    "validated_row_count": len(payload.get("validated_rows", [])),
                }
            )

    return {
        "batch_id": batch_id,
        "status": "completed",
        "comparative": comparative_rows,
        "eligibility": eligibility,
    }
