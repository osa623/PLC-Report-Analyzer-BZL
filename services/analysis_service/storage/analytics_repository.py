from __future__ import annotations

import json
from pathlib import Path

from platform_core.shared_infra.redis_client import set_json


ANALYTICS_FILENAME = "analytics.json"


def analytics_path() -> Path:
    return Path(__file__).resolve().parents[1] / ANALYTICS_FILENAME


def save_analytics(
    redis,
    report_id: str,
    ratios: dict,
    patterns: list[str],
    confidence: dict,
    sector: dict,
    risk: dict,
    ttl_seconds: int,
) -> None:
    analytics_payload = {
        "report_id": report_id,
        "source": "normalized_results.json",
        "ratios": ratios,
        "patterns": patterns,
        "confidence": confidence,
        "sector_comparison": sector,
        "risk": risk,
    }
    set_json(redis, f"report:{report_id}:ratios", ratios, ttl_seconds)
    set_json(redis, f"report:{report_id}:patterns", patterns, ttl_seconds)
    set_json(redis, f"report:{report_id}:confidence", confidence, ttl_seconds)
    set_json(redis, f"report:{report_id}:sector_comparison", sector, ttl_seconds)
    set_json(redis, f"report:{report_id}:risk", risk, ttl_seconds)
    set_json(redis, f"report:{report_id}:analytics", analytics_payload, ttl_seconds)

    path = analytics_path()
    path.write_text(json.dumps(analytics_payload, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
