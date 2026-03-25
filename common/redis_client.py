import json
from functools import lru_cache
from typing import Any

from redis import Redis


@lru_cache(maxsize=1)
def get_redis_client(redis_url: str) -> Redis:
    return Redis.from_url(redis_url, protocol=3)


def json_loads(raw: Any, default: Any) -> Any:
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
    return json.dumps(payload, ensure_ascii=True)
