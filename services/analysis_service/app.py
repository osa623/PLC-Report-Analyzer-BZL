from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .aggregation.canonical_builder import build_canonical
from .analytics.kpi_engine import compute_kpis
from .analytics.pattern_engine import compute_patterns
from .analytics.ratio_engine import compute_ratios
from .analytics.risk_engine import compute_risk_signals
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
from .workflow.job_status_tracker import mark_failed, mark_running, mark_success
from platform_core.shared_infra.redis_client import get_json

app = FastAPI(title="analysis-service", version="1.0.0")
cfg = get_config()


class AnalyzeRequest(BaseModel):
    report_id: str


def _detected_years_from_ratios(ratios: dict) -> list[str]:
    years = ratios.get("detected_years") if isinstance(ratios, dict) else []
    return years if isinstance(years, list) else []


def _trend_limitations(year_count: int) -> list[str]:
    if year_count >= 3:
        return []
    if year_count <= 1:
        return [
            "Trend analysis limited due to single reporting year",
            "Multi-year pattern detection not available for current dataset",
            "Structural financial snapshot generated from available data",
        ]
    return [
        "Long-horizon trend detection is limited because fewer than three reporting years were detected",
        "Structural financial snapshot generated from available data",
    ]


@app.post('/analyze')
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    redis = get_redis()
    try:
        mark_running(redis, request.report_id)

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
        patterns = compute_patterns(validated, issues, ratios)
        risk = compute_risk_signals(ratios)
        sector = compare_sector(ratios)
        confidence = compute_confidence(issues, ratios, kpis)
        save_analytics(redis, request.report_id, ratios, patterns, confidence, sector, risk, cfg.redis_ttl_seconds)

        numeric_years = [y for y in _detected_years_from_ratios(ratios) if isinstance(y, str) and y.isdigit()]
        meta = get_json(redis, f"report:{request.report_id}:meta", default={})
        transparency = {
            "documents_uploaded": int(meta.get("document_count", 1) or 1),
            "detected_reporting_years": numeric_years,
            "analysis_executed": [
                "normalization",
                "validation",
                "ratio_engine",
                "risk_analysis",
                "pattern_logic",
                "confidence_scoring",
            ],
            "analysis_limited": _trend_limitations(len(numeric_years)),
        }

        mark_success(redis, request.report_id)
        return {
            "status": "completed",
            "report_id": request.report_id,
            "validation_issues": len(issues),
            "reextraction_required": validated.reextraction_required,
            "detected_years": numeric_years,
            "transparency": transparency,
        }
    except HTTPException as exc:
        mark_failed(redis, request.report_id, str(exc.detail))
        raise
    except Exception as exc:
        mark_failed(redis, request.report_id, str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get('/health')
def health() -> dict[str, str]:
    return {"status": "ok", "service": "analysis-service"}
