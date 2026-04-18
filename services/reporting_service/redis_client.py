from __future__ import annotations

from redis import Redis

from .config import get_config
from platform_core.shared_infra.redis_client import get_redis_client


def get_redis() -> Redis:
    cfg = get_config()
    return get_redis_client(cfg.redis_url)
