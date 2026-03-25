import json
import os
from statistics import mean
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel
from redis import Redis

SERVICE_NAME = "validation_engine"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_TTL_SECONDS = int(os.getenv("REDIS_TTL_SECONDS", "3600"))

app = FastAPI(title=SERVICE_NAME, version="1.0.0")
redis_client = Redis.from_url(REDIS_URL, decode_responses=True)


class ValidateRequest(BaseModel):
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


def _to_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(str(value).replace(",", "").strip())
    except Exception:
        return None


def _row_confidence(row: dict[str, Any], flags: list[str]) -> float:
    score = 0.55
    if row.get("source_chunk_id"):
        score += 0.1
    else:
        flags.append("missing_source_chunk_id")

    if row.get("page_number") is not None:
        score += 0.1
    else:
        flags.append("missing_page_number")

    if row.get("year"):
        score += 0.1
    else:
        flags.append("missing_year")

    if _to_float(row.get("value")) is not None:
        score += 0.15
    else:
        flags.append("non_numeric_value")

    if row.get("canonical_label"):
        score += 0.05
    else:
        flags.append("missing_canonical_label")

    return max(0.0, min(1.0, score))


@app.post("/validate-report")
def validate_report(request: ValidateRequest) -> dict[str, Any]:
    canonical_key = f"report:{request.report_id}:canonical_raw"
    validated_key = f"report:{request.report_id}:canonical_validated"

    canonical_payload = _safe_json_load(redis_client.get(canonical_key), default={})
    rows = canonical_payload.get("rows") if isinstance(canonical_payload, dict) else []
    if not isinstance(rows, list):
        rows = []

    validated_rows: list[dict[str, Any]] = []
    validation_errors: list[str] = []

    by_year: dict[str, dict[str, float]] = {}

    for row in rows:
        if not isinstance(row, dict):
            continue

        flags: list[str] = []
        value_num = _to_float(row.get("value"))
        confidence = _row_confidence(row, flags)

        validated = {
            **row,
            "value": value_num if value_num is not None else row.get("value"),
            "confidence_score": confidence,
            "validation_flags": flags,
        }
        validated_rows.append(validated)

        year_key = str(row.get("year") or "unknown")
        label = str(row.get("canonical_label") or "").lower()
        if value_num is not None:
            by_year.setdefault(year_key, {})[label] = value_num

    for year, label_map in by_year.items():
        assets = label_map.get("assets")
        liabilities = label_map.get("liabilities")
        equity = label_map.get("equity")
        revenue = label_map.get("revenue")
        net_profit = label_map.get("net_profit")

        if assets is not None and liabilities is not None and equity is not None:
            if abs(assets - (liabilities + equity)) > max(1.0, abs(assets) * 0.05):
                validation_errors.append(f"balance_mismatch:{year}")

        if revenue is not None and net_profit is not None and revenue < net_profit:
            validation_errors.append(f"revenue_lt_net_profit:{year}")

    scores = [row.get("confidence_score", 0.0) for row in validated_rows]
    base_quality = mean(scores) if scores else 0.0
    penalty = min(0.35, len(validation_errors) * 0.03)
    overall_quality = max(0.0, min(1.0, base_quality - penalty))

    validated_payload = {
        "report_id": request.report_id,
        "status": "validated",
        "validated_rows": validated_rows,
        "overall_data_quality_score": overall_quality,
        "validation_summary": {
            "total_rows": len(validated_rows),
            "failed_rule_count": len(validation_errors),
            "passed": len(validation_errors) == 0,
        },
        "error_catalog": validation_errors,
        "missing_value_index": [
            {"row_id": row.get("row_id"), "flags": row.get("validation_flags", [])}
            for row in validated_rows
            if row.get("validation_flags")
        ],
        "confidence_distribution": {
            "min": min(scores) if scores else 0.0,
            "max": max(scores) if scores else 0.0,
            "avg": base_quality,
        },
    }

    redis_client.setex(validated_key, REDIS_TTL_SECONDS, json.dumps(validated_payload, ensure_ascii=True))

    return {
        "report_id": request.report_id,
        "status": "validated",
        "validated_key": validated_key,
        "overall_data_quality_score": overall_quality,
        "failed_rule_count": len(validation_errors),
    }


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": SERVICE_NAME}
