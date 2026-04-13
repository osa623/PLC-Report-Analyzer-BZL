from __future__ import annotations

import json
from typing import Any


INSPECTION_KEYS = [
    "report:{report_id}",
    "report:{report_id}:canonical_raw",
    "report:{report_id}:canonical_validated",
    "report:{report_id}:ratios",
    "report:{report_id}:sector_kpis",
    "report:{report_id}:patterns",
    "report:{report_id}:governance",
    "report:{report_id}:risk",
    "report:{report_id}:esg",
    "report:{report_id}:strategy",
    "report:{report_id}:pipeline_stages",
]


def read_inspection_bundle(redis_client: Any, report_id: str) -> dict[str, Any]:
    bundle: dict[str, Any] = {"report_id": report_id}
    for pattern in INSPECTION_KEYS:
        key = pattern.format(report_id=report_id)
        field = key.replace(f"report:{report_id}:", "").replace(f"report:{report_id}", "raw")
        try:
            value = json.loads(redis_client.get(key) or "null")
        except Exception:
            value = None
        bundle[field] = value
    return bundle
