from __future__ import annotations

import json
from pathlib import Path

from platform_core.shared_infra.redis_client import set_json


FINAL_REPORT_FILENAME = "final_report.json"


def final_report_path() -> Path:
    return Path(__file__).resolve().parents[1] / FINAL_REPORT_FILENAME


def save_final_report(redis, report_id: str, report_payload: dict, ttl_seconds: int) -> None:
    set_json(redis, f"report:{report_id}:final_report", report_payload, ttl_seconds)
    final_report_path().write_text(json.dumps(report_payload, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
