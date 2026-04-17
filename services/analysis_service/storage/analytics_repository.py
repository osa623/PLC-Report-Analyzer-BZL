from __future__ import annotations

from platform_core.shared_infra.redis_client import set_json


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
    set_json(redis, f"report:{report_id}:ratios", ratios, ttl_seconds)
    set_json(redis, f"report:{report_id}:patterns", patterns, ttl_seconds)
    set_json(redis, f"report:{report_id}:confidence", confidence, ttl_seconds)
    set_json(redis, f"report:{report_id}:sector_comparison", sector, ttl_seconds)
    set_json(redis, f"report:{report_id}:risk", risk, ttl_seconds)
