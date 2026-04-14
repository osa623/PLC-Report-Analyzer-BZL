from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

try:
    import psycopg2
    from psycopg2 import pool as pg_pool

    @lru_cache(maxsize=1)
    def get_postgres_pool(dsn: str | None = None, min_connections: int = 1, max_connections: int = 5) -> pg_pool.SimpleConnectionPool:
        dsn = dsn or os.getenv("DATABASE_URL", "")
        if not dsn:
            raise RuntimeError("DATABASE_URL not configured")
        return pg_pool.SimpleConnectionPool(min_connections, max_connections, dsn)

except ImportError:
    def get_postgres_pool(*args: Any, **kwargs: Any) -> Any:  # type: ignore[no-redef]
        raise RuntimeError("psycopg2 not installed — Postgres is unavailable")


def execute_query(pool: Any, query: str, params: tuple | None = None) -> list[dict[str, Any]]:
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            if cur.description:
                columns = [desc[0] for desc in cur.description]
                return [dict(zip(columns, row)) for row in cur.fetchall()]
            conn.commit()
            return []
    finally:
        pool.putconn(conn)
