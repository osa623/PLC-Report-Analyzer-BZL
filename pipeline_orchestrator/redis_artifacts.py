"""Redis artifact-saving logic for the pipeline orchestrator.

Replicates the side effects of the analysis and reporting service HTTP
endpoints so the Node backend / frontend can read pipeline results from Redis.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from platform_core.contracts.canonical_dataset import (
    CanonicalRawReport,
    DeterministicChecks,
    ValidationIssue,
)
from platform_core.shared_infra.redis_client import set_json


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def save_extraction_artifacts(
    redis_client,
    report_id: str,
    strict_extraction: dict[str, Any],
    ttl: int,
) -> None:
    """Save extraction outputs to Redis so downstream consumers can read them."""
    set_json(redis_client, f"report:{report_id}:strict_extraction", strict_extraction, ttl)
    canonical_raw = _build_canonical_raw(report_id, strict_extraction)
    set_json(redis_client, f"report:{report_id}:canonical_raw", canonical_raw.model_dump(), ttl)


def save_analysis_artifacts(
    redis_client,
    report_id: str,
    strict_extraction: dict[str, Any],
    strict_analysis: dict[str, Any],
    ttl: int,
) -> None:
    """Save analysis outputs to Redis."""
    set_json(redis_client, f"report:{report_id}:strict_analysis", strict_analysis, ttl)

    canonical_raw = _build_canonical_raw(report_id, strict_extraction)
    issues = _build_validation_issues(strict_analysis)
    checks = _build_deterministic_checks(strict_extraction, strict_analysis)

    # canonical_validated
    from services.analysis_service.storage.canonical_validated_repository import save_canonical_validated
    save_canonical_validated(redis_client, report_id, canonical_raw, checks, issues, ttl)

    # confidence
    confidence = _build_confidence(strict_extraction, strict_analysis, issues)
    set_json(redis_client, f"report:{report_id}:confidence", confidence, ttl)

    # analysis_coverage
    coverage = _build_analysis_coverage(strict_extraction, strict_analysis, issues)
    set_json(redis_client, f"report:{report_id}:analysis_coverage", coverage, ttl)

    # analytics (ratios, patterns, risk, sector) — only when valid years exist
    valid_years = [y for y in (strict_analysis.get("valid_years") or []) if isinstance(y, str)]
    if valid_years:
        ratios = _build_ratios(strict_extraction, strict_analysis, confidence)
        rejected = [y for y in (strict_analysis.get("rejected_years") or []) if isinstance(y, str)]
        patterns = _build_patterns(strict_analysis, valid_years, rejected)
        risk = _build_risk(strict_analysis)
        sector = {"sector": "diversified", "status": "report_only", "benchmarking": "not_enabled"}

        from services.analysis_service.storage.analytics_repository import save_analytics
        save_analytics(redis_client, report_id, ratios, patterns, confidence, sector, risk, ttl)


def save_report_artifacts(
    redis_client,
    report_id: str,
    report_result: dict[str, Any],
    ttl: int,
) -> None:
    """Save report outputs to Redis."""
    # Build a final_report envelope that the Node backend expects
    final_payload = {
        "report_id": report_id,
        "status": "completed",
        "strict_report": report_result,
    }
    set_json(redis_client, f"report:{report_id}:strict_report", report_result, ttl)

    from services.reporting_service.storage.final_report_repository import save_final_report
    save_final_report(redis_client, report_id, final_payload, ttl)


def save_pipeline_metadata(
    redis_client,
    report_id: str,
    pdf_paths: list,
    ttl: int,
) -> None:
    """Save pipeline metadata so the frontend recognises the upload."""
    if pdf_paths:
        redis_client.setex(f"report:{report_id}:uploaded_file", ttl, str(pdf_paths[0]))
        if len(pdf_paths) > 1:
            redis_client.setex(
                f"report:{report_id}:uploaded_files",
                ttl,
                json.dumps([str(p) for p in pdf_paths]),
            )
    meta = {
        "report_id": report_id,
        "document_count": len(pdf_paths),
        "source": "pipeline_orchestrator",
    }
    set_json(redis_client, f"report:{report_id}:meta", meta, ttl)


def update_document_status(
    redis_client,
    report_id: str,
    pdf_name: str,
    status: str,
    stage: str,
    ttl: int,
    message: str | None = None,
    error: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Track per-PDF document status in a Redis hash with an append-only UI event trail."""
    key = f"report:{report_id}:document_statuses"
    existing = {}
    try:
        raw = redis_client.hget(key, pdf_name)
        if raw:
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            existing = json.loads(raw)
    except Exception:
        existing = {}

    events = existing.get("messages") if isinstance(existing.get("messages"), list) else []
    if message or error:
        events = [
            *events[-49:],
            {
                "timestamp": datetime.now().isoformat(timespec="seconds"),
                "stage": stage,
                "status": status,
                "message": message or error,
                "level": "error" if error else "info",
            },
        ]

    doc = {
        **existing,
        "pdf_name": pdf_name,
        "status": status,
        "stage": stage,
        "message": message or existing.get("message"),
        "error": error or existing.get("error"),
        "messages": events,
    }
    if details:
        doc.update(details)

    redis_client.hset(key, pdf_name, json.dumps(doc))
    redis_client.expire(key, ttl)


# ---------------------------------------------------------------------------
# Internal helpers — mirror the pure functions in analysis_service/app.py
# ---------------------------------------------------------------------------

def _is_number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _strict_metric(section: Any, key: str) -> float | None:
    if not isinstance(section, dict):
        return None
    value = section.get(key)
    if key == "revenue":
        if not _is_number(value) or float(value) <= 0:
            value = section.get("total_operating_income")
        if not _is_number(value) or float(value) <= 0:
            value = section.get("net_interest_income")
    if key == "operating_cash_flow" and not _is_number(value):
        value = section.get("net_operating_cashflow")
    if key == "operating_cash_flow" and not _is_number(value):
        value = section.get("net_cash_flow")
    return float(value) if _is_number(value) else None


def _sorted_years(strict_extraction: dict[str, Any]) -> list[str]:
    years = strict_extraction.get("years") if isinstance(strict_extraction.get("years"), dict) else {}
    return sorted((y for y in years if isinstance(y, str) and y.isdigit()), key=int)


def _build_canonical_raw(report_id: str, strict_extraction: dict[str, Any]) -> CanonicalRawReport:
    inc_rows: list[dict[str, Any]] = []
    bs_rows: list[dict[str, Any]] = []
    cf_rows: list[dict[str, Any]] = []
    eq_rows: list[dict[str, Any]] = []
    currency = str(strict_extraction.get("currency") or "LKR")

    def _add(target, label, value, year):
        if _is_number(value):
            target.append({"label": label, "value": float(value), "period": year, "currency": currency})

    years = strict_extraction.get("years") if isinstance(strict_extraction.get("years"), dict) else {}
    for year in _sorted_years(strict_extraction):
        p = years.get(year) if isinstance(years.get(year), dict) else {}
        bs = p.get("balance_sheet") if isinstance(p.get("balance_sheet"), dict) else {}
        inc = p.get("income_statement") if isinstance(p.get("income_statement"), dict) else {}
        cf = p.get("cash_flow") if isinstance(p.get("cash_flow"), dict) else {}

        _add(bs_rows, "Total Assets", bs.get("total_assets"), year)
        _add(bs_rows, "Total Liabilities", bs.get("total_liabilities"), year)
        _add(bs_rows, "Total Equity", bs.get("total_equity"), year)
        _add(bs_rows, "Current Assets", bs.get("current_assets"), year)
        _add(bs_rows, "Current Liabilities", bs.get("current_liabilities"), year)
        _add(bs_rows, "Debt", bs.get("total_debt"), year)
        _add(bs_rows, "Cash and Equivalents", bs.get("cash_and_cash_equivalents"), year)

        _add(inc_rows, "Revenue", _strict_metric(inc, "revenue"), year)
        _add(inc_rows, "Cost of Revenue", inc.get("cost_of_sales"), year)
        _add(inc_rows, "Gross Profit", inc.get("gross_profit"), year)
        _add(inc_rows, "Operating Profit", inc.get("operating_profit"), year)
        _add(inc_rows, "Net Income", inc.get("net_profit"), year)

        _add(cf_rows, "Operating Cash Flow", _strict_metric(cf, "operating_cash_flow"), year)
        _add(cf_rows, "Investing Cash Flow", cf.get("investing_cash_flow"), year)
        _add(cf_rows, "Financing Cash Flow", cf.get("financing_cash_flow"), year)
        _add(cf_rows, "Net Cash Flow", cf.get("net_cash_flow"), year)
        _add(cf_rows, "Opening Cash", cf.get("opening_cash"), year)
        _add(cf_rows, "Closing Cash", cf.get("closing_cash"), year)

        _add(eq_rows, "Net Income", inc.get("net_profit"), year)
        _add(eq_rows, "Change in Retained Earnings", inc.get("net_profit"), year)

    return CanonicalRawReport(
        report_id=report_id,
        financial_statements={
            "income_statement": inc_rows,
            "balance_sheet": bs_rows,
            "cashflow": cf_rows,
            "equity": eq_rows,
        },
        narrative_sections={"notes": [], "risk": [], "governance": [], "esg": [], "segment": []},
    )


def _build_validation_issues(strict_analysis: dict[str, Any]) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    for flag in (strict_analysis.get("validation_flags") or []):
        if not isinstance(flag, dict):
            continue
        code = str(flag.get("code") or "validation_issue")
        year = str(flag.get("year") or "").strip()
        msg = str(flag.get("message") or "Validation issue")
        if year:
            msg = f"{year}: {msg}"
        issues.append(ValidationIssue(code=code, message=msg, severity=str(flag.get("severity") or "error")))

    if strict_analysis.get("status") == "VALIDATION_FAILED":
        for year, fields in (strict_analysis.get("missing_fields_by_year") or {}).items():
            if isinstance(year, str) and year.isdigit() and isinstance(fields, list) and fields:
                issues.append(ValidationIssue(
                    code="MINIMUM_COMPLETENESS_FAILED",
                    message=f"{year}: Missing required fields: {', '.join(str(f) for f in fields)}",
                    severity="error",
                ))
        for reason in (strict_analysis.get("reasons") or []):
            if isinstance(reason, str) and reason.strip():
                issues.append(ValidationIssue(code="VALIDATION_FAILED", message=reason.strip(), severity="error"))

    seen: set[tuple[str, str, str]] = set()
    deduped: list[ValidationIssue] = []
    for issue in issues:
        key = (issue.code, issue.message, issue.severity)
        if key not in seen:
            seen.add(key)
            deduped.append(issue)
    return deduped


def _build_deterministic_checks(strict_extraction: dict[str, Any], strict_analysis: dict[str, Any]) -> DeterministicChecks:
    flags = strict_analysis.get("validation_flags") or []
    failed_codes = {str(f.get("code")) for f in flags if isinstance(f, dict)}
    valid_years = strict_analysis.get("valid_years") or []
    years = strict_extraction.get("years") if isinstance(strict_extraction.get("years"), dict) else {}

    ni_linkage = bool(valid_years)
    for y in valid_years:
        p = years.get(y) if isinstance(years.get(y), dict) else {}
        inc = p.get("income_statement") if isinstance(p.get("income_statement"), dict) else {}
        if _strict_metric(inc, "net_profit") is None:
            ni_linkage = False
            break

    return DeterministicChecks(
        balance_sheet_identity="BALANCE_SHEET_EQUATION_FAILED" not in failed_codes,
        cash_reconciliation="CASH_RECONCILIATION_FAILED" not in failed_codes,
        net_income_linkage=ni_linkage,
    )


def _build_confidence(strict_extraction: dict[str, Any], strict_analysis: dict[str, Any], issues: list[ValidationIssue]) -> dict[str, Any]:
    years = strict_extraction.get("years") if isinstance(strict_extraction.get("years"), dict) else {}
    total = len([y for y in years if isinstance(y, str) and y.isdigit()])
    valid = strict_analysis.get("valid_years") or []
    ext_scores = []
    for yp in years.values():
        if isinstance(yp, dict) and _is_number(yp.get("extraction_confidence")):
            ext_scores.append(float(yp["extraction_confidence"]) / 100.0)

    year_acceptance = (len(valid) / float(total)) if total else 0.0
    avg_ext = (sum(ext_scores) / float(len(ext_scores))) if ext_scores else 0.0
    penalty = min(0.35, 0.04 * len(issues))
    score = max(0.0, min(1.0, 0.6 * year_acceptance + 0.4 * avg_ext - penalty))
    band = "high" if score >= 0.8 else "moderate" if score >= 0.5 else "low"
    return {
        "score": round(score, 4),
        "raw_score": round(score, 4),
        "overall_data_quality_score": round(score, 4),
        "band": band,
        "valid_years": list(valid),
        "rejected_years": list(strict_analysis.get("rejected_years") or []),
    }


def _growth_or_none(cur: float | None, prev: float | None) -> float | None:
    if cur is None or prev is None or abs(prev) <= 1e-12:
        return None
    return round((cur - prev) / abs(prev), 6)


def _build_ratios(strict_extraction: dict[str, Any], strict_analysis: dict[str, Any], confidence: dict[str, Any]) -> dict[str, Any]:
    years = strict_extraction.get("years") if isinstance(strict_extraction.get("years"), dict) else {}
    valid = sorted([y for y in (strict_analysis.get("valid_years") or []) if isinstance(y, str) and y in years], key=int)
    financial_ratios = strict_analysis.get("yearly_ratios") if isinstance(strict_analysis.get("yearly_ratios"), dict) else {}
    if not financial_ratios:
        financial_ratios = strict_analysis.get("financial_ratios") if isinstance(strict_analysis.get("financial_ratios"), dict) else {}
    by_year: dict[str, dict[str, Any]] = {}

    def _ratio_value(ratio_map: dict[str, Any], *names: str) -> float | None:
        for name in names:
            item = ratio_map.get(name)
            if isinstance(item, dict) and _is_number(item.get("value")):
                return float(item["value"])
            if _is_number(item):
                return float(item)
        return None

    for idx, year in enumerate(valid):
        p = years.get(year) if isinstance(years.get(year), dict) else {}
        ratios = financial_ratios.get(year, {}) if isinstance(financial_ratios.get(year), dict) else {}
        inc = p.get("income_statement") if isinstance(p.get("income_statement"), dict) else {}
        bs = p.get("balance_sheet") if isinstance(p.get("balance_sheet"), dict) else {}
        cf = p.get("cash_flow") if isinstance(p.get("cash_flow"), dict) else {}

        rev = _strict_metric(inc, "revenue")
        np_ = _strict_metric(inc, "net_profit")
        ta = _strict_metric(bs, "total_assets")
        tl = _strict_metric(bs, "total_liabilities")
        te = _strict_metric(bs, "total_equity")
        ocf = _strict_metric(cf, "operating_cash_flow")
        icf = _strict_metric(cf, "investing_cash_flow")
        fcf = _strict_metric(cf, "financing_cash_flow")
        tcf = None
        if None not in (ocf, icf, fcf):
            tcf = float(ocf) + float(icf) + float(fcf)

        prev_year = valid[idx - 1] if idx > 0 else None
        prev_p = years.get(prev_year) if prev_year and isinstance(years.get(prev_year), dict) else {}
        prev_inc = prev_p.get("income_statement") if isinstance(prev_p.get("income_statement"), dict) else {}

        by_year[year] = {
            "revenue": rev,
            "net_income": np_,
            "gross_profit_margin": _ratio_value(ratios, "Gross Margin"),
            "operating_margin": _ratio_value(ratios, "Operating Margin", "EBIT Margin"),
            "net_profit_margin": _ratio_value(ratios, "Net Profit Margin", "Net Margin"),
            "return_on_equity": _ratio_value(ratios, "ROE", "Return on Equity (ROE)"),
            "return_on_assets": _ratio_value(ratios, "ROA", "Return on Assets (ROA)"),
            "current_ratio": _ratio_value(ratios, "Current Ratio"),
            "quick_ratio": _ratio_value(ratios, "Quick Ratio"),
            "cash_ratio": _ratio_value(ratios, "Cash Ratio"),
            "debt_to_equity": _ratio_value(ratios, "Debt to Equity"),
            "debt_ratio": _ratio_value(ratios, "Debt Ratio"),
            "interest_coverage": _ratio_value(ratios, "Interest Coverage"),
            "asset_turnover": _ratio_value(ratios, "Asset Turnover"),
            "inventory_turnover": _ratio_value(ratios, "Inventory Turnover"),
            "receivables_turnover": _ratio_value(ratios, "Receivables Turnover"),
            "ocf_ratio": _ratio_value(ratios, "OCF Ratio"),
            "cash_flow_to_net_income": _ratio_value(ratios, "Cash Flow to Net Income"),
            "free_cash_flow": _ratio_value(ratios, "Free Cash Flow"),
            "revenue_growth_yoy": _growth_or_none(rev, _strict_metric(prev_inc, "revenue")),
            "net_profit_growth_yoy": _growth_or_none(np_, _strict_metric(prev_inc, "net_profit")),
            "operating_cash_flow": ocf,
            "total_assets": ta,
            "total_liabilities": tl,
            "total_equity": te,
            "total_cash_flow": tcf,
        }

    latest_year = valid[-1] if valid else None
    latest = by_year.get(latest_year, {}) if latest_year else {}
    prev_period = valid[-2] if len(valid) >= 2 else None

    return {
        **latest,
        "by_year": by_year,
        "detected_years": valid,
        "latest_year": latest_year,
        "latest_growth_snapshot": {
            "period": latest_year,
            "previous_period": prev_period,
            "revenue_growth_yoy": latest.get("revenue_growth_yoy"),
            "net_profit_growth_yoy": latest.get("net_profit_growth_yoy"),
        },
        "data_quality_score": confidence.get("score"),
        "data_coverage": {
            "valid_years": valid,
            "rejected_years": list(strict_analysis.get("rejected_years") or []),
        },
        "data_reliability_report": {
            "score": round(float(confidence.get("score", 0.0) or 0.0) * 100.0, 2),
            "band": confidence.get("band"),
        },
        "strict_calculations": {
            "yearly_ratios": strict_analysis.get("yearly_ratios", {}),
            "growth_metrics": strict_analysis.get("growth_metrics", {}),
            "validation_gates": strict_analysis.get("validation_gates", {}),
            "evaluated_equations_by_year": strict_analysis.get("evaluated_equations_by_year", {}),
            "scores": strict_analysis.get("scores", {}),
        },
    }


def _build_patterns(strict_analysis: dict[str, Any], valid_years: list[str], rejected_years: list[str]) -> list[str]:
    patterns: list[str] = []
    if rejected_years:
        patterns.append("Validation friction detected")
        patterns.append("One or more reporting years were rejected by deterministic gates")
    if len(valid_years) >= 2:
        patterns.append("Consistent multi-year validation coverage available")
    elif len(valid_years) == 1:
        patterns.append("Trend analysis limited due to single reporting year")
    else:
        patterns.append("No validated years are available for analytics")

    for flag in (strict_analysis.get("validation_flags") or []):
        if not isinstance(flag, dict):
            continue
        code = str(flag.get("code") or "")
        if code == "MULTI_YEAR_CONTINUITY_FAILED":
            patterns.append("Multi-year continuity anomaly detected")
        if code == "BALANCE_SHEET_EQUATION_FAILED":
            patterns.append("Balance sheet consistency issue detected")
        if code == "CASH_RECONCILIATION_FAILED":
            patterns.append("Cash reconciliation issue detected")

    return list(dict.fromkeys(patterns))  # deduplicate preserving order


def _build_risk(strict_analysis: dict[str, Any]) -> dict[str, Any]:
    fhs = float(strict_analysis.get("financial_health_score", 0.0) or 0.0)
    risk_score = round(max(0.0, 100.0 - fhs), 2)
    level = "high" if risk_score >= 66.0 else "moderate" if risk_score >= 33.0 else "low"
    risk_flags = []
    for flag in (strict_analysis.get("validation_flags") or []):
        if isinstance(flag, dict) and isinstance(flag.get("message"), str):
            risk_flags.append(str(flag["message"]))
    return {
        "overall_risk_score": risk_score,
        "overall_risk_level": level,
        "risk_flags": risk_flags,
        "final_financial_health_score": round(fhs, 2),
    }


def _build_analysis_coverage(strict_extraction: dict[str, Any], strict_analysis: dict[str, Any], issues: list[ValidationIssue]) -> dict[str, Any]:
    detected = _sorted_years(strict_extraction)
    valid = [y for y in (strict_analysis.get("valid_years") or []) if isinstance(y, str)]
    rejected = [y for y in (strict_analysis.get("rejected_years") or []) if isinstance(y, str)]
    codes = {issue.code for issue in issues}
    return {
        "detected_years": detected,
        "valid_years": valid,
        "rejected_years": rejected,
        "validation_issue_count": len(issues),
        "metrics_coverage": {
            "years_detected": len(detected),
            "years_accepted": len(valid),
            "years_rejected": len(rejected),
            "hard_validation": {
                "status": "passed" if not issues else "failed",
                "gates": {
                    "minimum_completeness": "MINIMUM_COMPLETENESS_FAILED" not in codes,
                    "balance_sheet_identity": "BALANCE_SHEET_EQUATION_FAILED" not in codes,
                    "cash_reconciliation": "CASH_RECONCILIATION_FAILED" not in codes,
                    "multi_year_continuity": "MULTI_YEAR_CONTINUITY_FAILED" not in codes,
                },
                "failures": [issue.code for issue in issues],
            },
        },
    }
