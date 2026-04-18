from __future__ import annotations

from platform_core.shared_infra.redis_client import set_json


def save_final_report(redis, report_id: str, report_payload: dict, ttl_seconds: int) -> None:
    set_json(redis, f"report:{report_id}:final_report", report_payload, ttl_seconds)
