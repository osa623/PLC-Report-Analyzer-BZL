from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

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
from platform_core.contracts.canonical_dataset import CanonicalRawReport
from platform_core.shared_infra.redis_client import get_json, set_json
from platform_core.temp_financial_repository import fetch_temporary_financial_statements

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


def _required_ratio_metric_count(financials: dict[str, Any]) -> int:
    required = [
        "total_assets",
        "total_liabilities",
        "total_equity",
        "net_profit",
        "revenue_or_interest_income",
    ]
    return len([k for k in required if isinstance(financials.get(k), (int, float))])


def _merge_temp_docs(temp_docs: list[dict[str, Any]]) -> dict[str, Any]:
    by_year: dict[str, dict[str, Any]] = {}
    for doc in temp_docs:
        year = str(doc.get("year")) if doc.get("year") is not None else ""
        if not year.isdigit():
            continue
        candidate = {
            "balance_sheet": doc.get("balance_sheet") if isinstance(doc.get("balance_sheet"), dict) else {},
            "income_statement": doc.get("income_statement") if isinstance(doc.get("income_statement"), dict) else {},
            "cashflow_statement": doc.get("cashflow_statement") if isinstance(doc.get("cashflow_statement"), dict) else {},
            "source_file": doc.get("source_file"),
            "metrics_extracted_count": int(doc.get("metrics_extracted_count", 0)),
            "extraction_confidence": float(doc.get("extraction_confidence", 0.0)),
        }

        financial_projection = {
            "total_assets": candidate["balance_sheet"].get("total_assets"),
            "total_liabilities": candidate["balance_sheet"].get("total_liabilities"),
            "total_equity": candidate["balance_sheet"].get("total_equity"),
            "net_profit": candidate["income_statement"].get("net_profit"),
            "revenue_or_interest_income": candidate["income_statement"].get("revenue_or_interest_income"),
        }
        candidate["required_metrics_count"] = _required_ratio_metric_count(financial_projection)

        current = by_year.get(year)
        if not current or candidate["required_metrics_count"] > current.get("required_metrics_count", 0):
            by_year[year] = candidate

    return {
        "years": sorted(by_year.keys()),
        "financials": by_year,
    }


def _canonical_raw_from_merged(report_id: str, merged: dict[str, Any]) -> CanonicalRawReport:
    income_statement: list[dict[str, Any]] = []
    balance_sheet: list[dict[str, Any]] = []
    cashflow: list[dict[str, Any]] = []

    def add(target: list[dict[str, Any]], label: str, value: Any, year: str) -> None:
        if not isinstance(value, (int, float)):
            return
        target.append(
            {
                "label": label,
                "value": float(value),
                "period": year,
                "currency": "LKR",
            }
        )

    for year in merged.get("years", []):
        entry = merged.get("financials", {}).get(year, {})
        bs = entry.get("balance_sheet") if isinstance(entry.get("balance_sheet"), dict) else {}
        inc = entry.get("income_statement") if isinstance(entry.get("income_statement"), dict) else {}
        cf = entry.get("cashflow_statement") if isinstance(entry.get("cashflow_statement"), dict) else {}

        add(balance_sheet, "Total Assets", bs.get("total_assets"), year)
        add(balance_sheet, "Total Liabilities", bs.get("total_liabilities"), year)
        add(balance_sheet, "Total Equity", bs.get("total_equity"), year)
        add(balance_sheet, "Current Assets", bs.get("current_assets"), year)
        add(balance_sheet, "Current Liabilities", bs.get("current_liabilities"), year)
        add(balance_sheet, "Debt", bs.get("borrowings"), year)
        add(balance_sheet, "Cash and Equivalents", bs.get("cash_and_equivalents"), year)

        add(income_statement, "Revenue", inc.get("revenue_or_interest_income"), year)
        add(income_statement, "Cost of Revenue", inc.get("cost_of_revenue"), year)
        add(income_statement, "Gross Profit", inc.get("gross_profit"), year)
        add(income_statement, "Operating Expenses", inc.get("operating_expenses"), year)
        add(income_statement, "Operating Profit", inc.get("operating_profit"), year)
        add(income_statement, "Net Income", inc.get("net_profit"), year)

        add(cashflow, "Operating Cash Flow", cf.get("operating_cash_flow"), year)
        add(cashflow, "Investing Cash Flow", cf.get("investing_cash_flow"), year)
        add(cashflow, "Financing Cash Flow", cf.get("financing_cash_flow"), year)
        add(cashflow, "Net Cash Flow", cf.get("net_cash_change"), year)

    return CanonicalRawReport(
        report_id=report_id,
        financial_statements={
            "income_statement": income_statement,
            "balance_sheet": balance_sheet,
            "cashflow": cashflow,
            "equity": [],
        },
        narrative_sections={
            "notes": [],
            "risk": [],
            "governance": [],
            "esg": [],
            "segment": [],
        },
    )


def _latest_ratio_coverage(ratios: dict[str, Any]) -> float:
    if not isinstance(ratios, dict):
        return 0.0
    latest_year = ratios.get("latest_year")
    by_year = ratios.get("by_year") if isinstance(ratios.get("by_year"), dict) else {}
    latest = by_year.get(latest_year, {}) if isinstance(latest_year, str) else {}
    if not isinstance(latest, dict):
        return 0.0
    numeric_count = len([v for v in latest.values() if isinstance(v, (int, float))])
    # 13 primary ratios are expected from ratio_engine.
    return min(1.0, numeric_count / 13.0)


@app.post('/analyze')
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    redis = get_redis()
    try:
        mark_running(redis, request.report_id)

        temp_docs = fetch_temporary_financial_statements(request.report_id)
        merged = _merge_temp_docs(temp_docs)
        if not merged["years"]:
            extraction_failure = get_json(redis, f"report:{request.report_id}:extraction_failure", default={})
            extraction_coverage = get_json(redis, f"report:{request.report_id}:extraction_coverage", default={})
            meta = get_json(redis, f"report:{request.report_id}:meta", default={})
            failure_report = {
                "status": "extraction_failed",
                "report_id": request.report_id,
                "pdfs_processed": int(meta.get("document_count", 0) or extraction_coverage.get("pdfs_processed", 0) or len(temp_docs)),
                "years_detected": extraction_failure.get("years_detected", extraction_coverage.get("years_detected", [])),
                "metrics_extracted_count": int(extraction_failure.get("metrics_extracted_count", extraction_coverage.get("metrics_extracted_count", 0) or 0)),
                "missing_required_metrics": [
                    "balance_sheet.total_assets",
                    "balance_sheet.total_liabilities",
                    "balance_sheet.total_equity",
                    "income_statement.revenue_or_interest_income",
                    "income_statement.net_profit",
                ],
                "document_errors": extraction_failure.get("document_errors", []),
            }
            raise HTTPException(status_code=422, detail=failure_report)

        canonical_raw = _canonical_raw_from_merged(request.report_id, merged)
        set_json(redis, f"report:{request.report_id}:canonical_raw", canonical_raw.model_dump(), cfg.redis_ttl_seconds)
        issues = []
        issues.extend(validate_schema(canonical_raw))
        issues.extend(validate_accounting(canonical_raw))
        issues.extend(validate_cross_statement(canonical_raw))
        issues.extend(detect_anomalies(canonical_raw))

        corrected = run_self_correction_loop(canonical_raw, issues)
        checks, check_issues = validate_accounting(corrected, with_checks=True)
        issues.extend(check_issues)

        validated = save_canonical_validated(redis, request.report_id, corrected, checks, issues, cfg.redis_ttl_seconds)

        required_coverage_by_year = {
            y: int(merged["financials"].get(y, {}).get("required_metrics_count", 0))
            for y in merged["years"]
        }
        ratio_eligible_years = [y for y, count in required_coverage_by_year.items() if count >= 5]

        if ratio_eligible_years:
            ratios = compute_ratios(validated)
            ratios["gating"] = {
                "status": "executed",
                "ratio_eligible_years": ratio_eligible_years,
                "required_metric_coverage_by_year": required_coverage_by_year,
            }
        else:
            ratios = {
                "status": "blocked",
                "reason": "ratio_gate_failed",
                "required_metric_coverage_by_year": required_coverage_by_year,
                "ratio_eligible_years": [],
                "detected_years": merged["years"],
                "limitations": {
                    "blocked_message": "Ratio engine blocked because each year requires Total Assets, Total Liabilities, Equity, Net Profit, and Revenue/Interest Income",
                },
            }

        kpis = compute_kpis(validated)

        if ratios.get("status") == "blocked":
            patterns = [
                "Ratio analysis blocked due to insufficient required metric coverage",
                "Trend analysis limited due to available data scope",
            ]
        else:
            patterns = compute_patterns(validated, issues, ratios)

        ratio_coverage = _latest_ratio_coverage(ratios) if ratios.get("status") != "blocked" else 0.0
        if ratio_coverage >= 0.25:
            risk = compute_risk_signals(ratios)
            risk["gating"] = {"status": "executed", "ratio_coverage": ratio_coverage}
        else:
            risk = {
                "status": "blocked",
                "reason": "risk_gate_failed",
                "required_ratio_coverage": 0.25,
                "actual_ratio_coverage": ratio_coverage,
            }

        if ratio_coverage >= 0.50:
            sector = compare_sector(ratios)
            sector["gating"] = {"status": "executed", "ratio_coverage": ratio_coverage}
        else:
            sector = {
                "status": "blocked",
                "reason": "sector_gate_failed",
                "required_ratio_coverage": 0.50,
                "actual_ratio_coverage": ratio_coverage,
            }

        confidence = compute_confidence(issues, ratios, kpis)
        extraction_coverage = get_json(redis, f"report:{request.report_id}:extraction_coverage", default={})
        confidence["extraction_confidence"] = float(extraction_coverage.get("avg_extraction_confidence", 0.0) or 0.0)
        confidence["metrics_extracted_count"] = int(extraction_coverage.get("metrics_extracted_count", 0) or 0)
        confidence["detected_years"] = merged["years"]

        save_analytics(redis, request.report_id, ratios, patterns, confidence, sector, risk, cfg.redis_ttl_seconds)

        numeric_years = [y for y in merged["years"] if isinstance(y, str) and y.isdigit()]
        meta = get_json(redis, f"report:{request.report_id}:meta", default={})
        metrics_coverage = {
            "required_metric_coverage_by_year": required_coverage_by_year,
            "ratio_coverage": ratio_coverage,
            "ratio_engine": "executed" if ratios.get("status") != "blocked" else "blocked",
            "risk_engine": "executed" if risk.get("status") != "blocked" else "blocked",
            "sector_comparison": "executed" if sector.get("status") != "blocked" else "blocked",
        }
        set_json(redis, f"report:{request.report_id}:analysis_coverage", metrics_coverage, cfg.redis_ttl_seconds)

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
            "analysis_limited": _trend_limitations(len(numeric_years)) + ([] if ratios.get("status") != "blocked" else ["Ratio analysis blocked due to required metric gate"]) + ([] if risk.get("status") != "blocked" else ["Risk analysis blocked due to ratio coverage below 25%"]) + ([] if sector.get("status") != "blocked" else ["Sector comparison blocked due to ratio coverage below 50%"]),
        }

        mark_success(redis, request.report_id)
        return {
            "status": "completed",
            "report_id": request.report_id,
            "validation_issues": len(issues),
            "reextraction_required": validated.reextraction_required,
            "detected_years": numeric_years,
            "transparency": transparency,
            "metrics_coverage": metrics_coverage,
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
