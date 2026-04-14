import os
import logging
from typing import Optional

import psycopg2
from psycopg2.pool import SimpleConnectionPool

logger = logging.getLogger("platform_core.data_access")


class PostgresPool:
    def __init__(self, dsn: Optional[str] = None, minconn: int = 1, maxconn: int = 10):
        dsn = dsn or os.environ.get("DATABASE_DSN")
        if not dsn:
            raise ValueError("DATABASE_DSN must be set for PostgresPool")
        self.pool = SimpleConnectionPool(minconn, maxconn, dsn)

    def getconn(self):
        return self.pool.getconn()

    def putconn(self, conn):
        self.pool.putconn(conn)

    def closeall(self):
        self.pool.closeall()
