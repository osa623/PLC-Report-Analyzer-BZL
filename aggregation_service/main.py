import json
import os
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel
from redis import Redis

SERVICE_NAME = "aggregation_service"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_TTL_SECONDS = int(os.getenv("REDIS_TTL_SECONDS", "3600"))

app = FastAPI(title=SERVICE_NAME, version="1.0.0")
redis_client = Redis.from_url(REDIS_URL, decode_responses=True)


class AggregateRequest(BaseModel):
    report_id: str


def _safe_json_load(raw: Any, default: Any) -> Any:
    if raw is None:
        return default
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return default


def _collect_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]

    if not isinstance(payload, dict):
        return []

    if isinstance(payload.get("rows"), list):
        return [row for row in payload["rows"] if isinstance(row, dict)]

    rows: list[dict[str, Any]] = []
    for value in payload.values():
        if isinstance(value, list):
            rows.extend([row for row in value if isinstance(row, dict)])
        elif isinstance(value, dict) and isinstance(value.get("rows"), list):
            rows.extend([row for row in value["rows"] if isinstance(row, dict)])
    return rows


def _normalize_label(label: Any) -> str:
    if label is None:
        return "unknown"
    text = str(label).strip().lower()
    aliases = {
        "total revenue": "revenue",
        "sales": "revenue",
        "turnover": "revenue",
        "net profit": "net_profit",
        "profit after tax": "net_profit",
        "total assets": "assets",
        "total liabilities": "liabilities",
        "total equity": "equity",
    }
    return aliases.get(text, text.replace(" ", "_"))


@app.post("/aggregate-report")
def aggregate_report(request: AggregateRequest) -> dict[str, Any]:
    base_key = f"report:{request.report_id}"
    canonical_key = f"report:{request.report_id}:canonical_raw"

    base_payload = _safe_json_load(redis_client.get(base_key), default={})
    extracted_rows = _collect_rows(base_payload)

    deduped: dict[tuple[Any, ...], dict[str, Any]] = {}
    for idx, row in enumerate(extracted_rows):
        canonical_label = _normalize_label(row.get("label"))
        normalized_row = {
            "row_id": row.get("row_id") or f"{request.report_id}:{idx}",
            "canonical_label": canonical_label,
            "original_label": row.get("label"),
            "value": row.get("value"),
            "year": row.get("year"),
            "entity_type": row.get("entity_type"),
            "statement_type": row.get("statement_type"),
            "unit": row.get("unit"),
            "currency": row.get("currency"),
            "source_chunk_id": row.get("source_chunk_id"),
            "page_number": row.get("page_number"),
            "lineage": row.get("lineage") or [],
        }

        key = (
            normalized_row["canonical_label"],
            normalized_row["year"],
            normalized_row["value"],
            normalized_row["entity_type"],
            normalized_row["statement_type"],
        )
        if key not in deduped:
            deduped[key] = normalized_row

    canonical_payload = {
        "report_id": request.report_id,
        "status": "aggregated",
        "schema_version": "canonical_v1",
        "rows": list(deduped.values()),
        "row_count": len(deduped),
    }

    redis_client.setex(canonical_key, REDIS_TTL_SECONDS, json.dumps(canonical_payload, ensure_ascii=True))

    return {
        "report_id": request.report_id,
        "status": "aggregated",
        "canonical_key": canonical_key,
        "row_count": len(deduped),
    }


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": SERVICE_NAME}
