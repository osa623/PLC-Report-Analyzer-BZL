from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from typing import Any
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .analytics.canonical_calculation_engine import compute_analysis_result
from .analytics.kpi_engine import compute_kpis
from .analytics.pattern_engine import compute_patterns
from .analytics.ratio_engine import compute_ratios
from .analytics.risk_engine import compute_risk_signals
from .analytics.sector_comparison import compare_sector
from .confidence.confidence_score import compute_confidence
from .config import get_config
from .redis_client import get_redis
from .strict_pipeline import build_strict_analysis_result, build_validation_failed_diagnostic
from .storage.analytics_repository import save_analytics
from .storage.canonical_validated_repository import save_canonical_validated
from .validation.accounting_validator import validate_accounting
from .validation.anomaly_detector import detect_anomalies
from .validation.cross_statement_validator import validate_cross_statement
from .validation.schema_validator import validate_schema
from .validation.self_correction_loop import run_self_correction_loop
from .workflow.job_status_tracker import mark_failed, mark_running, mark_success
from platform_core.contracts import FinancialStatementModel, deterministic_hash_id
from platform_core.contracts.canonical_dataset import CanonicalRawReport, DeterministicChecks, ValidationIssue
from platform_core.shared_infra.redis_client import get_json, set_json
from platform_core.temp_financial_repository import fetch_temporary_financial_statements

app = FastAPI(title="analysis-service", version="1.0.0")
cfg = get_config()
EXTRACTION_SERVICE_URL = os.getenv("EXTRACTION_SERVICE_URL", "http://localhost:8001")
DEEP_AUDIT_REEXTRACT_KEY = "deep_audit_second_pass"


class AnalyzeRequest(BaseModel):
    report_id: str
    dataset_id: str | None = None
    schema_version: str | None = None
    calculation_version: str | None = None
    timestamp: str | None = None


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


def _safe_rel_diff_optional(a: Any, b: Any) -> float | None:
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        return None
    return _safe_rel_diff(float(a), float(b))


def _median(values: list[float]) -> float | None:
    if not values:
        return None
    vals = sorted(values)
    n = len(vals)
    mid = n // 2
    if n % 2 == 1:
        return vals[mid]
    return (vals[mid - 1] + vals[mid]) / 2.0


REQUIRED_CHART_METRIC_KEYS: list[str] = [
    "revenue",
    "net_income",
    "gross_profit_margin",
    "net_profit_margin",
    "return_on_equity",
    "return_on_assets",
    "debt_to_equity",
    "current_ratio",
    "total_assets",
    "total_liabilities",
    "total_equity",
    "total_cash_flow",
]


def _sorted_numeric_years(years: list[Any]) -> list[str]:
    clean = sorted({str(y) for y in years if isinstance(y, str) and y.isdigit()}, key=lambda y: int(y))
    return clean


def _empty_chart_metric_map() -> dict[str, Any]:
    return {key: None for key in REQUIRED_CHART_METRIC_KEYS}


def _enforce_analysis_years_on_ratios(ratios: dict[str, Any], analysis_years: list[str]) -> dict[str, Any]:
    out = dict(ratios) if isinstance(ratios, dict) else {}
    years = _sorted_numeric_years(analysis_years)
    by_year = out.get("by_year") if isinstance(out.get("by_year"), dict) else {}
    normalized_by_year: dict[str, dict[str, Any]] = {}

    for year in years:
        src = by_year.get(year) if isinstance(by_year.get(year), dict) else {}
        row = _empty_chart_metric_map()
        if isinstance(src, dict):
            row.update(src)
        if not isinstance(row.get("net_income"), (int, float)) and isinstance(row.get("net_profit"), (int, float)):
            row["net_income"] = row.get("net_profit")
        normalized_by_year[year] = row

    out["by_year"] = normalized_by_year
    out["detected_years"] = years
    if years:
        latest = out.get("latest_year")
        out["latest_year"] = latest if isinstance(latest, str) and latest in years else years[-1]
    else:
        out["latest_year"] = None

    reporting_periods = out.get("reporting_periods") if isinstance(out.get("reporting_periods"), dict) else {}
    reporting_periods["detected_periods"] = years
    reporting_periods["has_comparatives"] = len(years) >= 2
    out["reporting_periods"] = reporting_periods
    return out


def _normalize_year_scale(by_year: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Harmonize obvious unit/scale drift across years (e.g., raw vs thousands)."""
    adjustments: list[dict[str, Any]] = []
    metric_paths = [
        "balance_sheet.total_assets",
        "balance_sheet.total_liabilities",
        "balance_sheet.total_equity",
        "income_statement.revenue_or_interest_income",
        "income_statement.net_profit",
        "cashflow_statement.operating_cash_flow",
        "cashflow_statement.opening_cash",
        "cashflow_statement.net_cash_change",
        "cashflow_statement.closing_cash",
    ]

    for metric_path in metric_paths:
        section_name, field_name = metric_path.split(".", 1)
        observed: list[float] = []
        for year, payload in by_year.items():
            section = payload.get(section_name) if isinstance(payload.get(section_name), dict) else {}
            value = section.get(field_name)
            if isinstance(value, (int, float)) and abs(float(value)) > 0.0:
                observed.append(math.log10(abs(float(value))))

        target_log = _median(observed)
        if target_log is None:
            continue

        for year, payload in by_year.items():
            section = payload.get(section_name) if isinstance(payload.get(section_name), dict) else {}
            value = section.get(field_name)
            if not isinstance(value, (int, float)) or abs(float(value)) <= 0.0:
                continue

            raw = float(value)
            raw_dist = abs(math.log10(abs(raw)) - target_log)
            # Try common accounting scale corrections (thousand/million drift).
            candidates = [1.0, 1e2, 1e3, 1e4, 1e6, 1e-2, 1e-3, 1e-4, 1e-6]
            best = raw
            best_mult = 1.0
            best_dist = raw_dist
            for mult in candidates:
                cand = raw * mult
                if abs(cand) <= 0.0:
                    continue
                dist = abs(math.log10(abs(cand)) - target_log)
                if dist < best_dist:
                    best = cand
                    best_mult = mult
                    best_dist = dist

            # Require meaningful improvement and significant original mismatch.
            if best_mult != 1.0 and raw_dist >= 2.0 and (raw_dist - best_dist) >= 1.0:
                section[field_name] = best
                adjustments.append(
                    {
                        "year": year,
                        "metric": metric_path,
                        "from": raw,
                        "to": best,
                        "multiplier": best_mult,
                    }
                )

    return adjustments


def _stabilize_cross_statement_consistency(by_year: dict[str, dict[str, Any]]) -> list[str]:
    adjustments: list[str] = []
    for year, payload in by_year.items():
        bs = payload.get("balance_sheet") if isinstance(payload.get("balance_sheet"), dict) else {}
        inc = payload.get("income_statement") if isinstance(payload.get("income_statement"), dict) else {}
        cf = payload.get("cashflow_statement") if isinstance(payload.get("cashflow_statement"), dict) else {}
        eq = payload.get("equity_statement") if isinstance(payload.get("equity_statement"), dict) else {}

        a = bs.get("total_assets")
        l = bs.get("total_liabilities")
        e = bs.get("total_equity")
        if isinstance(a, (int, float)) and isinstance(l, (int, float)):
            implied_e = float(a) - float(l)
            if implied_e >= 0:
                if not isinstance(e, (int, float)):
                    bs["total_equity"] = implied_e
                    adjustments.append(f"{year}:equity_imputed_from_assets_minus_liabilities")
                elif _safe_rel_diff(float(e), implied_e) > 0.20:
                    bs["total_equity"] = implied_e
                    adjustments.append(f"{year}:equity_reconciled_to_balance_sheet_identity")

        ni = inc.get("net_profit")
        if isinstance(ni, (int, float)):
            cf_ni = cf.get("net_income")
            if not isinstance(cf_ni, (int, float)) or _safe_rel_diff(float(cf_ni), float(ni)) > 0.20:
                cf["net_income"] = float(ni)
                adjustments.append(f"{year}:cashflow_net_income_aligned_to_income_statement")

            eq_ni = eq.get("net_income")
            if not isinstance(eq_ni, (int, float)) or _safe_rel_diff(float(eq_ni), float(ni)) > 0.20:
                eq["net_income"] = float(ni)
                adjustments.append(f"{year}:equity_net_income_aligned_to_income_statement")

            eq_re = eq.get("change_in_retained_earnings")
            if not isinstance(eq_re, (int, float)) or _safe_rel_diff(float(eq_re), float(ni)) > 0.20:
                eq["change_in_retained_earnings"] = float(ni)
                adjustments.append(f"{year}:retained_earnings_change_aligned_to_income_statement")

    return adjustments


def _build_data_reliability_report(merged: dict[str, Any], hard_validation: dict[str, Any], issues: list[ValidationIssue]) -> dict[str, Any]:
    score = 100.0
    gates = hard_validation.get("gates") if isinstance(hard_validation.get("gates"), dict) else {}
    gate_failures = [k for k, v in gates.items() if not bool(v)]
    score -= 12.0 * len(gate_failures)

    error_issues = [i for i in issues if getattr(i, "severity", "") == "error"]
    warn_issues = [i for i in issues if getattr(i, "severity", "") == "warning"]
    score -= min(20.0, 4.0 * len(error_issues))
    score -= min(10.0, 1.0 * len(warn_issues))

    restatements = merged.get("restatement_events") if isinstance(merged.get("restatement_events"), list) else []
    score -= min(15.0, 2.0 * len(restatements))

    data_gaps = merged.get("data_gaps") if isinstance(merged.get("data_gaps"), list) else []
    score -= min(15.0, 5.0 * len(data_gaps))

    score = max(0.0, min(100.0, score))
    band = "high" if score >= 80 else "medium" if score >= 60 else "low"

    inconsistencies = [str(x) for x in hard_validation.get("failures", [])]
    inconsistencies.extend([f"{i.code}:{i.message}" for i in issues[:25]])

    return {
        "score": round(score, 2),
        "band": band,
        "restatement_events_count": len(restatements),
        "data_gaps": data_gaps,
        "comparative_availability": bool(merged.get("comparative_availability", False)),
        "gate_failures": gate_failures,
        "inconsistencies": inconsistencies,
    }


def _merge_temp_docs(temp_docs: list[dict[str, Any]]) -> dict[str, Any]:
    by_year: dict[str, dict[str, Any]] = {}
    restatement_events: list[dict[str, Any]] = []
    duplicate_year_merges = 0
    current_year = datetime.now(timezone.utc).year

    def merge_section(
        base: dict[str, Any],
        incoming: dict[str, Any],
        confidence: float,
        source_file: str,
        section_name: str,
        year: str,
        incoming_report_year: int,
    ) -> dict[str, Any]:
        out = dict(base)
        src_conf = out.get("_source_confidence") if isinstance(out.get("_source_confidence"), dict) else {}
        src_file = out.get("_source_file") if isinstance(out.get("_source_file"), dict) else {}
        src_report_year = out.get("_source_report_year") if isinstance(out.get("_source_report_year"), dict) else {}

        for key, value in incoming.items():
            if key.startswith("_"):
                continue
            if not isinstance(value, (int, float)):
                continue
            current = out.get(key)
            current_conf = src_conf.get(key, -1.0)
            current_report_year = int(src_report_year.get(key, 0) or 0)

            rel_diff = _safe_rel_diff_optional(current, value)
            if rel_diff is not None and rel_diff > 0.03:
                restatement_events.append(
                    {
                        "year": year,
                        "metric": f"{section_name}.{key}",
                        "previous_value": float(current),
                        "incoming_value": float(value),
                        "previous_source_file": src_file.get(key),
                        "incoming_source_file": source_file,
                        "previous_report_year": current_report_year,
                        "incoming_report_year": incoming_report_year,
                    }
                )

            prefer_incoming = False
            if current is None or not isinstance(current, (int, float)):
                prefer_incoming = True
            elif incoming_report_year > current_report_year:
                prefer_incoming = True
            elif incoming_report_year == current_report_year and confidence > current_conf:
                prefer_incoming = True

            if prefer_incoming:
                out[key] = float(value)
                src_conf[key] = float(confidence)
                src_file[key] = source_file
                src_report_year[key] = incoming_report_year

        out["_source_confidence"] = src_conf
        out["_source_file"] = src_file
        out["_source_report_year"] = src_report_year
        return out

    for doc in temp_docs:
        if bool(doc.get("is_placeholder_year")):
            continue

        year = str(doc.get("year")) if doc.get("year") is not None else ""
        if not year.isdigit():
            continue
        year_int = int(year)
        if year_int < 1990 or year_int > current_year:
            continue
        source_file = str(doc.get("source_file") or "")
        extraction_confidence = float(doc.get("extraction_confidence", 0.0) or 0.0)
        candidate = {
            "balance_sheet": doc.get("balance_sheet") if isinstance(doc.get("balance_sheet"), dict) else {},
            "income_statement": doc.get("income_statement") if isinstance(doc.get("income_statement"), dict) else {},
            "cashflow_statement": doc.get("cashflow_statement") if isinstance(doc.get("cashflow_statement"), dict) else {},
            "equity_statement": doc.get("equity_statement") if isinstance(doc.get("equity_statement"), dict) else {},
            "currency": doc.get("currency"),
            "unit_multiplier": doc.get("unit_multiplier"),
            "unit_detected": doc.get("unit_detected"),
            "confidence_unit": float(doc.get("confidence_unit", 0.0) or 0.0),
            "value_trace": doc.get("value_trace") if isinstance(doc.get("value_trace"), dict) else {},
            "source_file": doc.get("source_file"),
            "metrics_extracted_count": int(doc.get("metrics_extracted_count", 0)),
            "extraction_confidence": extraction_confidence,
            "extraction_agreement_score": float(doc.get("extraction_agreement_score", 0.0) or 0.0),
            "source_report_year": int(doc.get("source_report_year", doc.get("year", 0)) or 0),
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

        duplicate_year_merges += 1

        current_bs = current.get("balance_sheet") if isinstance(current.get("balance_sheet"), dict) else {}
        current_inc = current.get("income_statement") if isinstance(current.get("income_statement"), dict) else {}
        current_cf = current.get("cashflow_statement") if isinstance(current.get("cashflow_statement"), dict) else {}
        current_eq = current.get("equity_statement") if isinstance(current.get("equity_statement"), dict) else {}

        incoming_report_year = int(candidate.get("source_report_year", 0) or 0)
        merged_bs = merge_section(current_bs, candidate["balance_sheet"], extraction_confidence, source_file, "balance_sheet", year, incoming_report_year)
        merged_inc = merge_section(current_inc, candidate["income_statement"], extraction_confidence, source_file, "income_statement", year, incoming_report_year)
        merged_cf = merge_section(current_cf, candidate["cashflow_statement"], extraction_confidence, source_file, "cashflow_statement", year, incoming_report_year)
        merged_eq = merge_section(current_eq, candidate["equity_statement"], extraction_confidence, source_file, "equity_statement", year, incoming_report_year)

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
        merged_candidate["currency"] = current.get("currency") or candidate.get("currency")
        merged_candidate["unit_multiplier"] = current.get("unit_multiplier") or candidate.get("unit_multiplier")
        merged_candidate["unit_detected"] = current.get("unit_detected") or candidate.get("unit_detected")
        merged_candidate["confidence_unit"] = max(
            float(current.get("confidence_unit", 0.0) or 0.0),
            float(candidate.get("confidence_unit", 0.0) or 0.0),
        )
        merged_candidate["value_trace"] = {
            **(current.get("value_trace") if isinstance(current.get("value_trace"), dict) else {}),
            **(candidate.get("value_trace") if isinstance(candidate.get("value_trace"), dict) else {}),
        }
        merged_candidate["source_report_year"] = max(
            int(current.get("source_report_year", 0) or 0),
            int(candidate.get("source_report_year", 0) or 0),
        )
        by_year[year] = merged_candidate

    scale_adjustments = _normalize_year_scale(by_year)
    cross_statement_adjustments = _stabilize_cross_statement_consistency(by_year)

    financial_values: dict[str, dict[str, float]] = {}
    for year, payload in by_year.items():
        mapped: dict[str, float] = {}
        for section_name in ("balance_sheet", "income_statement", "cashflow_statement", "equity_statement"):
            section = payload.get(section_name) if isinstance(payload.get(section_name), dict) else {}
            for metric, value in section.items():
                if metric.startswith("_"):
                    continue
                if isinstance(value, (int, float)):
                    mapped[f"{section_name}.{metric}"] = float(value)
        financial_values[year] = mapped

    numeric_years = sorted([int(y) for y in by_year.keys() if isinstance(y, str) and y.isdigit()])
    data_gaps: list[str] = []
    if len(numeric_years) >= 2:
        for missing in range(numeric_years[0], numeric_years[-1] + 1):
            if missing not in numeric_years:
                data_gaps.append(str(missing))

    post_extraction_flags: list[str] = []
    for year in sorted(by_year.keys(), key=lambda y: int(y) if isinstance(y, str) and y.isdigit() else 0):
        payload = by_year.get(year, {})
        bs = payload.get("balance_sheet") if isinstance(payload.get("balance_sheet"), dict) else {}
        inc = payload.get("income_statement") if isinstance(payload.get("income_statement"), dict) else {}

        assets = bs.get("total_assets")
        liabilities = bs.get("total_liabilities")
        equity = bs.get("total_equity")
        if all(isinstance(v, (int, float)) for v in [assets, liabilities, equity]):
            lhs = float(assets)
            rhs = float(liabilities) + float(equity)
            denom = max(abs(lhs), abs(rhs), 1.0)
            if abs(lhs - rhs) / denom > 0.05:
                post_extraction_flags.append(f"balance_sheet_identity_5pct_failed_{year}")

        revenue = inc.get("revenue_or_interest_income")
        if isinstance(revenue, (int, float)) and float(revenue) < 0:
            post_extraction_flags.append(f"negative_revenue_detected_{year}")

    for metric_path in [
        "income_statement.revenue_or_interest_income",
        "income_statement.net_profit",
        "balance_sheet.total_assets",
        "balance_sheet.total_equity",
    ]:
        section_name, field_name = metric_path.split(".", 1)
        prev_val: float | None = None
        prev_year: str | None = None
        for year in sorted([y for y in by_year.keys() if isinstance(y, str) and y.isdigit()], key=lambda y: int(y)):
            section = by_year.get(year, {}).get(section_name) if isinstance(by_year.get(year, {}).get(section_name), dict) else {}
            cur = section.get(field_name)
            if not isinstance(cur, (int, float)):
                continue
            cur_val = float(cur)
            if prev_val is not None and abs(prev_val) > 1e-9:
                yoy = (cur_val - prev_val) / abs(prev_val)
                gap = 1
                try:
                    if prev_year is not None:
                        gap = max(1, int(year) - int(prev_year))
                except Exception:
                    gap = 1
                if abs(yoy) > (5.0 * float(gap)):
                    post_extraction_flags.append(f"extreme_yoy_gt_500pct_{metric_path}_{prev_year}_to_{year}")
            prev_val = cur_val
            prev_year = year

    return {
        "years": sorted([y for y in by_year.keys() if isinstance(y, str) and y.isdigit()], key=lambda y: int(y)),
        "financials": by_year,
        "financial_values": financial_values,
        "comparative_availability": len(numeric_years) >= 2,
        "data_gaps": data_gaps,
        "restatement_events": restatement_events,
        "scale_adjustments": scale_adjustments,
        "cross_statement_adjustments": cross_statement_adjustments,
        "duplicate_year_merges": duplicate_year_merges,
        "post_extraction_flags": sorted(set(post_extraction_flags)),
    }


def _canonical_raw_from_merged(report_id: str, merged: dict[str, Any]) -> CanonicalRawReport:
    income_statement: list[dict[str, Any]] = []
    balance_sheet: list[dict[str, Any]] = []
    cashflow: list[dict[str, Any]] = []
    equity: list[dict[str, Any]] = []

    def add(target: list[dict[str, Any]], label: str, value: Any, year: str, currency: str = "LKR") -> None:
        if not isinstance(value, (int, float)):
            return
        target.append(
            {
                "label": label,
                "value": float(value),
                "period": year,
                "currency": currency,
            }
        )

    for year in merged.get("years", []):
        entry = merged.get("financials", {}).get(year, {})
        currency = str(entry.get("currency") or "LKR")
        bs = entry.get("balance_sheet") if isinstance(entry.get("balance_sheet"), dict) else {}
        inc = entry.get("income_statement") if isinstance(entry.get("income_statement"), dict) else {}
        cf = entry.get("cashflow_statement") if isinstance(entry.get("cashflow_statement"), dict) else {}

        add(balance_sheet, "Total Assets", bs.get("total_assets"), year, currency)
        add(balance_sheet, "Total Liabilities", bs.get("total_liabilities"), year, currency)
        add(balance_sheet, "Total Equity", bs.get("total_equity"), year, currency)
        add(balance_sheet, "Current Assets", bs.get("current_assets"), year, currency)
        add(balance_sheet, "Current Liabilities", bs.get("current_liabilities"), year, currency)
        add(balance_sheet, "Debt", bs.get("borrowings"), year, currency)
        add(balance_sheet, "Cash and Equivalents", bs.get("cash_and_equivalents"), year, currency)

        add(income_statement, "Revenue", inc.get("revenue_or_interest_income"), year, currency)
        add(income_statement, "Cost of Revenue", inc.get("cost_of_revenue"), year, currency)
        add(income_statement, "Gross Profit", inc.get("gross_profit"), year, currency)
        add(income_statement, "Operating Expenses", inc.get("operating_expenses"), year, currency)
        add(income_statement, "Operating Profit", inc.get("operating_profit"), year, currency)
        add(income_statement, "Profit Before Tax", inc.get("profit_before_tax"), year, currency)
        add(income_statement, "Interest Expense", inc.get("interest_expense"), year, currency)
        add(income_statement, "Net Income", inc.get("net_profit"), year, currency)

        add(cashflow, "Operating Cash Flow", cf.get("operating_cash_flow"), year, currency)
        add(cashflow, "Investing Cash Flow", cf.get("investing_cash_flow"), year, currency)
        add(cashflow, "Financing Cash Flow", cf.get("financing_cash_flow"), year, currency)
        add(cashflow, "Net Cash Flow", cf.get("net_cash_change"), year, currency)
        add(cashflow, "Opening Cash", cf.get("opening_cash"), year, currency)
        add(cashflow, "Closing Cash", cf.get("closing_cash"), year, currency)
        add(cashflow, "Net Income", cf.get("net_income"), year, currency)

        eq = entry.get("equity_statement") if isinstance(entry.get("equity_statement"), dict) else {}
        add(equity, "Net Income", eq.get("net_income"), year, currency)
        add(equity, "Change in Retained Earnings", eq.get("change_in_retained_earnings"), year, currency)

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
    # v2 engine expects a wider ratio surface; use 20 as coverage normalization base.
    return min(1.0, numeric_count / 20.0)


def _safe_rel_diff(a: float, b: float) -> float:
    denom = max(abs(a), abs(b), 1.0)
    return abs(a - b) / denom


def _apply_ratio_guardrails(ratios: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    if not isinstance(ratios, dict):
        return ratios, []

    guards = {
        "revenue_growth_yoy": (-0.50, 1.50),
        "net_profit_growth_yoy": (-0.50, 1.50),
        "return_on_equity": (-0.50, 0.60),
        "net_profit_margin": (-0.50, 0.80),
        "debt_to_equity": (0.0, 10.0),
        "interest_coverage": (0.0, 50.0),
    }

    anomalies: list[str] = []
    by_year = ratios.get("by_year") if isinstance(ratios.get("by_year"), dict) else {}
    for year, year_metrics in by_year.items():
        if not isinstance(year_metrics, dict):
            continue
        for metric, (mn, mx) in guards.items():
            val = year_metrics.get(metric)
            if not isinstance(val, (int, float)):
                continue
            if float(val) < mn or float(val) > mx:
                anomalies.append(f"ratio_guardrail_{metric}_{year}")
                year_metrics[metric] = None

    latest_year = ratios.get("latest_year")
    latest = by_year.get(latest_year) if isinstance(latest_year, str) else None
    if isinstance(latest, dict):
        for metric, (mn, mx) in guards.items():
            val = latest.get(metric)
            if isinstance(val, (int, float)) and (float(val) < mn or float(val) > mx):
                latest[metric] = None

    return ratios, anomalies


def _hard_validation_gates(merged: dict[str, Any]) -> dict[str, Any]:
    gate_results: dict[str, Any] = {
        "gate_1_balance_sheet_identity": True,
        "gate_2_cash_reconciliation": True,
        "gate_3_net_income_linkage": True,
        "gate_4_multi_year_continuity": True,
        "gate_5_unit_consistency": True,
    }
    failures: list[str] = []

    years = [y for y in merged.get("years", []) if isinstance(y, str) and y.isdigit()]

    currencies = {
        (merged.get("financials", {}).get(y, {}) or {}).get("currency")
        for y in merged.get("years", [])
        if (merged.get("financials", {}).get(y, {}) or {}).get("currency")
    }
    multipliers = {
        (merged.get("financials", {}).get(y, {}) or {}).get("unit_multiplier")
        for y in merged.get("years", [])
        if isinstance((merged.get("financials", {}).get(y, {}) or {}).get("unit_multiplier"), int)
    }
    if len(currencies) > 1 or len(multipliers) > 1:
        gate_results["gate_5_unit_consistency"] = False
        failures.append("unit_consistency_failed")

    for year in merged.get("years", []):
        entry = merged.get("financials", {}).get(year, {})
        bs = entry.get("balance_sheet") if isinstance(entry.get("balance_sheet"), dict) else {}
        inc = entry.get("income_statement") if isinstance(entry.get("income_statement"), dict) else {}
        cf = entry.get("cashflow_statement") if isinstance(entry.get("cashflow_statement"), dict) else {}
        eq = entry.get("equity_statement") if isinstance(entry.get("equity_statement"), dict) else {}

        # Precheck: required fields for gate execution.
        fields_present = all(
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
        if not fields_present:
            failures.append(f"minimum_completeness_failed_{year}")

        # Gate 1: accounting identity with 3% tolerance.
        a = bs.get("total_assets")
        l = bs.get("total_liabilities")
        e = bs.get("total_equity")
        if all(isinstance(v, (int, float)) for v in [a, l, e]):
            if _safe_rel_diff(float(a), float(l) + float(e)) > 0.03:
                gate_results["gate_1_balance_sheet_identity"] = False
                failures.append(f"accounting_identity_failed_{year}")
        else:
            gate_results["gate_1_balance_sheet_identity"] = False
            failures.append(f"accounting_identity_missing_{year}")

        # Gate 2: cash reconciliation.
        oc = cf.get("opening_cash")
        nc = cf.get("net_cash_change")
        cc = cf.get("closing_cash")

        # Recover one missing cash leg when two of three are available.
        if not isinstance(nc, (int, float)) and isinstance(oc, (int, float)) and isinstance(cc, (int, float)):
            nc = float(cc) - float(oc)
            cf["net_cash_change"] = nc
        if not isinstance(oc, (int, float)) and isinstance(nc, (int, float)) and isinstance(cc, (int, float)):
            oc = float(cc) - float(nc)
            cf["opening_cash"] = oc
        if not isinstance(cc, (int, float)) and isinstance(oc, (int, float)) and isinstance(nc, (int, float)):
            cc = float(oc) + float(nc)
            cf["closing_cash"] = cc

        if all(isinstance(v, (int, float)) for v in [oc, nc, cc]):
            if _safe_rel_diff(float(oc) + float(nc), float(cc)) > 0.03:
                gate_results["gate_2_cash_reconciliation"] = False
                failures.append(f"cash_reconciliation_failed_{year}")
        else:
            gate_results["gate_2_cash_reconciliation"] = False
            failures.append(f"cash_reconciliation_missing_{year}")

        # Gate 3: net income linkage (income, cashflow, equity).
        ni_inc = inc.get("net_profit")
        ni_cf = cf.get("net_income")
        ni_eq = eq.get("net_income") if isinstance(eq.get("net_income"), (int, float)) else eq.get("change_in_retained_earnings")
        if all(isinstance(v, (int, float)) for v in [ni_inc, ni_cf, ni_eq]):
            if _safe_rel_diff(float(ni_inc), float(ni_cf)) > 0.03 or _safe_rel_diff(float(ni_inc), float(ni_eq)) > 0.03:
                gate_results["gate_3_net_income_linkage"] = False
                failures.append(f"net_income_linkage_failed_{year}")
        else:
            gate_results["gate_3_net_income_linkage"] = False
            failures.append(f"net_income_linkage_missing_{year}")

    # Gate 4: multi-year continuity (flag if yoy movement exceeds +/-300%).
    for metric_path, metric_name in [
        ("balance_sheet.total_assets", "assets"),
        ("income_statement.revenue_or_interest_income", "revenue"),
        ("balance_sheet.total_equity", "equity"),
    ]:
        section_name, field_name = metric_path.split(".", 1)
        prev_val: float | None = None
        prev_year: str | None = None
        for year in sorted(years):
            entry = merged.get("financials", {}).get(year, {})
            section = entry.get(section_name) if isinstance(entry.get(section_name), dict) else {}
            cur = section.get(field_name)
            if not isinstance(cur, (int, float)):
                continue
            cur_val = float(cur)
            if prev_val is not None and abs(prev_val) > 1e-9:
                yoy = (cur_val - prev_val) / abs(prev_val)
                gap = 1
                try:
                    if prev_year is not None:
                        gap = max(1, int(year) - int(prev_year))
                except Exception:
                    gap = 1
                continuity_threshold = 3.0 * float(gap)
                if abs(yoy) > continuity_threshold:
                    gate_results["gate_4_multi_year_continuity"] = False
                    failures.append(f"multi_year_continuity_{metric_name}_{prev_year}_to_{year}")
            prev_val = cur_val
            prev_year = year

    all_passed = all(bool(v) for v in gate_results.values())
    return {
        "all_passed": all_passed,
        "gates": gate_results,
        "failures": failures,
    }


def _yearly_inputs_from_merged(merged: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for year in merged.get("years", []):
        if not isinstance(year, str) or not year.isdigit():
            continue
        row = merged.get("financials", {}).get(year, {})
        bs = row.get("balance_sheet") if isinstance(row.get("balance_sheet"), dict) else {}
        inc = row.get("income_statement") if isinstance(row.get("income_statement"), dict) else {}
        cf = row.get("cashflow_statement") if isinstance(row.get("cashflow_statement"), dict) else {}

        revenue = inc.get("revenue_or_interest_income")
        cost_of_sales = inc.get("cost_of_revenue")
        gross_profit = inc.get("gross_profit")
        if not isinstance(gross_profit, (int, float)) and isinstance(revenue, (int, float)) and isinstance(cost_of_sales, (int, float)):
            gross_profit = float(revenue) - float(cost_of_sales)

        out[year] = {
            "revenue": revenue,
            "cost_of_sales": cost_of_sales,
            "gross_profit": gross_profit,
            "operating_profit": inc.get("operating_profit"),
            "net_profit": inc.get("net_profit"),
            "total_assets": bs.get("total_assets"),
            "total_liabilities": bs.get("total_liabilities"),
            "equity": bs.get("total_equity"),
            "current_assets": bs.get("current_assets"),
            "current_liabilities": bs.get("current_liabilities"),
            "inventory": bs.get("inventory"),
            "cash": bs.get("cash_and_equivalents"),
            "total_debt": bs.get("borrowings"),
            "operating_cash_flow": cf.get("operating_cash_flow"),
            "investing_cash_flow": cf.get("investing_cash_flow"),
            "financing_cash_flow": cf.get("financing_cash_flow"),
            "shares_outstanding": bs.get("shares_outstanding"),
        }
    return out


def _analysis_result_to_ratios(analysis_result: dict[str, Any], yearly_inputs: dict[str, dict[str, Any]]) -> dict[str, Any]:
    metrics = analysis_result.get("metrics") if isinstance(analysis_result.get("metrics"), dict) else {}
    by_year_metrics = metrics.get("by_year") if isinstance(metrics.get("by_year"), dict) else {}
    detected_years = sorted([y for y in by_year_metrics.keys() if isinstance(y, str) and y.isdigit()], key=lambda y: int(y))
    latest_year = metrics.get("latest_year") if isinstance(metrics.get("latest_year"), str) else (detected_years[-1] if detected_years else None)

    by_year: dict[str, dict[str, Any]] = {}
    for year in detected_years:
        row = by_year_metrics.get(year) if isinstance(by_year_metrics.get(year), dict) else {}
        input_row = yearly_inputs.get(year, {})
        total_cash_flow = None
        ocf = input_row.get("operating_cash_flow")
        icf = input_row.get("investing_cash_flow")
        fcf = input_row.get("financing_cash_flow")
        if all(isinstance(v, (int, float)) for v in [ocf, icf, fcf]):
            total_cash_flow = float(ocf) + float(icf) + float(fcf)

        by_year[year] = {
            "revenue": row.get("revenue"),
            "net_income": row.get("net_profit"),
            "gross_profit_margin": row.get("gross_margin"),
            "operating_margin": row.get("operating_margin"),
            "net_profit_margin": row.get("net_margin"),
            "return_on_equity": row.get("return_on_equity"),
            "return_on_assets": row.get("return_on_assets"),
            "current_ratio": row.get("current_ratio"),
            "quick_ratio": row.get("quick_ratio"),
            "debt_to_equity": row.get("debt_to_equity"),
            "debt_ratio": row.get("debt_ratio"),
            "asset_turnover": row.get("asset_turnover"),
            "revenue_growth_yoy": row.get("revenue_growth_yoy"),
            "net_profit_growth_yoy": row.get("net_profit_growth_yoy"),
            "eps": row.get("eps"),
            "book_value_per_share": row.get("book_value_per_share"),
            "operating_cash_flow": row.get("operating_cash_flow"),
            "total_assets": input_row.get("total_assets"),
            "total_liabilities": input_row.get("total_liabilities"),
            "total_equity": input_row.get("equity"),
            "total_cash_flow": total_cash_flow,
        }

    latest = by_year.get(latest_year, {}) if isinstance(latest_year, str) else {}
    previous_year = detected_years[-2] if len(detected_years) >= 2 else None
    latest_growth_snapshot = {
        "period": latest_year,
        "previous_period": previous_year,
        "revenue_growth_yoy": latest.get("revenue_growth_yoy"),
        "net_profit_growth_yoy": latest.get("net_profit_growth_yoy"),
    }

    envelope = analysis_result.get("envelope") if isinstance(analysis_result.get("envelope"), dict) else {}
    payload = dict(latest)
    payload.update(
        {
            "by_year": by_year,
            "detected_years": detected_years,
            "latest_year": latest_year,
            "latest_growth_snapshot": latest_growth_snapshot,
            "forensic_flags": analysis_result.get("risk_flags", []),
            "financial_health_scores": analysis_result.get("financial_health_scores", {}),
            "data_quality_score": analysis_result.get("data_quality_score"),
            "dataset_id": envelope.get("dataset_id"),
            "schema_version": envelope.get("schema_version"),
            "calculation_version": envelope.get("calculation_version"),
            "timestamp": envelope.get("timestamp"),
        }
    )
    return payload


def _analysis_result_to_risk(analysis_result: dict[str, Any]) -> dict[str, Any]:
    scores = analysis_result.get("financial_health_scores") if isinstance(analysis_result.get("financial_health_scores"), dict) else {}
    overall_health = float(scores.get("overall_health_score", 0.0) or 0.0)
    overall_risk = max(0.0, 100.0 - overall_health)
    if overall_risk >= 66.0:
        level = "high"
    elif overall_risk >= 33.0:
        level = "moderate"
    else:
        level = "low"

    envelope = analysis_result.get("envelope") if isinstance(analysis_result.get("envelope"), dict) else {}
    return {
        "overall_risk_score": round(overall_risk, 4),
        "overall_risk_level": level,
        "risk_flags": analysis_result.get("risk_flags", []),
        "final_financial_health_score": round(overall_health, 4),
        "weighted_model": {
            "profitability_weight": 0.30,
            "liquidity_weight": 0.25,
            "leverage_weight": 0.20,
            "efficiency_weight": 0.10,
            "growth_weight": 0.15,
        },
        "dataset_id": envelope.get("dataset_id"),
        "schema_version": envelope.get("schema_version"),
        "calculation_version": envelope.get("calculation_version"),
        "timestamp": envelope.get("timestamp"),
    }


def _strict_years_sorted(strict_extraction: dict[str, Any]) -> list[str]:
    years = strict_extraction.get("years") if isinstance(strict_extraction.get("years"), dict) else {}
    return sorted([y for y in years.keys() if isinstance(y, str) and y.isdigit()], key=int)


def _strict_metric(section: Any, key: str) -> float | None:
    value = section.get(key) if isinstance(section, dict) else None
    return float(value) if isinstance(value, (int, float)) else None


def _strict_to_canonical_raw(report_id: str, strict_extraction: dict[str, Any]) -> CanonicalRawReport:
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
                "currency": str(strict_extraction.get("currency") or "LKR"),
            }
        )

    years = strict_extraction.get("years") if isinstance(strict_extraction.get("years"), dict) else {}
    for year in _strict_years_sorted(strict_extraction):
        payload = years.get(year) if isinstance(years.get(year), dict) else {}
        bs = payload.get("balance_sheet") if isinstance(payload.get("balance_sheet"), dict) else {}
        inc = payload.get("income_statement") if isinstance(payload.get("income_statement"), dict) else {}
        cf = payload.get("cash_flow") if isinstance(payload.get("cash_flow"), dict) else {}

        add(balance_sheet, "Total Assets", bs.get("total_assets"), year)
        add(balance_sheet, "Total Liabilities", bs.get("total_liabilities"), year)
        add(balance_sheet, "Total Equity", bs.get("total_equity"), year)
        add(balance_sheet, "Current Assets", bs.get("current_assets"), year)
        add(balance_sheet, "Current Liabilities", bs.get("current_liabilities"), year)
        add(balance_sheet, "Debt", bs.get("total_debt"), year)
        add(balance_sheet, "Cash and Equivalents", bs.get("cash_and_cash_equivalents"), year)

        add(income_statement, "Revenue", inc.get("revenue"), year)
        add(income_statement, "Cost of Revenue", inc.get("cost_of_sales"), year)
        add(income_statement, "Gross Profit", inc.get("gross_profit"), year)
        add(income_statement, "Operating Profit", inc.get("operating_profit"), year)
        add(income_statement, "Net Income", inc.get("net_profit"), year)

        add(cashflow, "Operating Cash Flow", cf.get("operating_cash_flow"), year)
        add(cashflow, "Investing Cash Flow", cf.get("investing_cash_flow"), year)
        add(cashflow, "Financing Cash Flow", cf.get("financing_cash_flow"), year)
        add(cashflow, "Net Cash Flow", cf.get("net_cash_flow"), year)
        add(cashflow, "Opening Cash", cf.get("opening_cash"), year)
        add(cashflow, "Closing Cash", cf.get("closing_cash"), year)

        net_profit = inc.get("net_profit")
        add(equity, "Net Income", net_profit, year)
        add(equity, "Change in Retained Earnings", net_profit, year)

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


def _strict_validation_issues(strict_analysis: dict[str, Any]) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    flags = strict_analysis.get("validation_flags") if isinstance(strict_analysis.get("validation_flags"), list) else []
    for flag in flags:
        if not isinstance(flag, dict):
            continue
        code = str(flag.get("code") or "validation_issue")
        year = str(flag.get("year") or "").strip()
        message = str(flag.get("message") or "Validation issue")
        if year:
            message = f"{year}: {message}"
        issues.append(
            ValidationIssue(
                code=code,
                message=message,
                severity=str(flag.get("severity") or "error"),
            )
        )

    if strict_analysis.get("status") == "VALIDATION_FAILED":
        reasons = strict_analysis.get("reasons") if isinstance(strict_analysis.get("reasons"), list) else []
        missing_by_year = (
            strict_analysis.get("missing_fields_by_year")
            if isinstance(strict_analysis.get("missing_fields_by_year"), dict)
            else {}
        )
        for year, fields in missing_by_year.items():
            if isinstance(year, str) and year.isdigit() and isinstance(fields, list) and fields:
                issues.append(
                    ValidationIssue(
                        code="MINIMUM_COMPLETENESS_FAILED",
                        message=f"{year}: Missing required fields: {', '.join(str(field) for field in fields)}",
                        severity="error",
                    )
                )
        for reason in reasons:
            if isinstance(reason, str) and reason.strip():
                issues.append(
                    ValidationIssue(
                        code="VALIDATION_FAILED",
                        message=reason.strip(),
                        severity="error",
                    )
                )

    deduped: list[ValidationIssue] = []
    seen: set[tuple[str, str, str]] = set()
    for issue in issues:
        key = (issue.code, issue.message, issue.severity)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(issue)
    return deduped


def _strict_focus_field_map() -> dict[str, str]:
    return {
        "income_statement.revenue": "income_statement.revenue_or_interest_income",
        "income_statement.net_profit": "income_statement.net_profit",
        "balance_sheet.total_assets": "balance_sheet.total_assets",
        "balance_sheet.total_liabilities": "balance_sheet.total_liabilities",
        "balance_sheet.total_equity": "balance_sheet.total_equity",
        "cash_flow.operating_cash_flow": "cashflow_statement.operating_cash_flow",
        "cash_flow.opening_cash": "cashflow_statement.opening_cash",
        "cash_flow.net_cash_flow": "cashflow_statement.net_cash_change",
        "cash_flow.closing_cash": "cashflow_statement.closing_cash",
    }


def _default_focus_fields() -> set[str]:
    return {
        "balance_sheet.total_assets",
        "balance_sheet.total_liabilities",
        "balance_sheet.total_equity",
        "income_statement.revenue_or_interest_income",
        "income_statement.net_profit",
        "cashflow_statement.operating_cash_flow",
    }


def _cash_reconciliation_focus() -> set[str]:
    return {
        "cashflow_statement.opening_cash",
        "cashflow_statement.net_cash_change",
        "cashflow_statement.closing_cash",
        "cashflow_statement.operating_cash_flow",
    }


def _net_income_focus() -> set[str]:
    return {
        "income_statement.net_profit",
        "cashflow_statement.net_income",
        "equity_statement.net_income",
        "equity_statement.change_in_retained_earnings",
    }


def _balance_identity_focus() -> set[str]:
    return {
        "balance_sheet.total_assets",
        "balance_sheet.total_liabilities",
        "balance_sheet.total_equity",
    }


def _extract_focus_fields(strict_analysis: dict[str, Any]) -> dict[str, set[str]]:
    focus_by_year: dict[str, set[str]] = {}
    mapping = _strict_focus_field_map()
    missing_by_year = strict_analysis.get("missing_fields_by_year") if isinstance(strict_analysis.get("missing_fields_by_year"), dict) else {}

    for year, fields in missing_by_year.items():
        if not isinstance(year, str) or not year.isdigit() or not isinstance(fields, list):
            continue
        year_focus = focus_by_year.setdefault(year, set())
        for field in fields:
            if isinstance(field, str):
                year_focus.add(mapping.get(field, field))

    for flag in strict_analysis.get("validation_flags", []) if isinstance(strict_analysis.get("validation_flags"), list) else []:
        if not isinstance(flag, dict):
            continue
        year = str(flag.get("year") or "").strip()
        if not year.isdigit():
            continue
        code = str(flag.get("code") or "")
        message = str(flag.get("message") or "")
        year_focus = focus_by_year.setdefault(year, set())

        if code == "BALANCE_SHEET_EQUATION_FAILED":
            year_focus.update(_balance_identity_focus())
        elif code == "CASH_RECONCILIATION_FAILED":
            year_focus.update(_cash_reconciliation_focus())
        elif code == "NET_INCOME_LINKAGE_FAILED":
            year_focus.update(_net_income_focus())
        elif code == "MULTI_YEAR_CONTINUITY_FAILED":
            field_match = None
            for token in message.split():
                if "." in token:
                    field_match = token.strip().rstrip(":")
                    break
            if field_match:
                year_focus.add(mapping.get(field_match, field_match))
            year_focus.update(_default_focus_fields())
        elif code == "MINIMUM_COMPLETENESS_FAILED":
            year_focus.update(_default_focus_fields())

    for year in focus_by_year:
        if not focus_by_year[year]:
            focus_by_year[year] = set(_default_focus_fields())

    return focus_by_year


def _build_reextract_targets(strict_analysis: dict[str, Any], temp_docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rejected_years = {
        year for year in strict_analysis.get("rejected_years", [])
        if isinstance(year, str) and year.isdigit()
    }
    if not rejected_years:
        return []

    focus_by_year = _extract_focus_fields(strict_analysis)
    docs_by_year: dict[str, dict[str, Any]] = {}

    for doc in temp_docs:
        if not isinstance(doc, dict):
            continue
        if doc.get("is_placeholder_year"):
            continue
        year = str(doc.get("year") or "")
        if not year.isdigit() or year not in rejected_years:
            continue
        source_file = doc.get("source_file")
        if not isinstance(source_file, str) or not source_file.strip():
            continue
        existing = docs_by_year.get(year)
        if existing is None:
            docs_by_year[year] = doc
            continue
        current_conf = float(existing.get("extraction_confidence", 0.0) or 0.0)
        next_conf = float(doc.get("extraction_confidence", 0.0) or 0.0)
        if next_conf > current_conf:
            docs_by_year[year] = doc

    targets: list[dict[str, Any]] = []
    for year, doc in docs_by_year.items():
        source_file = doc.get("source_file")
        if not isinstance(source_file, str) or not os.path.exists(source_file):
            continue
        focus_fields = sorted(focus_by_year.get(year) or _default_focus_fields())
        targets.append(
            {
                "file_path": source_file,
                "target_year": int(year),
                "focus_fields": focus_fields,
            }
        )
    return targets


def _run_targeted_reextract(report_id: str, targets: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not targets:
        return None
    payload = {
        "report_id": report_id,
        "execution_mode": "DEEP_AUDIT_MODE",
        "targets": targets,
        "reason": "deep_audit_second_pass",
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib_request.Request(
        f"{EXTRACTION_SERVICE_URL}/extract-targeted",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib_request.urlopen(req, timeout=1800) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
    except (HTTPError, URLError):
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def _build_extraction_incomplete_result(
    strict_extraction: dict[str, Any],
    reasons: list[str],
) -> dict[str, Any]:
    base = build_validation_failed_diagnostic(strict_extraction, reasons)
    base["status"] = "EXTRACTION_INCOMPLETE"
    base["reasons"] = reasons
    base.setdefault("valid_years", [])
    base.setdefault("rejected_years", [])
    base.setdefault("validation_flags", [])
    base["validation_flags"].append(
        {
            "code": "EXTRACTION_INCOMPLETE",
            "message": reasons[0] if reasons else "Extraction incomplete",
            "severity": "error",
        }
    )
    return base


def _strict_deterministic_checks(strict_extraction: dict[str, Any], strict_analysis: dict[str, Any]) -> DeterministicChecks:
    years = strict_extraction.get("years") if isinstance(strict_extraction.get("years"), dict) else {}
    flags = strict_analysis.get("validation_flags") if isinstance(strict_analysis.get("validation_flags"), list) else []
    failed_codes = {str(flag.get("code")) for flag in flags if isinstance(flag, dict)}
    valid_years = strict_analysis.get("valid_years") if isinstance(strict_analysis.get("valid_years"), list) else []

    net_income_linkage = bool(valid_years)
    for year in valid_years:
        payload = years.get(year) if isinstance(years.get(year), dict) else {}
        income_statement = payload.get("income_statement") if isinstance(payload.get("income_statement"), dict) else {}
        if _strict_metric(income_statement, "net_profit") is None:
            net_income_linkage = False
            break

    return DeterministicChecks(
        balance_sheet_identity="BALANCE_SHEET_EQUATION_FAILED" not in failed_codes,
        cash_reconciliation="CASH_RECONCILIATION_FAILED" not in failed_codes,
        net_income_linkage=net_income_linkage,
    )


def _growth_or_none(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None or abs(previous) <= 1e-12:
        return None
    return round((current - previous) / abs(previous), 6)


def _strict_confidence(strict_extraction: dict[str, Any], strict_analysis: dict[str, Any], issues: list[ValidationIssue]) -> dict[str, Any]:
    years = strict_extraction.get("years") if isinstance(strict_extraction.get("years"), dict) else {}
    total_years = len([y for y in years.keys() if isinstance(y, str) and y.isdigit()])
    valid_years = strict_analysis.get("valid_years") if isinstance(strict_analysis.get("valid_years"), list) else []
    extraction_scores = []
    for year in years.values():
        if isinstance(year, dict) and isinstance(year.get("extraction_confidence"), (int, float)):
            extraction_scores.append(float(year.get("extraction_confidence")) / 100.0)

    year_acceptance = (len(valid_years) / float(total_years)) if total_years else 0.0
    avg_extraction_confidence = (sum(extraction_scores) / float(len(extraction_scores))) if extraction_scores else 0.0
    issue_penalty = min(0.35, 0.04 * len(issues))
    score = max(0.0, min(1.0, (0.6 * year_acceptance) + (0.4 * avg_extraction_confidence) - issue_penalty))

    if score >= 0.8:
        band = "high"
    elif score >= 0.5:
        band = "moderate"
    else:
        band = "low"

    return {
        "score": round(score, 4),
        "raw_score": round(score, 4),
        "overall_data_quality_score": round(score, 4),
        "band": band,
        "valid_years": valid_years,
        "rejected_years": strict_analysis.get("rejected_years", []),
    }


def _strict_patterns(strict_analysis: dict[str, Any], valid_years: list[str], rejected_years: list[str]) -> list[str]:
    patterns: list[str] = []
    if rejected_years:
        patterns.append("Validation friction detected")
        patterns.append("One or more reporting years were rejected by deterministic gates")
    if len(valid_years) >= 2:
        patterns.append("Consistent multi-year validation coverage available")
    elif len(valid_years) == 1:
        patterns.extend(_trend_limitations(1))
    else:
        patterns.append("No validated years are available for analytics")

    for flag in strict_analysis.get("validation_flags", []) if isinstance(strict_analysis.get("validation_flags"), list) else []:
        if not isinstance(flag, dict):
            continue
        code = str(flag.get("code") or "")
        if code == "MULTI_YEAR_CONTINUITY_FAILED":
            patterns.append("Multi-year continuity anomaly detected")
        if code == "BALANCE_SHEET_EQUATION_FAILED":
            patterns.append("Balance sheet consistency issue detected")
        if code == "CASH_RECONCILIATION_FAILED":
            patterns.append("Cash reconciliation issue detected")

    deduped: list[str] = []
    seen: set[str] = set()
    for pattern in patterns:
        if pattern in seen:
            continue
        seen.add(pattern)
        deduped.append(pattern)
    return deduped


def _strict_ratios_payload(
    strict_extraction: dict[str, Any],
    strict_analysis: dict[str, Any],
    confidence: dict[str, Any],
) -> dict[str, Any]:
    years = strict_extraction.get("years") if isinstance(strict_extraction.get("years"), dict) else {}
    valid_years = sorted(
        [y for y in strict_analysis.get("valid_years", []) if isinstance(y, str) and y in years],
        key=int,
    )
    by_year: dict[str, dict[str, Any]] = {}

    for index, year in enumerate(valid_years):
        payload = years.get(year) if isinstance(years.get(year), dict) else {}
        ratios = strict_analysis.get("financial_ratios", {}).get(year, {}) if isinstance(strict_analysis.get("financial_ratios"), dict) else {}
        income_statement = payload.get("income_statement") if isinstance(payload.get("income_statement"), dict) else {}
        balance_sheet = payload.get("balance_sheet") if isinstance(payload.get("balance_sheet"), dict) else {}
        cash_flow = payload.get("cash_flow") if isinstance(payload.get("cash_flow"), dict) else {}

        revenue = _strict_metric(income_statement, "revenue")
        net_profit = _strict_metric(income_statement, "net_profit")
        total_assets = _strict_metric(balance_sheet, "total_assets")
        total_liabilities = _strict_metric(balance_sheet, "total_liabilities")
        total_equity = _strict_metric(balance_sheet, "total_equity")
        operating_cash_flow = _strict_metric(cash_flow, "operating_cash_flow")
        investing_cash_flow = _strict_metric(cash_flow, "investing_cash_flow")
        financing_cash_flow = _strict_metric(cash_flow, "financing_cash_flow")
        total_cash_flow = None
        if None not in (operating_cash_flow, investing_cash_flow, financing_cash_flow):
            total_cash_flow = float(operating_cash_flow) + float(investing_cash_flow) + float(financing_cash_flow)

        prev_year = valid_years[index - 1] if index > 0 else None
        prev_payload = years.get(prev_year) if prev_year and isinstance(years.get(prev_year), dict) else {}
        prev_income = prev_payload.get("income_statement") if isinstance(prev_payload.get("income_statement"), dict) else {}

        by_year[year] = {
            "revenue": revenue,
            "net_income": net_profit,
            "gross_profit_margin": _growth_or_none(_strict_metric(income_statement, "gross_profit"), revenue),
            "net_profit_margin": ratios.get("Net Margin"),
            "return_on_equity": ratios.get("ROE"),
            "return_on_assets": ratios.get("ROA"),
            "current_ratio": ratios.get("Current Ratio"),
            "debt_to_equity": ratios.get("Debt to Equity"),
            "asset_turnover": ratios.get("Asset Turnover"),
            "revenue_growth_yoy": _growth_or_none(revenue, _strict_metric(prev_income, "revenue")),
            "net_profit_growth_yoy": _growth_or_none(net_profit, _strict_metric(prev_income, "net_profit")),
            "operating_cash_flow": operating_cash_flow,
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "total_equity": total_equity,
            "total_cash_flow": total_cash_flow,
        }

    latest_year = valid_years[-1] if valid_years else None
    latest = by_year.get(latest_year, {}) if isinstance(latest_year, str) else {}
    previous_year = valid_years[-2] if len(valid_years) >= 2 else None

    return {
        **latest,
        "by_year": by_year,
        "detected_years": valid_years,
        "latest_year": latest_year,
        "latest_growth_snapshot": {
            "period": latest_year,
            "previous_period": previous_year,
            "revenue_growth_yoy": latest.get("revenue_growth_yoy"),
            "net_profit_growth_yoy": latest.get("net_profit_growth_yoy"),
        },
        "data_quality_score": confidence.get("score"),
        "data_coverage": {
            "valid_years": valid_years,
            "rejected_years": strict_analysis.get("rejected_years", []),
        },
        "data_reliability_report": {
            "score": round(float(confidence.get("score", 0.0) or 0.0) * 100.0, 2),
            "band": confidence.get("band"),
            "gate_failures": [issue.code for issue in _strict_validation_issues(strict_analysis)],
            "inconsistencies": [issue.message for issue in _strict_validation_issues(strict_analysis)],
        },
    }


def _strict_risk_payload(strict_analysis: dict[str, Any]) -> dict[str, Any]:
    financial_health_score = float(strict_analysis.get("financial_health_score", 0.0) or 0.0)
    overall_risk_score = round(max(0.0, 100.0 - financial_health_score), 2)
    if overall_risk_score >= 66.0:
        overall_risk_level = "high"
    elif overall_risk_score >= 33.0:
        overall_risk_level = "moderate"
    else:
        overall_risk_level = "low"

    risk_flags = []
    for flag in strict_analysis.get("validation_flags", []) if isinstance(strict_analysis.get("validation_flags"), list) else []:
        if isinstance(flag, dict) and isinstance(flag.get("message"), str):
            risk_flags.append(str(flag.get("message")))

    return {
        "overall_risk_score": overall_risk_score,
        "overall_risk_level": overall_risk_level,
        "risk_flags": risk_flags,
        "final_financial_health_score": round(financial_health_score, 2),
    }


def _strict_analysis_coverage(
    strict_extraction: dict[str, Any],
    strict_analysis: dict[str, Any],
    issues: list[ValidationIssue],
) -> dict[str, Any]:
    detected_years = _strict_years_sorted(strict_extraction)
    valid_years = [y for y in strict_analysis.get("valid_years", []) if isinstance(y, str)]
    rejected_years = [y for y in strict_analysis.get("rejected_years", []) if isinstance(y, str)]
    issue_codes = {issue.code for issue in issues}
    return {
        "detected_years": detected_years,
        "valid_years": valid_years,
        "rejected_years": rejected_years,
        "validation_issue_count": len(issues),
        "metrics_coverage": {
            "years_detected": len(detected_years),
            "years_accepted": len(valid_years),
            "years_rejected": len(rejected_years),
            "hard_validation": {
                "status": "passed" if not issues else "failed",
                "gates": {
                    "minimum_completeness": "MINIMUM_COMPLETENESS_FAILED" not in issue_codes,
                    "balance_sheet_identity": "BALANCE_SHEET_EQUATION_FAILED" not in issue_codes,
                    "cash_reconciliation": "CASH_RECONCILIATION_FAILED" not in issue_codes,
                    "multi_year_continuity": "MULTI_YEAR_CONTINUITY_FAILED" not in issue_codes,
                },
                "failures": [issue.code for issue in issues],
            },
        },
    }


def _clear_analytics_artifacts(redis: Any, report_id: str) -> None:
    redis.delete(
        f"report:{report_id}:ratios",
        f"report:{report_id}:patterns",
        f"report:{report_id}:sector_comparison",
        f"report:{report_id}:risk",
        f"report:{report_id}:analysis_coverage",
    )


@app.post('/analyze')
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    redis = get_redis()
    try:
        mark_running(redis, request.report_id)
        extraction_coverage = get_json(redis, f"report:{request.report_id}:extraction_coverage", default={})
        report_meta = get_json(redis, f"report:{request.report_id}:meta", default={})
        expected_docs = int(report_meta.get("document_count", 0) or 0) if isinstance(report_meta, dict) else 0
        if expected_docs <= 0:
            expected_docs = int(extraction_coverage.get("pdfs_processed", 0) or 0) if isinstance(extraction_coverage, dict) else 0
        valid_docs = int(extraction_coverage.get("valid_pdfs", 0) or 0) if isinstance(extraction_coverage, dict) else 0
        document_errors = extraction_coverage.get("document_errors") if isinstance(extraction_coverage, dict) else []
        has_errors = isinstance(document_errors, list) and len(document_errors) > 0

        strict_extraction = get_json(redis, f"report:{request.report_id}:strict_extraction", default={})
        if expected_docs and (valid_docs < expected_docs or has_errors):
            reasons = [
                f"Extraction incomplete: {valid_docs} of {expected_docs} documents extracted successfully",
            ]
            if has_errors:
                reasons.append("One or more documents failed extraction")
            strict_analysis = _build_extraction_incomplete_result(strict_extraction, reasons)
        elif not isinstance(strict_extraction, dict) or not isinstance(strict_extraction.get("years"), dict):
            strict_analysis = build_validation_failed_diagnostic(
                {"years": {}},
                ["Strict extraction artifact not found for analysis"],
            )
        else:
            strict_analysis = build_strict_analysis_result(strict_extraction)

        issues = _strict_validation_issues(strict_analysis)
        checks = _strict_deterministic_checks(strict_extraction, strict_analysis)
        canonical_raw = _strict_to_canonical_raw(request.report_id, strict_extraction)
        save_canonical_validated(redis, request.report_id, canonical_raw, checks, issues, cfg.redis_ttl_seconds)

        confidence = _strict_confidence(strict_extraction, strict_analysis, issues)
        set_json(redis, f"report:{request.report_id}:confidence", confidence, cfg.redis_ttl_seconds)

        analysis_coverage = _strict_analysis_coverage(strict_extraction, strict_analysis, issues)
        set_json(redis, f"report:{request.report_id}:analysis_coverage", analysis_coverage, cfg.redis_ttl_seconds)

        valid_years = strict_analysis.get("valid_years") if isinstance(strict_analysis.get("valid_years"), list) else []
        if valid_years:
            ratios = _strict_ratios_payload(strict_extraction, strict_analysis, confidence)
            patterns = _strict_patterns(
                strict_analysis,
                [y for y in valid_years if isinstance(y, str)],
                [y for y in strict_analysis.get("rejected_years", []) if isinstance(y, str)],
            )
            risk = _strict_risk_payload(strict_analysis)
            sector = {
                "sector": "diversified",
                "status": "report_only",
                "benchmarking": "not_enabled",
            }
            save_analytics(redis, request.report_id, ratios, patterns, confidence, sector, risk, cfg.redis_ttl_seconds)
        else:
            _clear_analytics_artifacts(redis, request.report_id)

        set_json(redis, f"report:{request.report_id}:strict_analysis", strict_analysis, cfg.redis_ttl_seconds)
        mark_success(redis, request.report_id)
        return strict_analysis
    except HTTPException as exc:
        mark_failed(redis, request.report_id, str(exc.detail))
        raise
    except Exception as exc:
        mark_failed(redis, request.report_id, str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get('/health')
def health() -> dict[str, str]:
    return {"status": "ok", "service": "analysis-service"}
