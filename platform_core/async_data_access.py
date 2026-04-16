import os
import logging
from typing import Optional
from urllib.parse import urlparse
import asyncio

logger = logging.getLogger("platform_core.async_data_access")


class AsyncPostgresPool:
    """Async compatibility pool. If `MONGO_URI` is set, provides async wrappers around pymongo via threads."""

    def __init__(self, dsn: Optional[str] = None, min_size: int = 1, max_size: int = 10):
        self._mongo_uri = os.environ.get("MONGO_URI")
        if self._mongo_uri:
            try:
                from pymongo import MongoClient
            except Exception as e:
                raise RuntimeError("pymongo not installed") from e
            self._client = MongoClient(self._mongo_uri)
            self._dbname = os.environ.get("MONGO_DB") or dsn or "plc"
            self._is_mongo = True
            self._loop = asyncio.get_event_loop()
            return

        try:
            import asyncpg
        except Exception as e:
            raise RuntimeError("asyncpg not installed — Async Postgres is unavailable") from e

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
        self._is_mongo = False

    async def init(self):
        if self._is_mongo:
            return
        if self._pool is None:
            import asyncpg

            self._pool = await asyncpg.create_pool(dsn=self._dsn, min_size=self._min, max_size=self._max)

    async def acquire(self):
        if self._is_mongo:
            # return a pymongo DB instance via thread executor
            return await asyncio.to_thread(lambda: self._client[self._dbname])
        if self._pool is None:
            await self.init()
        return await self._pool.acquire()

    async def release(self, conn):
        if self._is_mongo:
            return None
        if self._pool:
            await self._pool.release(conn)

    async def close(self):
        if self._is_mongo:
            await asyncio.to_thread(lambda: self._client.close())
            return
        if self._pool:
            await self._pool.close()
