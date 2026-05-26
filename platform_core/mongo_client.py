import os
from functools import lru_cache
from pymongo import MongoClient


@lru_cache()
def get_mongo_client():
    uri = os.environ.get("MONGO_DB_URL") or os.environ.get("MONGO_URI") or "mongodb://localhost:27017"
    return MongoClient(uri)


def get_mongo_db(db_name: str | None = None):
    db = db_name or os.environ.get("MONGO_DB_NAME") or os.environ.get("MONGO_DATABASE") or "plc"
    client = get_mongo_client()
    return client[db]


def close_mongo_client():
    try:
        get_mongo_client().close()
    except Exception:
        pass
