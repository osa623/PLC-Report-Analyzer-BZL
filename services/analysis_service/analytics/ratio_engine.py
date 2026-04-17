from __future__ import annotations

import math
import re
from collections import defaultdict

from platform_core.contracts.canonical_dataset import CanonicalValidatedReport


def _to_number(value: float | None) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if math.isnan(float(value)):
            return None
        return float(value)
    return None


def _safe_div(numerator: float | None, denominator: float | None) -> float | None:
    n = _to_number(numerator)
    d = _to_number(denominator)
    if n is None or d is None or d == 0:
        return None
    return n / d


def _extract_year(period: str | None) -> str:
    if not period:
        return "latest"
    match = re.search(r"\b(19|20)\d{2}\b", period)
    return match.group(0) if match else "latest"


def _normalize_label(label: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", " ", label.strip().lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def _put_first(target: dict[str, float], key: str, value: float | None) -> None:
    if key not in target and value is not None:
        target[key] = value


def _build_statement_maps(validated: CanonicalValidatedReport) -> dict[str, dict[str, dict[str, float]]]:
    grouped: dict[str, dict[str, dict[str, float]]] = {
        "income_statement": defaultdict(dict),
        "balance_sheet": defaultdict(dict),
        "cashflow": defaultdict(dict),
    }

    for item in validated.financial_statements.income_statement:
        year = _extract_year(item.period)
        value = _to_number(item.value)
        if value is not None:
            grouped["income_statement"][year][_normalize_label(item.label)] = value

    for item in validated.financial_statements.balance_sheet:
        year = _extract_year(item.period)
        value = _to_number(item.value)
        if value is not None:
            grouped["balance_sheet"][year][_normalize_label(item.label)] = value

    for item in validated.financial_statements.cashflow:
        year = _extract_year(item.period)
        value = _to_number(item.value)
        if value is not None:
            grouped["cashflow"][year][_normalize_label(item.label)] = value

    return grouped


def _find_value(statement: dict[str, float], candidates: list[str]) -> float | None:
    if not statement:
        return None

    # Fast exact match against normalized keys.
    for key in candidates:
        nk = _normalize_label(key)
        if nk in statement:
            return statement[nk]

    # Fallback fuzzy match for labels like "total assets as at" or "cash and cash equivalents".
    for raw_label, value in statement.items():
        for key in candidates:
            nk = _normalize_label(key)
            if nk and (nk in raw_label or raw_label in nk):
                return value
    return None


def _compute_year_ratios(year: str, income: dict[str, float], balance: dict[str, float], cashflow: dict[str, float]) -> dict[str, float]:
    revenue = _find_value(income, ["revenue", "total revenue", "sales"])
    cost_of_revenue = _find_value(income, ["cost of revenue", "cost of goods sold", "cogs", "cost of sales"])
    gross_profit = _find_value(income, ["gross profit"])
    operating_income = _find_value(income, ["operating income", "operating profit"])
    operating_expenses = _find_value(income, ["operating expenses", "operating expense"])
    net_profit = _find_value(income, ["net profit", "net income", "profit for the year"])

    current_assets = _find_value(balance, ["current assets"])
    current_liabilities = _find_value(balance, ["current liabilities"])
    cash_and_equivalents = _find_value(balance, ["cash and equivalents", "cash", "cash equivalents"])
    total_assets = _find_value(balance, ["total assets", "assets"])
    total_liabilities = _find_value(balance, ["total liabilities", "liabilities"])
    shareholder_equity = _find_value(balance, ["shareholder equity", "shareholders equity", "total equity", "equity"])
    debt = _find_value(balance, ["debt", "total debt", "borrowings"])

    operating_cash_flow = _find_value(cashflow, ["operating cash flow", "cash from operations"])

    if gross_profit is None and revenue is not None and cost_of_revenue is not None:
        gross_profit = revenue - cost_of_revenue
    if operating_income is None and gross_profit is not None and operating_expenses is not None:
        operating_income = gross_profit - operating_expenses

    quick_assets = None
    if current_assets is not None:
        inventory = _find_value(balance, ["inventory", "inventories"])
        quick_assets = current_assets - inventory if inventory is not None else current_assets

    ratios: dict[str, float] = {}
    _put_first(ratios, "gross_margin", _safe_div(gross_profit, revenue))
    _put_first(ratios, "operating_margin", _safe_div(operating_income, revenue))
    _put_first(ratios, "net_margin", _safe_div(net_profit, revenue))
    _put_first(ratios, "return_on_assets", _safe_div(net_profit, total_assets))
    _put_first(ratios, "return_on_equity", _safe_div(net_profit, shareholder_equity))

    _put_first(ratios, "current_ratio", _safe_div(current_assets, current_liabilities))
    _put_first(ratios, "quick_ratio", _safe_div(quick_assets, current_liabilities))
    _put_first(ratios, "cash_ratio", _safe_div(cash_and_equivalents, current_liabilities))

    _put_first(ratios, "debt_to_equity", _safe_div(debt if debt is not None else total_liabilities, shareholder_equity))
    _put_first(ratios, "debt_ratio", _safe_div(total_liabilities, total_assets))
    _put_first(ratios, "interest_coverage", _safe_div(operating_income, _find_value(income, ["interest expense", "finance costs"])))

    _put_first(ratios, "asset_turnover", _safe_div(revenue, total_assets))
    _put_first(ratios, "equity_turnover", _safe_div(revenue, shareholder_equity))

    # Compatibility fields used by existing consumers.
    _put_first(ratios, "debt_to_assets", ratios.get("debt_ratio"))

    if operating_cash_flow is not None and current_liabilities is not None:
        _put_first(ratios, "operating_cashflow_to_current_liabilities", _safe_div(operating_cash_flow, current_liabilities))

    return ratios


def _compute_growth_rates(yearly_values: dict[str, float]) -> float | None:
    if len(yearly_values) < 2:
        return None
    years = sorted(yearly_values.keys())
    first_year, last_year = years[0], years[-1]
    first = yearly_values.get(first_year)
    last = yearly_values.get(last_year)
    if first is None or last is None or first <= 0:
        return None
    periods = max(int(last_year) - int(first_year), len(years) - 1)
    if periods <= 0:
        return None
    return (last / first) ** (1 / periods) - 1


def compute_ratios(validated: CanonicalValidatedReport) -> dict:
    grouped = _build_statement_maps(validated)

    years = sorted({*grouped["income_statement"].keys(), *grouped["balance_sheet"].keys(), *grouped["cashflow"].keys()})
    if not years:
        years = ["latest"]

    per_year: dict[str, dict[str, float]] = {}
    for year in years:
        per_year[year] = _compute_year_ratios(
            year,
            grouped["income_statement"].get(year, {}),
            grouped["balance_sheet"].get(year, {}),
            grouped["cashflow"].get(year, {}),
        )

    latest_year = years[-1]
    output: dict = dict(per_year.get(latest_year, {}))
    output["by_year"] = per_year
    output["detected_years"] = years
    output["latest_year"] = latest_year

    metric_sources = {
        "revenue_cagr": {
            y: _find_value(grouped["income_statement"].get(y, {}), ["revenue", "total revenue", "sales"])
            for y in years
        },
        "profit_cagr": {
            y: _find_value(grouped["income_statement"].get(y, {}), ["net profit", "net income", "profit for the year"])
            for y in years
        },
        "asset_growth_rate": {
            y: _find_value(grouped["balance_sheet"].get(y, {}), ["total assets", "assets"])
            for y in years
        },
        "equity_growth_rate": {
            y: _find_value(grouped["balance_sheet"].get(y, {}), ["shareholder equity", "shareholders equity", "total equity", "equity"])
            for y in years
        },
    }

    growth: dict[str, float | None] = {}
    for metric, values in metric_sources.items():
        numeric_values = {y: v for y, v in values.items() if v is not None and y.isdigit()}
        growth[metric] = _compute_growth_rates(numeric_values)

    output["growth"] = growth
    latest_metrics = per_year.get(latest_year, {}) if isinstance(per_year.get(latest_year), dict) else {}
    numeric_latest_metrics = len([v for v in latest_metrics.values() if isinstance(v, (int, float))])
    output["limitations"] = {
        "growth_metrics_limited": len([y for y in years if y.isdigit()]) < 2,
        "no_extractable_financial_metrics": numeric_latest_metrics == 0,
    }
    return output

    current_assets = bs.get("current assets", bs.get("total assets", 0.0))
    current_liabilities = bs.get("current liabilities", bs.get("total liabilities", 1.0)) or 1.0
    total_assets = bs.get("total assets", 1.0) or 1.0
    total_liabilities = bs.get("total liabilities", 0.0)
    net_income = inc.get("net income", 0.0)

    return {
        "current_ratio": current_assets / current_liabilities,
        "debt_to_assets": total_liabilities / total_assets,
        "return_on_assets": net_income / total_assets,
    }
