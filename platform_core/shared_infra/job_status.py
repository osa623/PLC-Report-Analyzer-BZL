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
