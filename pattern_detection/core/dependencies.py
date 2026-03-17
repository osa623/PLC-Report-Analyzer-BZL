from fastapi import Depends
from redis import Redis

from core.config import get_settings
from core.redis_client import get_redis
from services.pattern_service import PatternService


def get_pattern_service(redis_client: Redis = Depends(get_redis)) -> PatternService:
    settings = get_settings()
    return PatternService(
        redis_client=redis_client,
        input_prefix=settings.redis_key_prefix,
        ratios_suffix=settings.redis_ratios_suffix,
        patterns_suffix=settings.redis_patterns_suffix,
        risk_suffix=settings.redis_risk_suffix,
        strategy_suffix=settings.redis_strategy_suffix,
        ttl_seconds=settings.redis_ttl_seconds,
    )
