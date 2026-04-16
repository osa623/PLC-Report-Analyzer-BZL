import os
import logging
from typing import Optional

logger = logging.getLogger("platform_core.data_access")


class PostgresPool:
    """Compatibility wrapper.

    If `MONGO_URI` is set in environment, this will behave as a thin MongoDB client wrapper
    to minimize code changes in services that call `getconn()`/`putconn()`/`closeall()`.

    Otherwise it will initialize a real Postgres SimpleConnectionPool.
    """

    def __init__(self, dsn: Optional[str] = None, minconn: int = 1, maxconn: int = 10):
        self._mongo_uri = os.environ.get("MONGO_URI")
        if self._mongo_uri:
            # lazy import pymongo
            try:
                from pymongo import MongoClient
            except Exception as e:
                raise RuntimeError("pymongo not installed") from e
            self._client = MongoClient(self._mongo_uri)
            self._dbname = os.environ.get("MONGO_DB") or dsn or "plc"
            self._is_mongo = True
            logger.info("Using MongoDB at %s for PostgresPool compatibility", self._mongo_uri)
            return

        # Fallback to Postgres
        try:
            import psycopg2
            from psycopg2.pool import SimpleConnectionPool
        except Exception as e:
            raise RuntimeError("psycopg2 not installed — Postgres is unavailable") from e

        dsn = dsn or os.environ.get("DATABASE_DSN")
        if not dsn:
            raise ValueError("DATABASE_DSN must be set for PostgresPool")
        self.pool = SimpleConnectionPool(minconn, maxconn, dsn)
        self._is_mongo = False

    def getconn(self):
        if self._is_mongo:
            return self._client[self._dbname]
        return self.pool.getconn()

    def putconn(self, conn):
        if self._is_mongo:
            return None
        return self.pool.putconn(conn)

    def closeall(self):
        if self._is_mongo:
            try:
                self._client.close()
            except Exception:
                pass
            return
        self.pool.closeall()
