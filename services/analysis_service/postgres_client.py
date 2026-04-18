from __future__ import annotations

from platform_core.mongo_client import get_mongo_db


def get_db():
    """Return a MongoDB database instance for analysis_service."""
    return get_mongo_db()
