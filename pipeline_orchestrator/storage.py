import os
import json
from typing import Optional, Dict, Any
import redis.asyncio as redis

_REDIS = None

def _get_redis() -> redis.Redis:
    global _REDIS
    if _REDIS is None:
        _REDIS = redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    return _REDIS

async def set_job_status(job_id: str, status: str, meta: Optional[Dict[str, Any]] = None):
    r = _get_redis()
    key = f"pipeline:job:{job_id}"
    payload = {"status": status}
    if meta:
        payload.update(meta)
    await r.set(key, json.dumps(payload))

async def get_job_status(job_id: str) -> Optional[Dict[str, Any]]:
    r = _get_redis()
    key = f"pipeline:job:{job_id}"
    v = await r.get(key)
    if not v:
        return None
    try:
        return json.loads(v)
    except Exception:
        return None
