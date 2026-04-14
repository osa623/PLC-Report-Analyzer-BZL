import asyncio
import enum
import logging
from typing import Any, Dict, Optional

import redis.asyncio as redis

logger = logging.getLogger("platform_core.job_framework")


class JobStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    VALIDATING = "VALIDATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class RedisQueue:
    def __init__(self, name: str, url: str = "redis://localhost:6379/0"):
        self.name = name
        self._r = redis.from_url(url)

    async def push(self, payload: Dict[str, Any]):
        await self._r.rpush(self.name, payload)

    async def pop(self, timeout: int = 1) -> Optional[Dict[str, Any]]:
        item = await self._r.blpop(self.name, timeout=timeout)
        return item


class BaseWorker:
    def __init__(self, queue: RedisQueue):
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
