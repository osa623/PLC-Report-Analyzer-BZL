from fastapi import Depends
from redis import Redis

from core.config import get_settings
from core.redis_client import get_redis
from services.comparative_service import ComparativeService


def get_comparative_service(redis_client: Redis = Depends(get_redis)) -> ComparativeService:
    settings = get_settings()
    return ComparativeService(
        redis_client=redis_client,
        input_prefix=settings.redis_key_prefix,
        ratios_suffix=settings.redis_ratios_suffix,
        patterns_suffix=settings.redis_patterns_suffix,
        final_report_suffix=settings.redis_final_report_suffix,
        comparative_suffix=settings.redis_comparative_suffix,
        ttl_seconds=settings.redis_ttl_seconds,
    )
