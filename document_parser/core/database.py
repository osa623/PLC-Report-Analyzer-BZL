from redis import Redis

from core.config import get_settings

settings = get_settings()


def get_redis() -> Redis:
    return Redis.from_url(settings.redis_url)
