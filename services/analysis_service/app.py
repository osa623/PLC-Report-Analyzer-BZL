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
from platform_core.contracts.canonical_dataset import CanonicalRawReport, ValidationIssue
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

    def merge_section(base: dict[str, Any], incoming: dict[str, Any], confidence: float, source_file: str) -> dict[str, Any]:
        out = dict(base)
        src_conf = out.get("_source_confidence") if isinstance(out.get("_source_confidence"), dict) else {}
        src_file = out.get("_source_file") if isinstance(out.get("_source_file"), dict) else {}

        for key, value in incoming.items():
            if key.startswith("_"):
                continue
            if not isinstance(value, (int, float)):
                continue
            current = out.get(key)
            current_conf = src_conf.get(key, -1.0)
            if current is None or not isinstance(current, (int, float)) or confidence > current_conf:
                out[key] = float(value)
                src_conf[key] = float(confidence)
                src_file[key] = source_file

        out["_source_confidence"] = src_conf
        out["_source_file"] = src_file
        return out

    for doc in temp_docs:
        year = str(doc.get("year")) if doc.get("year") is not None else ""
        if not year.isdigit():
            continue
        source_file = str(doc.get("source_file") or "")
        extraction_confidence = float(doc.get("extraction_confidence", 0.0) or 0.0)
        candidate = {
            "balance_sheet": doc.get("balance_sheet") if isinstance(doc.get("balance_sheet"), dict) else {},
            "income_statement": doc.get("income_statement") if isinstance(doc.get("income_statement"), dict) else {},
            "cashflow_statement": doc.get("cashflow_statement") if isinstance(doc.get("cashflow_statement"), dict) else {},
            "equity_statement": doc.get("equity_statement") if isinstance(doc.get("equity_statement"), dict) else {},
            "source_file": doc.get("source_file"),
            "metrics_extracted_count": int(doc.get("metrics_extracted_count", 0)),
            "extraction_confidence": extraction_confidence,
            "extraction_agreement_score": float(doc.get("extraction_agreement_score", 0.0) or 0.0),
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
        if not current:
            by_year[year] = candidate
            continue

        current_bs = current.get("balance_sheet") if isinstance(current.get("balance_sheet"), dict) else {}
        current_inc = current.get("income_statement") if isinstance(current.get("income_statement"), dict) else {}
        current_cf = current.get("cashflow_statement") if isinstance(current.get("cashflow_statement"), dict) else {}
        current_eq = current.get("equity_statement") if isinstance(current.get("equity_statement"), dict) else {}

        merged_bs = merge_section(current_bs, candidate["balance_sheet"], extraction_confidence, source_file)
        merged_inc = merge_section(current_inc, candidate["income_statement"], extraction_confidence, source_file)
        merged_cf = merge_section(current_cf, candidate["cashflow_statement"], extraction_confidence, source_file)
        merged_eq = merge_section(current_eq, candidate["equity_statement"], extraction_confidence, source_file)

        merged_candidate = dict(current)
        merged_candidate["balance_sheet"] = merged_bs
        merged_candidate["income_statement"] = merged_inc
        merged_candidate["cashflow_statement"] = merged_cf
        merged_candidate["equity_statement"] = merged_eq
        merged_candidate["metrics_extracted_count"] = max(
            int(current.get("metrics_extracted_count", 0)),
            candidate["metrics_extracted_count"],
        )
        merged_candidate["extraction_confidence"] = max(
            float(current.get("extraction_confidence", 0.0) or 0.0),
            extraction_confidence,
        )
        merged_candidate["required_metrics_count"] = max(
            int(current.get("required_metrics_count", 0)),
            candidate["required_metrics_count"],
        )
        merged_candidate["source_file"] = current.get("source_file") or source_file
        by_year[year] = merged_candidate

    return {
        "years": sorted(by_year.keys()),
        "financials": by_year,
    }


def _canonical_raw_from_merged(report_id: str, merged: dict[str, Any]) -> CanonicalRawReport:
    income_statement: list[dict[str, Any]] = []
    balance_sheet: list[dict[str, Any]] = []
    cashflow: list[dict[str, Any]] = []
    equity: list[dict[str, Any]] = []

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
        add(income_statement, "Profit Before Tax", inc.get("profit_before_tax"), year)
        add(income_statement, "Interest Expense", inc.get("interest_expense"), year)
        add(income_statement, "Net Income", inc.get("net_profit"), year)

        add(cashflow, "Operating Cash Flow", cf.get("operating_cash_flow"), year)
        add(cashflow, "Investing Cash Flow", cf.get("investing_cash_flow"), year)
        add(cashflow, "Financing Cash Flow", cf.get("financing_cash_flow"), year)
        add(cashflow, "Net Cash Flow", cf.get("net_cash_change"), year)
        add(cashflow, "Opening Cash", cf.get("opening_cash"), year)
        add(cashflow, "Closing Cash", cf.get("closing_cash"), year)
        add(cashflow, "Net Income", cf.get("net_income"), year)

        eq = entry.get("equity_statement") if isinstance(entry.get("equity_statement"), dict) else {}
        add(equity, "Net Income", eq.get("net_income"), year)
        add(equity, "Change in Retained Earnings", eq.get("change_in_retained_earnings"), year)

    return CanonicalRawReport(
        report_id=report_id,
        financial_statements={
            "income_statement": income_statement,
            "balance_sheet": balance_sheet,
            "cashflow": cashflow,
            "equity": equity,
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


def _safe_rel_diff(a: float, b: float) -> float:
    denom = max(abs(a), abs(b), 1.0)
    return abs(a - b) / denom


def _hard_validation_gates(merged: dict[str, Any]) -> dict[str, Any]:
    gate_results: dict[str, Any] = {
        "gate_1_minimum_statement_completeness": True,
        "gate_2_accounting_identity": True,
        "gate_3_cash_reconciliation": True,
        "gate_4_net_income_linkage": True,
        "gate_5_multi_year_requirement": True,
    }
    failures: list[str] = []

    years = [y for y in merged.get("years", []) if isinstance(y, str) and y.isdigit()]
    if len(years) < 2:
        gate_results["gate_5_multi_year_requirement"] = False
        failures.append("multi_year_requirement_failed")

    for year in merged.get("years", []):
        entry = merged.get("financials", {}).get(year, {})
        bs = entry.get("balance_sheet") if isinstance(entry.get("balance_sheet"), dict) else {}
        inc = entry.get("income_statement") if isinstance(entry.get("income_statement"), dict) else {}
        cf = entry.get("cashflow_statement") if isinstance(entry.get("cashflow_statement"), dict) else {}
        eq = entry.get("equity_statement") if isinstance(entry.get("equity_statement"), dict) else {}

        # Gate 1: minimum statement completeness.
        g1_ok = all(
            isinstance(v, (int, float))
            for v in [
                inc.get("revenue_or_interest_income"),
                inc.get("operating_profit"),
                inc.get("net_profit"),
                bs.get("total_assets"),
                bs.get("total_liabilities"),
                bs.get("total_equity"),
                cf.get("operating_cash_flow"),
                cf.get("closing_cash"),
            ]
        )
        if not g1_ok:
            gate_results["gate_1_minimum_statement_completeness"] = False
            failures.append(f"minimum_completeness_failed_{year}")

        # Gate 2: accounting identity with 3% tolerance.
        a = bs.get("total_assets")
        l = bs.get("total_liabilities")
        e = bs.get("total_equity")
        if all(isinstance(v, (int, float)) for v in [a, l, e]):
            if _safe_rel_diff(float(a), float(l) + float(e)) > 0.03:
                gate_results["gate_2_accounting_identity"] = False
                failures.append(f"accounting_identity_failed_{year}")
        else:
            gate_results["gate_2_accounting_identity"] = False
            failures.append(f"accounting_identity_missing_{year}")

        # Gate 3: cash reconciliation.
        oc = cf.get("opening_cash")
        nc = cf.get("net_cash_change")
        cc = cf.get("closing_cash")
        if all(isinstance(v, (int, float)) for v in [oc, nc, cc]):
            if _safe_rel_diff(float(oc) + float(nc), float(cc)) > 0.03:
                gate_results["gate_3_cash_reconciliation"] = False
                failures.append(f"cash_reconciliation_failed_{year}")
        else:
            gate_results["gate_3_cash_reconciliation"] = False
            failures.append(f"cash_reconciliation_missing_{year}")

        # Gate 4: net income linkage (income, cashflow, equity).
        ni_inc = inc.get("net_profit")
        ni_cf = cf.get("net_income")
        ni_eq = eq.get("net_income") if isinstance(eq.get("net_income"), (int, float)) else eq.get("change_in_retained_earnings")
        if all(isinstance(v, (int, float)) for v in [ni_inc, ni_cf, ni_eq]):
            if _safe_rel_diff(float(ni_inc), float(ni_cf)) > 0.03 or _safe_rel_diff(float(ni_inc), float(ni_eq)) > 0.03:
                gate_results["gate_4_net_income_linkage"] = False
                failures.append(f"net_income_linkage_failed_{year}")
        else:
            gate_results["gate_4_net_income_linkage"] = False
            failures.append(f"net_income_linkage_missing_{year}")

    all_passed = all(bool(v) for v in gate_results.values())
    return {
        "all_passed": all_passed,
        "gates": gate_results,
        "failures": failures,
    }


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
        set_json(redis, f"report:{request.report_id}:raw_extracted_values", {"documents": temp_docs}, cfg.redis_ttl_seconds)
        set_json(redis, f"report:{request.report_id}:normalized_values", merged, cfg.redis_ttl_seconds)
        set_json(redis, f"report:{request.report_id}:reconstructed_statements", canonical_raw.model_dump(), cfg.redis_ttl_seconds)
        set_json(redis, f"report:{request.report_id}:canonical_raw", canonical_raw.model_dump(), cfg.redis_ttl_seconds)

        hard_validation = _hard_validation_gates(merged)
        issues = []
        issues.extend(validate_schema(canonical_raw))
        issues.extend(validate_accounting(canonical_raw))
        issues.extend(validate_cross_statement(canonical_raw))
        issues.extend(detect_anomalies(canonical_raw))

        if not hard_validation.get("all_passed"):
            for failure in hard_validation.get("failures", []):
                issues.append(
                    ValidationIssue(
                        code="HARD_VALIDATION_GATE_FAILED",
                        message=str(failure),
                        severity="error",
                    )
                )

        corrected = run_self_correction_loop(canonical_raw, issues)
        checks, check_issues = validate_accounting(corrected, with_checks=True)
        issues.extend(check_issues)

        validated = save_canonical_validated(redis, request.report_id, corrected, checks, issues, cfg.redis_ttl_seconds)

        required_coverage_by_year = {
            y: int(merged["financials"].get(y, {}).get("required_metrics_count", 0))
            for y in merged["years"]
        }
        ratio_eligible_years = [y for y, count in required_coverage_by_year.items() if count >= 5]

        restricted_mode = not bool(hard_validation.get("all_passed"))

        if ratio_eligible_years:
            ratios = compute_ratios(validated)
            ratios["gating"] = {
                "status": "restricted" if restricted_mode else "executed",
                "ratio_eligible_years": ratio_eligible_years,
                "required_metric_coverage_by_year": required_coverage_by_year,
                "hard_validation": hard_validation,
            }
            if restricted_mode:
                ratios["status"] = "restricted"
                ratios["reason"] = "hard_validation_failed"
        else:
            ratios = {
                "status": "blocked",
                "reason": "ratio_gate_failed",
                "required_metric_coverage_by_year": required_coverage_by_year,
                "ratio_eligible_years": [],
                "detected_years": merged["years"],
                "gating": {
                    "hard_validation": hard_validation,
                },
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
        elif restricted_mode:
            patterns = [
                "Hard validation gates failed; analytics restricted to ratio-only diagnostics",
                *[str(x) for x in hard_validation.get("failures", [])],
            ]
        else:
            patterns = compute_patterns(validated, issues, ratios)

        ratio_coverage = _latest_ratio_coverage(ratios) if ratios.get("status") != "blocked" else 0.0
        if restricted_mode:
            risk = {
                "status": "blocked",
                "reason": "risk_model_disabled_due_to_hard_validation_failure",
                "hard_validation": hard_validation,
            }
        elif ratio_coverage >= 0.25:
            risk = compute_risk_signals(ratios)
            risk["gating"] = {"status": "executed", "ratio_coverage": ratio_coverage}
        else:
            risk = {
                "status": "blocked",
                "reason": "risk_gate_failed",
                "required_ratio_coverage": 0.25,
                "actual_ratio_coverage": ratio_coverage,
            }

        if restricted_mode:
            sector = {
                "status": "blocked",
                "reason": "sector_model_disabled_due_to_hard_validation_failure",
                "hard_validation": hard_validation,
            }
        elif ratio_coverage >= 0.50:
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
        confidence["extraction_agreement_score"] = float(extraction_coverage.get("avg_extraction_agreement", 0.0) or 0.0)
        confidence["re_extraction_attempts_average"] = float(extraction_coverage.get("avg_re_extraction_attempts", 1.0) or 1.0)
        confidence["metrics_extracted_count"] = int(extraction_coverage.get("metrics_extracted_count", 0) or 0)
        confidence["detected_years"] = merged["years"]
        confidence["hard_validation"] = hard_validation
        if restricted_mode:
            confidence["score"] = min(float(confidence.get("score", 0.0) or 0.0), 0.25)
            confidence["band"] = "low"

        save_analytics(redis, request.report_id, ratios, patterns, confidence, sector, risk, cfg.redis_ttl_seconds)

        numeric_years = [y for y in merged["years"] if isinstance(y, str) and y.isdigit()]
        meta = get_json(redis, f"report:{request.report_id}:meta", default={})
        metrics_coverage = {
            "required_metric_coverage_by_year": required_coverage_by_year,
            "ratio_coverage": ratio_coverage,
            "ratio_engine": "restricted" if restricted_mode else ("executed" if ratios.get("status") != "blocked" else "blocked"),
            "risk_engine": "executed" if risk.get("status") != "blocked" else "blocked",
            "sector_comparison": "executed" if sector.get("status") != "blocked" else "blocked",
            "hard_validation": hard_validation,
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
        if restricted_mode:
            transparency["analysis_limited"].append("Hard validation gates failed; advanced analytics disabled and output restricted to available ratios")

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
