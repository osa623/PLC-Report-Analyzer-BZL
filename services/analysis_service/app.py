from __future__ import annotations

import math
from datetime import datetime, timezone
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


@app.post('/analyze')
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    redis = get_redis()
    try:
        mark_running(redis, request.report_id)

        import json
        import logging
        import os
        import re
        from pathlib import Path

        _analyze_logger = logging.getLogger("analysis_service.analyze")

        # ── Data Retrieval Layer ──
        # Priority:
        #   1. MongoDB "companies" collection (clean LLM-extracted financials)
        #   2. fetch_temporary_financial_statements (Redis/Mongo temp docs)
        #   3. normalize.json (local fallback file)

        temp_docs = []
        data_source = "none"

        # --- Attempt 1: MongoDB companies collection ---
        try:
            from platform_core.mongo_client import get_mongo_db

            meta = get_json(redis, f"report:{request.report_id}:meta", default={})
            company_name_raw = meta.get("company_name") or meta.get("companyName") or ""

            if company_name_raw:
                # Slugify: "Hatton National Bank PLC" -> "hatton-national-bank-plc"
                slug = re.sub(r"[^a-z0-9]+", "-", company_name_raw.lower()).strip("-")
                db = get_mongo_db()
                company_doc = db["companies"].find_one({"slug": slug})

                if not company_doc:
                    # Try a case-insensitive name match as fallback
                    company_doc = db["companies"].find_one(
                        {"name": {"$regex": f"^{re.escape(company_name_raw)}$", "$options": "i"}}
                    )

                if company_doc and isinstance(company_doc.get("financials"), dict):
                    _analyze_logger.info("Found company '%s' in MongoDB companies collection", company_name_raw)
                    financials = company_doc["financials"]

                    for year_key, year_data in financials.items():
                        if not isinstance(year_data, dict):
                            continue
                        mapped_doc = {
                            "year": year_key,
                            "balance_sheet": year_data.get("balance_sheet") if isinstance(year_data.get("balance_sheet"), dict) else {},
                            "income_statement": year_data.get("income_statement") if isinstance(year_data.get("income_statement"), dict) else {},
                            "cashflow_statement": year_data.get("cashflow_statement") if isinstance(year_data.get("cashflow_statement"), dict) else {},
                            "equity_statement": year_data.get("equity_statement") if isinstance(year_data.get("equity_statement"), dict) else {},
                            "currency": year_data.get("currency", company_doc.get("currency", "LKR")),
                            "unit_multiplier": year_data.get("unit_multiplier"),
                            "unit_detected": year_data.get("unit_detected"),
                            "source_file": f"mongodb:companies:{slug}",
                            "extraction_confidence": float(year_data.get("extraction_confidence", 1.0) or 1.0),
                            "metrics_extracted_count": int(year_data.get("metrics_extracted_count", 0) or 0),
                        }
                        temp_docs.append(mapped_doc)

                    if temp_docs:
                        data_source = "mongodb_companies"
                        _analyze_logger.info("Loaded %d year(s) from MongoDB companies collection for '%s'", len(temp_docs), company_name_raw)
                else:
                    _analyze_logger.info("Company '%s' not found in MongoDB companies collection, trying fallbacks", company_name_raw)
        except Exception as exc:
            _analyze_logger.warning("MongoDB companies lookup failed: %s", exc)

        # --- Attempt 2: fetch_temporary_financial_statements (Redis/Atlas temp docs) ---
        if not temp_docs:
            try:
                temp_docs = fetch_temporary_financial_statements(request.report_id)
                if temp_docs:
                    data_source = "temp_financial_statements"
                    _analyze_logger.info("Loaded %d temp doc(s) via fetch_temporary_financial_statements", len(temp_docs))
            except Exception as exc:
                _analyze_logger.warning("fetch_temporary_financial_statements failed: %s", exc)

        # --- Attempt 3: normalize.json local file fallback ---
        if not temp_docs:
            normalize_path = Path("normalize.json")
            if normalize_path.exists():
                with open(normalize_path, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)

                if not isinstance(raw_data, list):
                    raw_data = [raw_data]

                for item in raw_data:
                    mapped_doc = {
                        "year": item.get("year", item.get("Year")),
                        "balance_sheet": {
                            "total_assets": item.get("total_assets", item.get("Total Assets", item.get("totalAssets"))),
                            "total_liabilities": item.get("total_liabilities", item.get("Total Liabilities", item.get("totalLiabilities"))),
                            "total_equity": item.get("total_equity", item.get("Total Equity", item.get("totalEquity"))),
                            "borrowings": item.get("borrowings", item.get("Borrowings", item.get("borrowings"))),
                            "cash_and_equivalents": item.get("cash_and_equivalents", item.get("Cash and Equivalents", item.get("cashAndEquivalents")))
                        },
                        "income_statement": {
                            "revenue_or_interest_income": item.get("revenue_or_interest_income", item.get("Revenue", item.get("revenue"))),
                            "net_profit": item.get("net_profit", item.get("Net Profit", item.get("netProfit"))),
                            "operating_expenses": item.get("operating_expenses", item.get("Operating Expenses", item.get("operatingExpenses"))),
                            "operating_profit": item.get("operating_profit", item.get("Operating Profit", item.get("operatingProfit")))
                        },
                        "cashflow_statement": {
                            "net_cash_change": item.get("net_cash_change", item.get("Net Cash Change", item.get("netCashChange"))),
                            "investing_cash_flow": item.get("investing_cash_flow", item.get("Investing Cash Flow", item.get("investingCashFlow")))
                        },
                        "source_file": "normalize.json",
                        "extraction_confidence": 1.0,
                        "metrics_extracted_count": 0
                    }

                    for section in ["balance_sheet", "income_statement", "cashflow_statement"]:
                        for k, v in mapped_doc[section].items():
                            if v is not None:
                                try:
                                    mapped_doc[section][k] = float(v)
                                except (ValueError, TypeError):
                                    mapped_doc[section][k] = None

                    temp_docs.append(mapped_doc)

                if temp_docs:
                    data_source = "normalize_json"
                    _analyze_logger.info("Loaded %d doc(s) from normalize.json", len(temp_docs))

        _analyze_logger.info("Data source for report_id=%s: %s (%d docs)", request.report_id, data_source, len(temp_docs))
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

        post_extraction_flags = merged.get("post_extraction_flags") if isinstance(merged.get("post_extraction_flags"), list) else []
        for flag in post_extraction_flags:
            if not isinstance(flag, str):
                continue
            issues.append(
                ValidationIssue(
                    code="POST_EXTRACTION_VALIDATION_FLAG",
                    message=flag,
                    severity="error" if flag.startswith("negative_revenue_detected") else "warning",
                )
            )

        if int(merged.get("duplicate_year_merges", 0) or 0) > 0:
            issues.append(
                ValidationIssue(
                    code="DUPLICATE_YEAR_DETECTED",
                    message=f"duplicate_year_merged_count={int(merged.get('duplicate_year_merges', 0) or 0)}",
                    severity="warning",
                )
            )

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
        data_reliability_report = _build_data_reliability_report(merged, hard_validation, issues)
        set_json(redis, f"report:{request.report_id}:data_reliability_report", data_reliability_report, cfg.redis_ttl_seconds)

        required_coverage_by_year = {
            y: int(merged["financials"].get(y, {}).get("required_metrics_count", 0))
            for y in merged["years"]
        }
        ratio_eligible_years = [y for y, count in required_coverage_by_year.items() if count >= 5]

        restricted_mode = not bool(hard_validation.get("all_passed"))

        if ratio_eligible_years:
            ratios = compute_ratios(validated)
            ratios["restatement_events"] = merged.get("restatement_events", [])
            ratios["data_reliability_report"] = data_reliability_report
            ratios, guardrail_anomalies = _apply_ratio_guardrails(ratios)
            ratios["gating"] = {
                "status": "restricted" if restricted_mode else "executed",
                "ratio_eligible_years": ratio_eligible_years,
                "required_metric_coverage_by_year": required_coverage_by_year,
                "hard_validation": hard_validation,
            }
            if guardrail_anomalies:
                ratios.setdefault("limitations", {})
                ratios["limitations"]["ratio_guardrail_anomalies"] = guardrail_anomalies
                for failure in guardrail_anomalies:
                    issues.append(
                        ValidationIssue(
                            code="RATIO_GUARDRAIL_ANOMALY",
                            message=str(failure),
                            severity="warning",
                        )
                    )
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

        ratios = _enforce_analysis_years_on_ratios(ratios, merged["years"])
        ratios["analysis_years"] = list(merged["years"])
        ratios["post_extraction_flags"] = post_extraction_flags

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
        extraction_coverage = get_json(redis, f"report:{request.report_id}:extraction_coverage", default={})
        confidence = compute_confidence(issues, ratios, kpis, merged, extraction_coverage=extraction_coverage)
        confidence["extraction_confidence"] = float(extraction_coverage.get("avg_extraction_confidence", 0.0) or 0.0)
        confidence["extraction_agreement_score"] = float(extraction_coverage.get("avg_extraction_agreement", 0.0) or 0.0)
        confidence["re_extraction_attempts_average"] = float(extraction_coverage.get("avg_re_extraction_attempts", 1.0) or 1.0)
        confidence["metrics_extracted_count"] = int(extraction_coverage.get("metrics_extracted_count", 0) or 0)
        confidence["detected_years"] = merged["years"]
        confidence["hard_validation"] = hard_validation

        if restricted_mode:
            risk = {
                "status": "blocked",
                "reason": "risk_model_disabled_due_to_hard_validation_failure",
                "hard_validation": hard_validation,
            }
        elif float(confidence.get("score", 0.0) or 0.0) < 0.75:
            risk = {
                "status": "blocked",
                "reason": "risk_model_blocked_due_to_low_confidence",
                "required_confidence": 0.75,
                "actual_confidence": float(confidence.get("score", 0.0) or 0.0),
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
            "restatement_events": merged.get("restatement_events", []),
            "duplicate_year_merges": int(merged.get("duplicate_year_merges", 0) or 0),
            "post_extraction_flags": post_extraction_flags,
            "data_gaps": merged.get("data_gaps", []),
            "comparative_availability": merged.get("comparative_availability", False),
            "data_reliability_report": data_reliability_report,
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


class AnalyzeDatasetRequest(BaseModel):
    company_name: str
    company: str
    currency: str
    years: dict[str, Any]
    financial_graph: dict[str, Any]
    metadata: dict[str, Any] | None = None


@app.post('/analyze-dataset')
def analyze_dataset(request: AnalyzeDatasetRequest) -> dict[str, Any]:
    try:
        from strict_pipeline import build_strict_analysis_result
    except ImportError:
        from services.analysis_service.strict_pipeline import build_strict_analysis_result
    
    dataset = request.model_dump()
    return build_strict_analysis_result(dataset)


@app.get('/health')
def health() -> dict[str, str]:
    return {"status": "ok", "service": "analysis-service"}
