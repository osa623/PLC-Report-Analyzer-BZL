import os
import re
from functools import lru_cache
from pymongo import MongoClient

def ensure_srv_resolution(uri: str):
    if uri and uri.startswith("mongodb+srv://"):
        match = re.search(r"mongodb\+srv://(?:[^@]+@)?([^/?#]+)", uri)
        if match:
            host = match.group(1)
            srv_host = f"_mongodb._tcp.{host}"
            try:
                import dns.resolver
                # Attempt to resolve the SRV record
                dns.resolver.resolve(srv_host, 'SRV')
            except Exception:
                try:
                    import dns.resolver
                    resolver = dns.resolver.get_default_resolver()
                    if resolver:
                        # Prepend public DNS servers to the existing nameservers list
                        resolver.nameservers = ['8.8.8.8', '1.1.1.1'] + resolver.nameservers
                except Exception:
                    pass

@lru_cache()
def get_mongo_client():
    uri = os.environ.get("MONGO_DB_URL") or os.environ.get("MONGO_URI") or "mongodb://localhost:27017"
    ensure_srv_resolution(uri)
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
