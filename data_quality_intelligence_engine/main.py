import json
import os
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel
from redis import Redis

from modules.aggregation.service import collect_rows
from modules.analytics.service import calculate_ratios, detect_patterns, sector_kpis
from modules.batch_comparative.service import run_comparative as run_batch_comparative
from modules.gating.service import passes_quality_gate
from modules.validation.service import validate_rows

SERVICE_NAME = "data_quality_intelligence_engine"
ANALYTICS_QUALITY_THRESHOLD = float(os.getenv("ANALYTICS_QUALITY_THRESHOLD", "0.65"))
MIN_ROW_CONFIDENCE_FOR_ANALYTICS = float(os.getenv("MIN_ROW_CONFIDENCE_FOR_ANALYTICS", "0.4"))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_TTL_SECONDS = int(os.getenv("REDIS_TTL_SECONDS", "3600"))

app = FastAPI(title=SERVICE_NAME, version="1.0.0")
redis_client = Redis.from_url(REDIS_URL, decode_responses=True)


class QualityRequest(BaseModel):
    report_id: str
    file_path: str
    sector: str
    strict_mode: bool = False


class ComparativeRequest(BaseModel):
    batch_id: str
    report_ids: list[str]


@app.post("/run-quality-intelligence")
def run_quality_intelligence(req: QualityRequest) -> dict[str, Any]:
    base_key = f"report:{req.report_id}"
    canonical_raw_key = f"report:{req.report_id}:canonical_raw"
    canonical_validated_key = f"report:{req.report_id}:canonical_validated"
    ratios_key = f"report:{req.report_id}:ratios"
    sector_kpis_key = f"report:{req.report_id}:sector_kpis"
    patterns_key = f"report:{req.report_id}:patterns"

    try:
        base_payload = json.loads(redis_client.get(base_key) or "{}")
    except Exception:
        base_payload = {}

    canonical_rows = collect_rows(base_payload, req.report_id)
    canonical_payload = {
        "report_id": req.report_id,
        "status": "aggregated",
        "schema_version": "canonical_v1",
        "rows": canonical_rows,
        "row_count": len(canonical_rows),
    }
    redis_client.setex(canonical_raw_key, REDIS_TTL_SECONDS, json.dumps(canonical_payload, ensure_ascii=True))

    validation_result = validate_rows(canonical_rows)
    validated_payload = {
        "report_id": req.report_id,
        "status": "validated",
        **validation_result,
    }
    redis_client.setex(canonical_validated_key, REDIS_TTL_SECONDS, json.dumps(validated_payload, ensure_ascii=True))

    quality = float(validation_result.get("overall_data_quality_score") or 0.0)
    if not passes_quality_gate(quality, ANALYTICS_QUALITY_THRESHOLD):
        return {
            "status": "low_confidence",
            "report_id": req.report_id,
            "overall_data_quality_score": quality,
            "quality_threshold": ANALYTICS_QUALITY_THRESHOLD,
            "validation": validated_payload,
        }

    ratios_payload = calculate_ratios(validation_result.get("validated_rows", []), MIN_ROW_CONFIDENCE_FOR_ANALYTICS)
    sector_kpis_payload = sector_kpis(ratios_payload, req.sector)
    patterns_payload = detect_patterns(validation_result.get("validated_rows", []), MIN_ROW_CONFIDENCE_FOR_ANALYTICS)

    redis_client.setex(ratios_key, REDIS_TTL_SECONDS, json.dumps(ratios_payload, ensure_ascii=True))
    redis_client.setex(sector_kpis_key, REDIS_TTL_SECONDS, json.dumps(sector_kpis_payload, ensure_ascii=True))
    redis_client.setex(patterns_key, REDIS_TTL_SECONDS, json.dumps(patterns_payload, ensure_ascii=True))

    return {
        "status": "completed",
        "report_id": req.report_id,
        "overall_data_quality_score": quality,
        "quality_threshold": ANALYTICS_QUALITY_THRESHOLD,
        "validation": validated_payload,
    }


@app.post("/run-comparative")
def run_comparative(req: ComparativeRequest) -> dict[str, Any]:
    payloads: list[dict[str, Any]] = []
    for report_id in req.report_ids:
        key = f"report:{report_id}:canonical_validated"
        try:
            validated = json.loads(redis_client.get(key) or "{}")
        except Exception:
            validated = {}
        payloads.append({"report_id": report_id, **validated})

    result = run_batch_comparative(req.batch_id, payloads)
    redis_client.setex(
        f"report:batch:{req.batch_id}:comparative",
        REDIS_TTL_SECONDS,
        json.dumps({"batch_id": req.batch_id, "comparative": result.get("comparative", []), "status": "completed"}, ensure_ascii=True),
    )
    redis_client.setex(
        f"report:batch:{req.batch_id}:eligibility",
        REDIS_TTL_SECONDS,
        json.dumps({"batch_id": req.batch_id, "eligibility": result.get("eligibility", []), "status": "completed"}, ensure_ascii=True),
    )
    return result


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": SERVICE_NAME}
