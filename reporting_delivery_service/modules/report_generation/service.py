from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

def _write_pdf(output_path: Path, payload: dict[str, Any]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"Report ID: {payload.get('report_id')}",
        f"Generated At: {payload.get('generated_at')}",
        f"Quality Score: {payload.get('quality_summary', {}).get('overall_data_quality_score')}",
        f"Validation Errors: {payload.get('quality_summary', {}).get('failed_rule_count')}",
        "",
        "Highlights:",
    ]

    ratios = (payload.get("analytics") or {}).get("ratios", {}).get("metrics", [])
    for item in ratios[:15]:
        lines.append(f"- {item.get('metric_or_pattern_name')} ({item.get('year')}): {item.get('value')}")

    output_path.write_text("\n".join(lines), encoding="utf-8")


def build_final_report_payload(report_id: str, inspection_bundle: dict[str, Any]) -> dict[str, Any]:
    validated = inspection_bundle.get("canonical_validated") or {}
    ratios = inspection_bundle.get("ratios") or {}
    sector_kpis = inspection_bundle.get("sector_kpis") or {}
    patterns = inspection_bundle.get("patterns") or {}
    narratives = {
        "governance": inspection_bundle.get("governance") or {},
        "risk": inspection_bundle.get("risk") or {},
        "esg": inspection_bundle.get("esg") or {},
        "strategy": inspection_bundle.get("strategy") or {},
    }

    return {
        "report_id": report_id,
        "status": "completed",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "quality_summary": {
            "overall_data_quality_score": validated.get("overall_data_quality_score"),
            "failed_rule_count": (validated.get("validation_summary") or {}).get("failed_rule_count", 0),
            "total_rows": (validated.get("validation_summary") or {}).get("total_rows", 0),
        },
        "analytics": {
            "ratios": ratios,
            "sector_kpis": sector_kpis,
            "patterns": patterns,
        },
        "narratives": narratives,
        "inspection_snapshot": {
            "pipeline_stages": inspection_bundle.get("pipeline_stages"),
            "has_raw": inspection_bundle.get("raw") is not None,
            "has_canonical_raw": inspection_bundle.get("canonical_raw") is not None,
            "has_canonical_validated": inspection_bundle.get("canonical_validated") is not None,
        },
    }


def generate_report_file(report_id: str, final_payload: dict[str, Any], output_dir: str) -> str:
    output_path = Path(output_dir) / f"{report_id}.pdf"
    _write_pdf(output_path, final_payload)
    return str(output_path)


def serialize_final_payload(final_payload: dict[str, Any]) -> str:
    return json.dumps(final_payload, ensure_ascii=True)
