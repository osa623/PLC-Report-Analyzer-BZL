import os
import logging
from typing import Optional
from urllib.parse import urlparse

import asyncpg

logger = logging.getLogger("platform_core.async_data_access")


class AsyncPostgresPool:
    def __init__(self, dsn: Optional[str] = None, min_size: int = 1, max_size: int = 10):
        dsn = dsn or os.environ.get("DATABASE_DSN")
        if not dsn:
            raise ValueError("DATABASE_DSN must be set for AsyncPostgresPool")

        parsed = urlparse(dsn)
        if parsed.scheme not in ("postgres", "postgresql"):
            raise ValueError("DATABASE_DSN must start with postgresql:// or postgres://")

        self._dsn = dsn
        self._min = min_size
        self._max = max_size
        self._pool = None

    async def init(self):
        if self._pool is None:
            self._pool = await asyncpg.create_pool(dsn=self._dsn, min_size=self._min, max_size=self._max)

    async def acquire(self):
        if self._pool is None:
            await self.init()
        return await self._pool.acquire()

    async def release(self, conn):
        if self._pool:
            await self._pool.release(conn)

    async def close(self):
        if self._pool:
            await self._pool.close()
