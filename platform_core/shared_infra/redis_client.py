from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from redis import Redis


@lru_cache(maxsize=4)
def get_redis_client(redis_url: str, decode_responses: bool = True) -> Redis:
    return Redis.from_url(redis_url, decode_responses=decode_responses)


def json_loads(raw: Any, default: Any = None) -> Any:
    if raw is None:
        return default

    if isinstance(raw, bytes):
        text = raw.decode("utf-8", errors="ignore")
    elif isinstance(raw, str):
        text = raw
    else:
        return default

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return default


def json_dumps(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=True, default=str)


def set_json(redis: Redis, key: str, payload: Any, ttl_seconds: int) -> None:
    redis.setex(key, ttl_seconds, json_dumps(payload))


def get_json(redis: Redis, key: str, default: Any = None) -> Any:
    return json_loads(redis.get(key), default=default)
