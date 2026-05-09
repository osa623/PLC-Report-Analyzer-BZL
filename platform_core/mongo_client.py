import os
from functools import lru_cache
from pymongo import MongoClient


@lru_cache()
def get_mongo_client():
    uri = os.environ.get("MONGO_DB_URL")
    return MongoClient(uri)


def get_mongo_db(db_name: str | None = None):
    db = os.environ.get("MONGO_DB_URL") or db_name or "plc"
    client = get_mongo_client()
    return client[db]


def close_mongo_client():
    try:
        get_mongo_client().close()
    except Exception:
        pass
