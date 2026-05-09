from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .mongo_client import get_mongo_db


COLLECTION_NAME = "temporary_financial_statements"


def _collection():
    return get_mongo_db()[COLLECTION_NAME]


def insert_temporary_financial_statement(document: dict[str, Any]) -> str:
    payload = dict(document)
    payload.setdefault("created_at", datetime.now(timezone.utc))
    result = _collection().insert_one(payload)
    return str(result.inserted_id)


def fetch_temporary_financial_statements(report_id: str) -> list[dict[str, Any]]:
    cursor = _collection().find({"report_id": report_id})
    docs: list[dict[str, Any]] = []
    for raw in cursor:
        item = dict(raw)
        item.pop("_id", None)
        docs.append(item)
    return docs


def delete_temporary_financial_statements(report_id: str) -> int:
    result = _collection().delete_many({"report_id": report_id})
    return int(result.deleted_count)
