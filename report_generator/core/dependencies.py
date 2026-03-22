from fastapi import Depends
from redis import Redis

from core.config import get_settings
from core.redis_client import get_redis
from services.report_service import ReportService


def get_report_service(redis_client: Redis = Depends(get_redis)) -> ReportService:
    settings = get_settings()
    return ReportService(
        redis_client=redis_client,
        input_prefix=settings.redis_key_prefix,
        ratios_suffix=settings.redis_ratios_suffix,
        patterns_suffix=settings.redis_patterns_suffix,
        final_report_suffix=settings.redis_final_report_suffix,
        ttl_seconds=settings.redis_ttl_seconds,
        output_dir=settings.report_output_dir,
        pattern_min_confidence=settings.pattern_min_confidence,
    )
