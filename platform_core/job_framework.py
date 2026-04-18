import asyncio
import enum
import json
import logging
from typing import Any, Dict, Optional

try:
    import redis.asyncio as redis
except Exception:
    redis = None

logger = logging.getLogger("platform_core.job_framework")


class JobStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    VALIDATING = "VALIDATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class RedisQueue:
    """Compatibility shim for code that expects a Redis-backed queue."""

    def __init__(self, name: str, url: str = "redis://localhost:6379/0"):
        if redis is None:
            raise RuntimeError("redis.asyncio is not available in this environment")
        self.name = name
        self._r = redis.from_url(url)

    async def push(self, payload: Dict[str, Any]):
        await self._r.rpush(self.name, json.dumps(payload))

    async def pop(self, timeout: int = 1) -> Optional[Dict[str, Any]]:
        item = await self._r.blpop(self.name, timeout=timeout)
        if not item:
            return None
        try:
            return json.loads(item[1])
        except Exception:
            return item[1]


class InMemoryQueue:
    """Simple in-process asyncio queue used as a fallback when Redis is unavailable."""

    def __init__(self, name: str):
        self.name = name
        self._q: asyncio.Queue = asyncio.Queue()

    async def push(self, payload: Dict[str, Any]):
        await self._q.put(payload)

    async def pop(self, timeout: int = 1) -> Optional[Dict[str, Any]]:
        try:
            return await asyncio.wait_for(self._q.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None


class ResilientQueue:
    """Queue that prefers Redis but transparently falls back to an in-memory queue on errors."""

    def __init__(self, name: str, url: str = "redis://localhost:6379/0"):
        self.name = name
        self._local = InMemoryQueue(name)
        self._redis_url = url
        self._r = None
        if redis is not None:
            try:
                self._r = redis.from_url(url)
            except Exception:
                self._r = None

    async def push(self, payload: Dict[str, Any]):
        if self._r is not None:
            try:
                await self._r.rpush(self.name, json.dumps(payload))
                return
            except Exception:
                logger.warning("Redis push failed, falling back to in-memory queue")
                self._r = None

        await self._local.push(payload)

    async def pop(self, timeout: int = 1) -> Optional[Dict[str, Any]]:
        if self._r is not None:
            try:
                item = await self._r.blpop(self.name, timeout=timeout)
                if not item:
                    return None
                try:
                    return json.loads(item[1])
                except Exception:
                    return item[1]
            except Exception:
                logger.warning("Redis pop failed, switching to in-memory queue")
                self._r = None

        return await self._local.pop(timeout=timeout)


class BaseWorker:
    def __init__(self, queue: 'ResilientQueue'):
        self.queue = queue

    async def handle(self, job: Dict[str, Any]):
        raise NotImplementedError()

    async def run(self):
        while True:
            item = await self.queue.pop(timeout=5)
            if not item:
                await asyncio.sleep(1)
                continue
            try:
                await self.handle(item)
            except Exception:
                logger.exception("Job handling failed")


def create_queue(name: str, url: str = "redis://localhost:6379/0") -> 'ResilientQueue':
    """Factory for a queue that will use Redis when available and fall back otherwise."""
    return ResilientQueue(name, url=url)
