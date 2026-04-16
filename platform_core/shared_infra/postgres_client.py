from __future__ import annotations

from functools import lru_cache
from typing import Any

# This module provides a compatibility shim named `get_postgres_pool`
# which returns a pool-like object. If the project is configured to use
# MongoDB (`MONGO_URI`), the returned object will be the Mongo-aware
# `PostgresPool` wrapper implemented in `platform_core.data_access`.

from platform_core.data_access import PostgresPool


@lru_cache(maxsize=1)
def get_postgres_pool(dsn: str | None = None, min_connections: int = 1, max_connections: int = 5) -> Any:
    """Return a pool-like object. Uses MongoDB if `MONGO_URI` is set, otherwise Postgres pool."""
    return PostgresPool(dsn=dsn, minconn=min_connections, maxconn=max_connections)


def execute_query(pool: Any, query: str, params: tuple | None = None) -> list[dict[str, Any]]:
    """Execute a SQL query using the provided pool.

    NOTE: If the pool is backed by MongoDB this function will raise a
    RuntimeError — storage code must be migrated to use MongoDB APIs.
    """
    conn = pool.getconn()
    try:
        # If conn is a pymongo Database instance, signal that migration is needed
        try:
            from pymongo.database import Database as _MongoDB
        except Exception:
            _MongoDB = None

        if _MongoDB is not None and isinstance(conn, _MongoDB):
            raise RuntimeError("execute_query cannot run SQL when pool is backed by MongoDB; migrate storage code to MongoDB APIs")

        # Otherwise assume Postgres connection
        with conn.cursor() as cur:
            cur.execute(query, params)
            if cur.description:
                columns = [desc[0] for desc in cur.description]
                return [dict(zip(columns, row)) for row in cur.fetchall()]
            conn.commit()
            return []
    finally:
        pool.putconn(conn)
