from fastapi import Depends
from redis import Redis

from core.config import get_settings
from core.redis_client import get_redis
from services.ratio_service import RatioService


def get_ratio_service(redis_client: Redis = Depends(get_redis)) -> RatioService:
    settings = get_settings()
    return RatioService(
        redis_client=redis_client,
        input_prefix=settings.redis_key_prefix,
        output_suffix=settings.redis_ratios_suffix,
        ttl_seconds=settings.redis_ttl_seconds,
    )
