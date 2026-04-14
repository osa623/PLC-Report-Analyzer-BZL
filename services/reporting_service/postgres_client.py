from __future__ import annotations

from platform_core.shared_infra.postgres_client import get_postgres_pool


def get_pool():
    return get_postgres_pool()
