from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .aggregation.canonical_builder import build_canonical
from .analytics.kpi_engine import compute_kpis
from .analytics.pattern_engine import compute_patterns
from .analytics.ratio_engine import compute_ratios
from .analytics.sector_comparison import compare_sector
from .confidence.confidence_score import compute_confidence
from .config import get_config
from .redis_client import get_redis
from .storage.analytics_repository import save_analytics
from .storage.canonical_validated_repository import save_canonical_validated
from .validation.accounting_validator import validate_accounting
from .validation.anomaly_detector import detect_anomalies
from .validation.cross_statement_validator import validate_cross_statement
from .validation.schema_validator import validate_schema
from .validation.self_correction_loop import run_self_correction_loop

app = FastAPI(title="analysis-service", version="1.0.0")
cfg = get_config()


class AnalyzeRequest(BaseModel):
    report_id: str


@app.post('/analyze')
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    redis = get_redis()
    raw_key = f"report:{request.report_id}:canonical_raw"
    raw_payload = redis.get(raw_key)
    if not raw_payload:
        raise HTTPException(status_code=404, detail="canonical_raw not found")

    canonical_raw = build_canonical(raw_payload)
    issues = []
    issues.extend(validate_schema(canonical_raw))
    issues.extend(validate_accounting(canonical_raw))
    issues.extend(validate_cross_statement(canonical_raw))
    issues.extend(detect_anomalies(canonical_raw))

    corrected = run_self_correction_loop(canonical_raw, issues)
    checks, check_issues = validate_accounting(corrected, with_checks=True)
    issues.extend(check_issues)

    validated = save_canonical_validated(redis, request.report_id, corrected, checks, issues, cfg.redis_ttl_seconds)
    ratios = compute_ratios(validated)
    kpis = compute_kpis(validated)
    patterns = compute_patterns(validated, issues)
    sector = compare_sector(ratios)
    confidence = compute_confidence(issues, ratios, kpis)
    save_analytics(redis, request.report_id, ratios, patterns, confidence, sector, cfg.redis_ttl_seconds)

    return {
        "status": "completed",
        "report_id": request.report_id,
        "validation_issues": len(issues),
        "reextraction_required": validated.reextraction_required,
    }


@app.get('/health')
def health() -> dict[str, str]:
    return {"status": "ok", "service": "analysis-service"}
