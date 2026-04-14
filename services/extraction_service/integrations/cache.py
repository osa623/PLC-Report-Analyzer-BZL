from typing import Optional
import redis.asyncio as redis

_redis: Optional[redis.Redis] = None


def get_redis(url: str = "redis://localhost:6379/0") -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(url)
    return _redis


async def get_cached(key: str) -> Optional[bytes]:
    r = get_redis()
    val = await r.get(key)
    return val


async def set_cached(key: str, value: bytes, ttl: int = 60 * 60 * 24):
    r = get_redis()
    await r.set(key, value, ex=ttl)
