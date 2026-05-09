from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any


def update_pipeline_stage(
    redis_client: Any,
    report_id: str,
    stage: str,
    status: str,
    ttl_seconds: int,
    diagnostics: dict[str, Any] | None = None,
) -> None:
    key = f"report:{report_id}:pipeline_stages"
    raw = redis_client.get(key)
    stages = json.loads(raw) if raw else {}

    now = datetime.now(timezone.utc).isoformat()
    stage_obj = stages.get(stage, {})

    if status == "running" and not stage_obj.get("start_time"):
        stage_obj["start_time"] = now

    stage_obj.update(
        {
            "status": status,
            "end_time": now if status in {"completed", "failed", "skipped"} else stage_obj.get("end_time"),
            "diagnostics": diagnostics or {},
        }
    )

    stages[stage] = stage_obj
    redis_client.setex(key, ttl_seconds, json.dumps(stages, ensure_ascii=True))


def init_pipeline_stages(
    redis_client: Any,
    report_id: str,
    ttl_seconds: int,
) -> dict[str, Any]:
    stage_names = ["EXTRACTION", "ANALYSIS", "REPORTING"]
    stages: dict[str, Any] = {}
    for name in stage_names:
        stages[name] = {
            "status": "pending",
            "start_time": None,
            "end_time": None,
            "diagnostics": {},
        }
    redis_client.setex(
        f"report:{report_id}:pipeline_stages",
        ttl_seconds,
        json.dumps(stages, ensure_ascii=True),
    )
    return stages


EXTRACTION_SUBSTAGES = [
    "text_extraction",
    "table_detection",
    "field_mapping",
    "normalization",
    "validation",
]


def update_extraction_substage(
    redis_client: Any,
    report_id: str,
    substage: str,
    status: str,
    ttl_seconds: int,
    diagnostics: dict[str, Any] | None = None,
) -> None:
    """Track granular progress within the EXTRACTION pipeline stage.

    substage must be one of: text_extraction, table_detection,
    field_mapping, normalization, validation.
    """
    key = f"report:{report_id}:extraction_substages"
    raw = redis_client.get(key)
    substages = json.loads(raw) if raw else {
        s: {"status": "pending"} for s in EXTRACTION_SUBSTAGES
    }

    now = datetime.now(timezone.utc).isoformat()
    entry = substages.get(substage, {})

    if status == "running" and not entry.get("start_time"):
        entry["start_time"] = now

    entry.update({
        "status": status,
        "end_time": now if status in {"completed", "failed"} else entry.get("end_time"),
    })
    if diagnostics:
        entry["diagnostics"] = diagnostics

    substages[substage] = entry
    redis_client.setex(key, ttl_seconds, json.dumps(substages, ensure_ascii=True))
