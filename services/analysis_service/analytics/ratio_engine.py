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


def _extract_year(period: str | None) -> str | None:
    if not period:
        return None
    text = str(period)

    # Pattern: YYYY/YY (e.g. 2024/23) -> include both years.
    slash_match = re.search(r"\b((?:19|20)\d{2})\s*/\s*(\d{2})\b", text)
    if slash_match:
        left = int(slash_match.group(1))
        right_two = int(slash_match.group(2))
        left_century = (left // 100) * 100
        right = left_century + right_two
        if right > left:
            right -= 100
        return str(max(left, right))

    match = re.search(r"\b((?:19|20)\d{2})\b", text)
    return match.group(1) if match else None


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
        if year is None:
            continue
        value = _to_number(item.value)
        if value is not None:
            grouped["income_statement"][year][_normalize_label(item.label)] = value

    for item in validated.financial_statements.balance_sheet:
        year = _extract_year(item.period)
        if year is None:
            continue
        value = _to_number(item.value)
        if value is not None:
            grouped["balance_sheet"][year][_normalize_label(item.label)] = value

    for item in validated.financial_statements.cashflow:
        year = _extract_year(item.period)
        if year is None:
            continue
        value = _to_number(item.value)
        if value is not None:
            grouped["cashflow"][year][_normalize_label(item.label)] = value

    return grouped


def _collect_statement_years(validated: CanonicalValidatedReport) -> list[str]:
    years: set[str] = set()
    for item in validated.financial_statements.income_statement:
        year = _extract_year(item.period)
        if year:
            years.add(year)
    for item in validated.financial_statements.balance_sheet:
        year = _extract_year(item.period)
        if year:
            years.add(year)
    for item in validated.financial_statements.cashflow:
        year = _extract_year(item.period)
        if year:
            years.add(year)
    for item in validated.financial_statements.equity:
        year = _extract_year(item.period)
        if year:
            years.add(year)

    return sorted([y for y in years if y.isdigit()], key=lambda y: int(y))


def _find_value(statement: dict[str, float], candidates: list[str]) -> float | None:
    if not statement:
        return None

    for key in candidates:
        nk = _normalize_label(key)
        if nk in statement:
            return statement[nk]

    for raw_label, value in statement.items():
        for key in candidates:
            nk = _normalize_label(key)
            if nk and (nk in raw_label or raw_label in nk):
                return value
    return None


def _yoy(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None or previous == 0:
        return None
    return (current - previous) / abs(previous)


def _avg(a: float | None, b: float | None) -> float | None:
    if a is None or b is None:
        return None
    return (a + b) / 2.0


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


METRIC_ALIASES: dict[str, list[str]] = {
    "revenue": ["revenue", "turnover", "gross income", "total revenue", "sales", "interest income"],
    "net_profit": ["profit after tax", "net income", "net profit", "profit for the year", "profit attributable"],
    "operating_profit": ["operating profit", "operating income", "ebit"],
    "operating_expenses": ["operating expenses", "operating expense", "total operating expenses"],
    "profit_before_tax": ["profit before tax", "profit before taxation", "pbt"],
    "tax_expense": ["income tax expense", "tax expense", "income tax", "tax charge"],
    "gross_profit": ["gross profit"],
    "cost_of_revenue": ["cost of revenue", "cost of goods sold", "cogs", "cost of sales"],
    "eps": ["eps", "earnings per share", "basic earnings per share"],
    "current_assets": ["current assets"],
    "current_liabilities": ["current liabilities"],
    "inventory": ["inventory", "inventories", "stocks"],
    "cash": ["cash and equivalents", "cash", "cash equivalents", "cash and cash equivalents"],
    "total_assets": ["total assets", "assets"],
    "equity": ["shareholder equity", "shareholders equity", "total equity", "equity"],
    "intangible_assets": ["intangible assets", "goodwill", "intangible asset"],
    "total_liabilities": ["total liabilities", "liabilities"],
    "total_debt": ["debt", "total debt", "borrowings", "interest bearing debt"],
    "interest_expense": ["interest expense", "finance costs", "finance expense"],
    "receivables": ["trade receivables", "accounts receivable", "receivables"],
    "payables": ["trade payables", "accounts payable", "payables"],
    "operating_cash_flow": ["operating cash flow", "cash from operations", "net cash from operating activities", "net cash inflow from operating activities", "net cash in flow from operating activities"],
    "net_interest_income": ["net interest income", "net interest revenue"],
    "loans": ["loans and advances", "gross loans", "loan portfolio", "total loans"],
    "deposits": ["customer deposits", "total deposits", "deposits"],
    "operating_income_total": ["operating income", "total operating income"],
    "investing_cash_flow": ["investing cash flow", "net cash used in investing activities"],
    "financing_cash_flow": ["financing cash flow", "net cash from financing activities"],
    "net_cash_change": ["net cash flow", "net increase in cash", "net change in cash"],
    "capex": ["capital expenditure", "capex", "purchase of property plant and equipment"],
    "dividends_paid": ["dividends paid", "dividend paid"],
    "dividend_per_share": ["dividend per share", "dps"],
    "shares_outstanding": ["shares outstanding", "number of shares", "weighted average shares"],
    "book_value_per_share": ["book value per share", "nav per share"],
    "price": ["share price", "market price"],
    "ebitda": ["ebitda", "earnings before interest tax depreciation and amortisation", "earnings before interest tax depreciation and amortization"],
    "depreciation": ["depreciation", "depreciation and amortisation", "depreciation and amortization"],
}


INSTITUTIONAL_RATIO_KEYS: list[str] = [
    "revenue",
    "net_income",
    "revenue_growth_yoy",
    "net_profit_growth_yoy",
    "operating_profit_growth_yoy",
    "eps_growth_yoy",
    "asset_growth_yoy",
    "equity_growth_yoy",
    "gross_profit_margin",
    "net_profit_margin",
    "effective_tax_rate",
    "operating_expense_ratio",
    "earnings_growth_rate",
    "ebit_growth_vs_revenue_growth",
    "expense_elasticity",
    "tangible_net_worth",
    "capital_employed",
    "equity_ratio",
    "net_asset_value",
    "net_asset_growth_rate",
    "equity_buffer_ratio",
    "net_debt_issued_repaid",
    "net_cash_flow",
    "ocf_to_debt_ratio",
    "cash_flow_to_net_income",
    "operating_cash_flow_margin",
    "cash_return_on_assets",
    "cash_return_on_equity",
    "return_on_equity",
    "return_on_assets",
    "current_ratio",
    "quick_ratio",
    "cash_ratio",
    "debt_to_equity",
    "debt_ratio",
    "total_assets",
    "total_liabilities",
    "total_equity",
    "interest_coverage",
    "eps",
    "book_value_per_share",
    "dividend_per_share",
    "earnings_yield",
    "dividend_payout_ratio",
    "dividend_coverage_ratio",
    "cash_interest_coverage",
    "price_to_earnings_ratio",
    "price_to_book_ratio",
    "dividend_yield",
    "market_capitalization",
    "enterprise_value",
    "total_cash_flow",
]


def _linear_slope(series: list[float]) -> float | None:
    if len(series) < 2:
        return None
    n = len(series)
    xs = list(range(n))
    sum_x = float(sum(xs))
    sum_y = float(sum(series))
    sum_xy = float(sum(x * y for x, y in zip(xs, series)))
    sum_x2 = float(sum(x * x for x in xs))
    denom = (n * sum_x2) - (sum_x * sum_x)
    if denom == 0:
        return None
    return ((n * sum_xy) - (sum_x * sum_y)) / denom


def _stddev(series: list[float]) -> float | None:
    if len(series) < 2:
        return None
    mean = sum(series) / float(len(series))
    var = sum((x - mean) ** 2 for x in series) / float(len(series) - 1)
    return math.sqrt(var)


def _compute_year_view(base: dict[str, float | None], prev_base: dict[str, float | None]) -> dict[str, float]:
    revenue = base.get("revenue")
    net_profit = base.get("net_profit")
    operating_profit = base.get("operating_profit")
    operating_expenses = base.get("operating_expenses")
    profit_before_tax = base.get("profit_before_tax")
    tax_expense = base.get("tax_expense")
    eps = base.get("eps")
    assets = base.get("total_assets")
    intangible_assets = base.get("intangible_assets")
    equity = base.get("equity")
    liabilities = base.get("total_liabilities")
    current_assets = base.get("current_assets")
    current_liabilities = base.get("current_liabilities")
    inventory = base.get("inventory")
    cash = base.get("cash")
    debt = base.get("total_debt") if base.get("total_debt") is not None else liabilities
    interest_expense = base.get("interest_expense")
    gross_profit = base.get("gross_profit")
    cost_of_revenue = base.get("cost_of_revenue")
    receivables = base.get("receivables")
    payables = base.get("payables")
    operating_cash_flow = base.get("operating_cash_flow")
    net_interest_income = base.get("net_interest_income")
    loans = base.get("loans")
    deposits = base.get("deposits")
    operating_income_total = base.get("operating_income_total")
    investing_cash_flow = base.get("investing_cash_flow")
    financing_cash_flow = base.get("financing_cash_flow")
    capex = base.get("capex")
    dividends_paid = base.get("dividends_paid")
    dividend_per_share = base.get("dividend_per_share")
    shares = base.get("shares_outstanding")
    bvps = base.get("book_value_per_share")
    price = base.get("price")
    ebitda = base.get("ebitda")
    depreciation = base.get("depreciation")

    if ebitda is None and isinstance(operating_profit, (int, float)) and isinstance(depreciation, (int, float)):
        ebitda = float(operating_profit) + float(depreciation)

    if gross_profit is None and revenue is not None and cost_of_revenue is not None:
        gross_profit = revenue - cost_of_revenue

    quick_assets = current_assets - inventory if isinstance(current_assets, (int, float)) and isinstance(inventory, (int, float)) else current_assets
    capex_proxy = capex
    if capex_proxy is None and isinstance(investing_cash_flow, (int, float)) and investing_cash_flow < 0:
        capex_proxy = abs(float(investing_cash_flow))
    free_cash_flow = operating_cash_flow - capex_proxy if isinstance(operating_cash_flow, (int, float)) and isinstance(capex_proxy, (int, float)) else None
    total_cash_flow = (
        float(operating_cash_flow) + float(investing_cash_flow) + float(financing_cash_flow)
        if all(isinstance(v, (int, float)) for v in [operating_cash_flow, investing_cash_flow, financing_cash_flow])
        else None
    )
    tangible_net_worth = equity - intangible_assets if isinstance(equity, (int, float)) and isinstance(intangible_assets, (int, float)) else equity
    capital_employed = assets - current_liabilities if isinstance(assets, (int, float)) and isinstance(current_liabilities, (int, float)) else None
    if eps is None and isinstance(net_profit, (int, float)) and isinstance(shares, (int, float)) and shares != 0:
        eps = float(net_profit) / float(shares)
    if dividend_per_share is None and isinstance(dividends_paid, (int, float)) and isinstance(shares, (int, float)) and shares != 0:
        dividend_per_share = float(dividends_paid) / float(shares)

    ratios: dict[str, float] = {}

    _put_first(ratios, "revenue", revenue)
    _put_first(ratios, "net_income", net_profit)

    _put_first(ratios, "revenue_growth_yoy", _yoy(revenue, prev_base.get("revenue")))
    _put_first(ratios, "net_profit_growth_yoy", _yoy(net_profit, prev_base.get("net_profit")))
    _put_first(ratios, "operating_profit_growth_yoy", _yoy(operating_profit, prev_base.get("operating_profit")))
    _put_first(ratios, "eps_growth_yoy", _yoy(eps, prev_base.get("eps")))
    _put_first(ratios, "asset_growth_yoy", _yoy(assets, prev_base.get("total_assets")))
    _put_first(ratios, "equity_growth_yoy", _yoy(equity, prev_base.get("equity")))
    _put_first(ratios, "earnings_growth_rate", _yoy(net_profit, prev_base.get("net_profit")))

    revenue_growth = ratios.get("revenue_growth_yoy")
    ebit_growth = ratios.get("operating_profit_growth_yoy")
    expense_growth = _yoy(operating_expenses, prev_base.get("operating_expenses"))
    _put_first(ratios, "ebit_growth_vs_revenue_growth", _safe_div(ebit_growth, revenue_growth))
    _put_first(ratios, "expense_elasticity", _safe_div(expense_growth, revenue_growth))

    _put_first(ratios, "gross_profit_margin", _safe_div(gross_profit, revenue))
    _put_first(ratios, "net_profit_margin", _safe_div(net_profit, revenue))
    _put_first(ratios, "effective_tax_rate", _safe_div(tax_expense, profit_before_tax))
    _put_first(ratios, "operating_expense_ratio", _safe_div(operating_expenses, revenue))

    _put_first(ratios, "return_on_equity", _safe_div(net_profit, _avg(equity, prev_base.get("equity")) or equity))
    _put_first(ratios, "return_on_assets", _safe_div(net_profit, _avg(assets, prev_base.get("total_assets")) or assets))

    _put_first(ratios, "tangible_net_worth", tangible_net_worth)
    _put_first(ratios, "capital_employed", capital_employed)
    _put_first(ratios, "equity_ratio", _safe_div(equity, assets))
    _put_first(ratios, "net_asset_value", equity)
    _put_first(ratios, "net_asset_growth_rate", _yoy(equity, prev_base.get("equity")))
    _put_first(ratios, "equity_buffer_ratio", _safe_div(equity, liabilities))
    if isinstance(debt, (int, float)) and isinstance(prev_base.get("total_debt"), (int, float)):
        _put_first(ratios, "net_debt_issued_repaid", float(debt) - float(prev_base.get("total_debt")))

    _put_first(ratios, "current_ratio", _safe_div(current_assets, current_liabilities))
    _put_first(ratios, "quick_ratio", _safe_div(quick_assets, current_liabilities))
    _put_first(ratios, "cash_ratio", _safe_div(cash, current_liabilities))

    _put_first(ratios, "debt_to_equity", _safe_div(debt, equity))
    _put_first(ratios, "debt_ratio", _safe_div(debt, assets))
    _put_first(ratios, "total_assets", assets)
    _put_first(ratios, "total_liabilities", liabilities)
    _put_first(ratios, "total_equity", equity)
    _put_first(ratios, "interest_coverage", _safe_div(operating_profit, interest_expense))

    _put_first(ratios, "net_cash_flow", total_cash_flow)
    _put_first(ratios, "ocf_to_debt_ratio", _safe_div(operating_cash_flow, debt))
    _put_first(ratios, "cash_flow_to_net_income", _safe_div(operating_cash_flow, net_profit))
    _put_first(ratios, "operating_cash_flow_margin", _safe_div(operating_cash_flow, revenue))
    _put_first(ratios, "cash_return_on_assets", _safe_div(operating_cash_flow, assets))
    _put_first(ratios, "cash_return_on_equity", _safe_div(operating_cash_flow, equity))
    _put_first(ratios, "total_cash_flow", total_cash_flow)

    _put_first(ratios, "eps", eps)
    if bvps is None and isinstance(equity, (int, float)) and isinstance(shares, (int, float)) and shares != 0:
        bvps = equity / shares
    _put_first(ratios, "book_value_per_share", bvps)
    _put_first(ratios, "dividend_per_share", dividend_per_share)
    _put_first(ratios, "dividend_payout_ratio", _safe_div(dividends_paid, net_profit))
    _put_first(ratios, "dividend_coverage_ratio", _safe_div(net_profit, dividends_paid))
    _put_first(ratios, "cash_interest_coverage", _safe_div(operating_cash_flow, interest_expense))

    _put_first(ratios, "price_to_earnings_ratio", _safe_div(price, eps))
    _put_first(ratios, "price_to_book_ratio", _safe_div(price, bvps))
    _put_first(ratios, "earnings_yield", _safe_div(eps, price))
    _put_first(ratios, "dividend_yield", _safe_div(dividend_per_share, price))
    market_cap = price * shares if isinstance(price, (int, float)) and isinstance(shares, (int, float)) else None
    _put_first(ratios, "market_capitalization", market_cap)
    if isinstance(market_cap, (int, float)) and isinstance(debt, (int, float)) and isinstance(cash, (int, float)):
        _put_first(ratios, "enterprise_value", float(market_cap) + float(debt) - float(cash))

    normalized: dict[str, float | None] = {k: ratios.get(k) for k in INSTITUTIONAL_RATIO_KEYS}
    return normalized


def compute_ratios(validated: CanonicalValidatedReport) -> dict:
    years = _collect_statement_years(validated)
    if not years:
        return {
            "by_year": {},
            "detected_years": [],
            "latest_year": None,
            "reporting_periods": {
                "detected_periods": [],
                "has_comparatives": False,
            },
            "data_coverage": {
                "missing_or_unverifiable_values": {},
                "label_standardization": {
                    "revenue": METRIC_ALIASES["revenue"],
                    "net_profit": METRIC_ALIASES["net_profit"],
                    "equity": METRIC_ALIASES["equity"],
                },
            },
            "growth": {},
            "latest_growth_snapshot": {},
            "forensic_flags": [],
            "trend_diagnostics": {
                "revenue_growth_slope": None,
                "profit_growth_slope": None,
                "earnings_volatility": None,
                "growth_consistency_score": None,
                "acceleration_signal": "stable_or_insufficient_data",
            },
            "limitations": {
                "growth_metrics_limited": True,
                "no_extractable_financial_metrics": True,
            },
        }

    grouped = _build_statement_maps(validated)

    base_by_year: dict[str, dict[str, float | None]] = {}
    for year in years:
        base_by_year[year] = {
            "revenue": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["revenue"]),
            "net_profit": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["net_profit"]),
            "operating_profit": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["operating_profit"]),
            "operating_expenses": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["operating_expenses"]),
            "profit_before_tax": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["profit_before_tax"]),
            "tax_expense": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["tax_expense"]),
            "gross_profit": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["gross_profit"]),
            "cost_of_revenue": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["cost_of_revenue"]),
            "eps": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["eps"]),
            "interest_expense": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["interest_expense"]),
            "current_assets": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["current_assets"]),
            "current_liabilities": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["current_liabilities"]),
            "inventory": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["inventory"]),
            "cash": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["cash"]),
            "total_assets": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["total_assets"]),
            "equity": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["equity"]),
            "intangible_assets": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["intangible_assets"]),
            "total_liabilities": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["total_liabilities"]),
            "total_debt": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["total_debt"]),
            "receivables": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["receivables"]),
            "payables": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["payables"]),
            "book_value_per_share": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["book_value_per_share"]),
            "shares_outstanding": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["shares_outstanding"]),
            "price": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["price"]),
            "ebitda": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["ebitda"]),
            "depreciation": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["depreciation"]),
            "operating_cash_flow": _find_value(grouped["cashflow"].get(year, {}), METRIC_ALIASES["operating_cash_flow"]),
            "net_interest_income": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["net_interest_income"]),
            "loans": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["loans"]),
            "deposits": _find_value(grouped["balance_sheet"].get(year, {}), METRIC_ALIASES["deposits"]),
            "operating_income_total": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["operating_income_total"]),
            "investing_cash_flow": _find_value(grouped["cashflow"].get(year, {}), METRIC_ALIASES["investing_cash_flow"]),
            "financing_cash_flow": _find_value(grouped["cashflow"].get(year, {}), METRIC_ALIASES["financing_cash_flow"]),
            "net_cash_change": _find_value(grouped["cashflow"].get(year, {}), METRIC_ALIASES["net_cash_change"]),
            "capex": _find_value(grouped["cashflow"].get(year, {}), METRIC_ALIASES["capex"]),
            "dividends_paid": _find_value(grouped["cashflow"].get(year, {}), METRIC_ALIASES["dividends_paid"]),
            "dividend_per_share": _find_value(grouped["income_statement"].get(year, {}), METRIC_ALIASES["dividend_per_share"]),
        }

    per_year: dict[str, dict[str, float]] = {}
    for idx, year in enumerate(years):
        prev_year = years[idx - 1] if idx > 0 else None
        prev_base = base_by_year.get(prev_year, {}) if prev_year else {}
        year_view = _compute_year_view(base_by_year.get(year, {}), prev_base)
        if "free_cash_flow" in year_view:
            base_by_year[year]["free_cash_flow"] = year_view["free_cash_flow"]
        per_year[year] = year_view

    latest_year = years[-1]
    output: dict = dict(per_year.get(latest_year, {}))
    output["by_year"] = per_year
    output["detected_years"] = years
    output["latest_year"] = latest_year
    output["reporting_periods"] = {
        "detected_periods": years,
        "has_comparatives": len([y for y in years if y.isdigit()]) >= 2,
    }

    missing_metrics_by_year: dict[str, list[str]] = {}
    for year in years:
        missing = [
            metric
            for metric, value in base_by_year.get(year, {}).items()
            if value is None and metric in {
                "revenue",
                "net_profit",
                "operating_profit",
                "total_assets",
                "equity",
                "current_assets",
                "current_liabilities",
                "total_liabilities",
                "operating_cash_flow",
            }
        ]
        missing_metrics_by_year[year] = missing

    output["data_coverage"] = {
        "missing_or_unverifiable_values": missing_metrics_by_year,
        "label_standardization": {
            "revenue": METRIC_ALIASES["revenue"],
            "net_profit": METRIC_ALIASES["net_profit"],
            "equity": METRIC_ALIASES["equity"],
        },
    }

    metric_sources = {
        "revenue_cagr": {y: base_by_year.get(y, {}).get("revenue") for y in years},
        "profit_cagr": {y: base_by_year.get(y, {}).get("net_profit") for y in years},
        "asset_growth_rate": {y: base_by_year.get(y, {}).get("total_assets") for y in years},
        "equity_growth_rate": {y: base_by_year.get(y, {}).get("equity") for y in years},
    }

    growth: dict[str, float | None] = {}
    for metric, values in metric_sources.items():
        numeric_values = {y: v for y, v in values.items() if v is not None and y.isdigit()}
        growth[metric] = _compute_growth_rates(numeric_values)
    output["growth"] = growth

    if len(years) >= 2:
        prev_year = years[-2]
        output["latest_growth_snapshot"] = {
            "period": latest_year,
            "previous_period": prev_year,
            "revenue_growth_yoy": _yoy(base_by_year.get(latest_year, {}).get("revenue"), base_by_year.get(prev_year, {}).get("revenue")),
            "net_profit_growth_yoy": _yoy(base_by_year.get(latest_year, {}).get("net_profit"), base_by_year.get(prev_year, {}).get("net_profit")),
            "earnings_growth_rate": _yoy(base_by_year.get(latest_year, {}).get("net_profit"), base_by_year.get(prev_year, {}).get("net_profit")),
            "operating_profit_growth_yoy": _yoy(base_by_year.get(latest_year, {}).get("operating_profit"), base_by_year.get(prev_year, {}).get("operating_profit")),
            "eps_growth_yoy": _yoy(base_by_year.get(latest_year, {}).get("eps"), base_by_year.get(prev_year, {}).get("eps")),
            "asset_growth_yoy": _yoy(base_by_year.get(latest_year, {}).get("total_assets"), base_by_year.get(prev_year, {}).get("total_assets")),
            "equity_growth_yoy": _yoy(base_by_year.get(latest_year, {}).get("equity"), base_by_year.get(prev_year, {}).get("equity")),
        }
    else:
        output["latest_growth_snapshot"] = {}

    forensic_flags: list[str] = []
    for i in range(1, len(years)):
        y = years[i]
        py = years[i - 1]
        y_np = base_by_year.get(y, {}).get("net_profit")
        py_np = base_by_year.get(py, {}).get("net_profit")
        y_ocf = base_by_year.get(y, {}).get("operating_cash_flow")
        py_ocf = base_by_year.get(py, {}).get("operating_cash_flow")
        y_rev = base_by_year.get(y, {}).get("revenue")
        py_rev = base_by_year.get(py, {}).get("revenue")
        y_debt = base_by_year.get(y, {}).get("total_debt")
        py_debt = base_by_year.get(py, {}).get("total_debt")
        y_assets = base_by_year.get(y, {}).get("total_assets")
        py_assets = base_by_year.get(py, {}).get("total_assets")
        y_recv = base_by_year.get(y, {}).get("receivables")
        py_recv = base_by_year.get(py, {}).get("receivables")
        y_inv = base_by_year.get(y, {}).get("inventory")
        py_inv = base_by_year.get(py, {}).get("inventory")

        if _yoy(y_np, py_np) is not None and _yoy(y_ocf, py_ocf) is not None and _yoy(y_np, py_np) > 0 and _yoy(y_ocf, py_ocf) < 0:
            forensic_flags.append(f"Profit quality risk ({y}): net profit rising while operating cash flow falling")
        if _yoy(y_debt, py_debt) is not None and _yoy(y_debt, py_debt) > 0.25:
            forensic_flags.append(f"Leverage risk ({y}): rapid debt growth")
        if _yoy(y_assets, py_assets) is not None and _yoy(y_debt, py_debt) is not None and _yoy(y_assets, py_assets) > 0 and _yoy(y_debt, py_debt) > 0 and _yoy(y_ocf, py_ocf) is not None and _yoy(y_ocf, py_ocf) < 0:
            forensic_flags.append(f"Aggressive expansion signal ({y}): assets up, debt up, cash flow down")
        if _yoy(y_recv, py_recv) is not None and _yoy(y_rev, py_rev) is not None and _yoy(y_recv, py_recv) > _yoy(y_rev, py_rev):
            forensic_flags.append(f"Operational risk ({y}): receivables growth outpacing revenue")
        if _yoy(y_inv, py_inv) is not None and _yoy(y_rev, py_rev) is not None and _yoy(y_inv, py_inv) > _yoy(y_rev, py_rev):
            forensic_flags.append(f"Operational risk ({y}): inventory growth outpacing revenue")

    latest_metrics = per_year.get(latest_year, {}) if isinstance(per_year.get(latest_year), dict) else {}
    fcf_latest = latest_metrics.get("free_cash_flow")
    if isinstance(fcf_latest, (int, float)) and fcf_latest < 0:
        forensic_flags.append("Cash flow risk: negative free cash flow in latest period")

    output["forensic_flags"] = forensic_flags

    # Multi-year trend diagnostics for institutional analysis.
    rev_growth_series = [float(per_year[y].get("revenue_growth_yoy")) for y in years if isinstance(per_year.get(y, {}).get("revenue_growth_yoy"), (int, float))]
    profit_growth_series = [float(per_year[y].get("net_profit_growth_yoy")) for y in years if isinstance(per_year.get(y, {}).get("net_profit_growth_yoy"), (int, float))]
    earnings_series = [float(base_by_year.get(y, {}).get("net_profit")) for y in years if isinstance(base_by_year.get(y, {}).get("net_profit"), (int, float))]

    growth_consistency = None
    if rev_growth_series:
        positive = len([x for x in rev_growth_series if x > 0])
        growth_consistency = positive / float(len(rev_growth_series))

    output["trend_diagnostics"] = {
        "revenue_growth_slope": _linear_slope(rev_growth_series),
        "profit_growth_slope": _linear_slope(profit_growth_series),
        "earnings_volatility": _stddev(earnings_series),
        "growth_consistency_score": growth_consistency,
        "acceleration_signal": "acceleration" if len(rev_growth_series) >= 3 and rev_growth_series[-1] > rev_growth_series[0] else "deceleration" if len(rev_growth_series) >= 3 and rev_growth_series[-1] < rev_growth_series[0] else "stable_or_insufficient_data",
    }

    numeric_latest_metrics = len([v for v in latest_metrics.values() if isinstance(v, (int, float))])
    output["limitations"] = {
        "growth_metrics_limited": len([y for y in years if y.isdigit()]) < 2,
        "no_extractable_financial_metrics": numeric_latest_metrics == 0,
    }
    return output
