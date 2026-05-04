from __future__ import annotations

from typing import Any


# =========================
# 1. NORMALIZATION LAYER
# =========================

def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _parse_float(value: Any) -> float | None:
    if _is_number(value):
        return float(value)

    if value is None:
        return None

    text = str(value).strip()
    if not text or text in {"-", "—", "–", "N/A", "NA", "n/a"}:
        return None

    text = text.replace("*", "")
    negative = text.startswith("(") and text.endswith(")")
    text = text.strip("()")
    text = text.replace(",", "").replace(" ", "")

    if not text:
        return None

    try:
        number = float(text)
    except ValueError:
        return None

    return -abs(number) if negative else number


def _get_field(year_payload: dict[str, Any], section: str, field: str) -> float | None:
    section_payload = year_payload.get(section)
    if not isinstance(section_payload, dict):
        return None

    return _parse_float(section_payload.get(field))


# =========================
# 2. STRICT FINANCIAL MAPPER (NO FALLBACK CHAOS)
# =========================

def _normalize_year(payload: dict[str, Any]) -> dict[str, float | None]:
    return {
        # Income Statement
        "revenue": _get_field(payload, "income_statement", "revenue"),
        "cost_of_sales": _get_field(payload, "income_statement", "cost_of_sales"),
        "gross_profit": _get_field(payload, "income_statement", "gross_profit"),
        "operating_profit": _get_field(payload, "income_statement", "operating_profit"),  # EBIT
        "profit_before_tax": _get_field(payload, "income_statement", "profit_before_tax"),
        "net_profit": _get_field(payload, "income_statement", "net_profit"),
        "finance_cost": _get_field(payload, "income_statement", "interest_expense"),
        "tax_expense": _get_field(payload, "income_statement", "income_tax_expense"),
        "eps": _get_field(payload, "income_statement", "basic_earnings_per_share"),

        # Balance Sheet
        "total_assets": _get_field(payload, "balance_sheet", "total_assets"),
        "current_assets": _get_field(payload, "balance_sheet", "current_assets"),
        "inventory": _get_field(payload, "balance_sheet", "inventory"),
        "receivables": _get_field(payload, "balance_sheet", "trade_receivables"),
        "cash": _get_field(payload, "balance_sheet", "cash_and_cash_equivalents"),
        "equity": _get_field(payload, "balance_sheet", "total_equity"),
        "total_liabilities": _get_field(payload, "balance_sheet", "total_liabilities"),
        "current_liabilities": _get_field(payload, "balance_sheet", "current_liabilities"),
        "noncurrent_liabilities": _get_field(payload, "balance_sheet", "noncurrent_liabilities"),
        "borrowings": _get_field(payload, "balance_sheet", "borrowings"),
        "shares_outstanding": _get_field(payload, "balance_sheet", "shares_outstanding"),
        "market_price": _get_field(payload, "balance_sheet", "market_price"),

        # Cash Flow
        "operating_cash_flow": _get_field(payload, "cash_flow", "operating_cash_flow"),
        "investing_cash_flow": _get_field(payload, "cash_flow", "investing_cash_flow"),
        "financing_cash_flow": _get_field(payload, "cash_flow", "financing_cash_flow"),
        "net_cash_flow": _get_field(payload, "cash_flow", "net_cash_flow"),
        "opening_cash": _get_field(payload, "cash_flow", "opening_cash"),
        "closing_cash": _get_field(payload, "cash_flow", "closing_cash"),
        "capex": _get_field(payload, "cash_flow", "purchase_property_plant_and_equipment"),
        "dividends_paid": _get_field(payload, "cash_flow", "dividends_paid"),
    }


# =========================
# 3. SAFE DIVISION
# =========================

def _safe_div(a: float | None, b: float | None) -> float | None:
    if a is None or b is None:
        return None
    if abs(float(b)) < 1e-12:
        return None
    return float(a) / float(b)


# =========================
# 4. FINANCIAL RATIOS ENGINE
# =========================

def _compute_ratios(v: dict[str, float | None]) -> dict[str, float | None]:
    return {
        "Gross Margin": _safe_div(v["gross_profit"], v["revenue"]),
        "Operating Margin (EBIT)": _safe_div(v["operating_profit"], v["revenue"]),
        "Net Profit Margin": _safe_div(v["net_profit"], v["revenue"]),

        "ROA": _safe_div(v["net_profit"], v["total_assets"]),
        "ROE": _safe_div(v["net_profit"], v["equity"]),

        "Current Ratio": _safe_div(v["current_assets"], v["current_liabilities"]),
        "Quick Ratio": _safe_div(
            (v["current_assets"] - v["inventory"]) if v["current_assets"] is not None and v["inventory"] is not None else None,
            v["current_liabilities"]
        ),
        "Cash Ratio": _safe_div(v["cash"], v["current_liabilities"]),

        "Debt to Equity": _safe_div(v["total_liabilities"], v["equity"]),
        "Debt Ratio": _safe_div(v["total_liabilities"], v["total_assets"]),

        "Interest Coverage": _safe_div(v["operating_profit"], v["finance_cost"]),

        "Asset Turnover": _safe_div(v["revenue"], v["total_assets"]),
        "Inventory Turnover": _safe_div(v["cost_of_sales"], v["inventory"]),
        "Receivables Turnover": _safe_div(v["revenue"], v["receivables"]),

        "OCF Ratio": _safe_div(v["operating_cash_flow"], v["current_liabilities"]),
        "Cash Flow to Net Income": _safe_div(v["operating_cash_flow"], v["net_profit"]),

        "Free Cash Flow": (
            v["operating_cash_flow"] - abs(v["capex"])
            if v["operating_cash_flow"] is not None and v["capex"] is not None
            else None
        ),
    }


# =========================
# 5. CASH FLOW VALIDATION (CORRECT FORMULA)
# =========================

def _cash_check(v: dict[str, float | None]) -> bool | None:
    if v["opening_cash"] is None or v["net_cash_flow"] is None or v["closing_cash"] is None:
        return None

    expected = v["opening_cash"] + v["net_cash_flow"]
    return abs(expected - v["closing_cash"]) / max(abs(v["closing_cash"]), 1.0) < 0.05


# =========================
# 6. BALANCE SHEET CHECK
# =========================

def _bs_check(v: dict[str, float | None]) -> bool | None:
    if v["total_assets"] is None:
        return None

    rhs = (v["equity"] or 0) + (v["total_liabilities"] or 0)
    return abs(v["total_assets"] - rhs) / max(abs(v["total_assets"]), 1.0) < 0.05


# =========================
# 7. CORE ENGINE
# =========================

def build_analysis(dataset: dict[str, Any]) -> dict[str, Any]:
    years = dataset.get("years")
    if not isinstance(years, dict):
        return {"status": "FAILED"}

    ordered = sorted([y for y in years.keys() if str(y).isdigit()], key=int)

    results = {}
    prev = None

    pass_count = 0
    total = 0

    for y in ordered:
        payload = years[y]
        if not isinstance(payload, dict):
            continue

        v = _normalize_year(payload)
        ratios = _compute_ratios(v)

        bs_ok = _bs_check(v)
        cash_ok = _cash_check(v)

        gates = {
            "balance_sheet": bs_ok,
            "cash_flow": cash_ok,
        }

        for g in gates.values():
            if g is not None:
                total += 1
                if g:
                    pass_count += 1

        results[y] = {
            "ratios": ratios,
            "validation": gates,
        }

        prev = v

    reliability = (pass_count / total * 100) if total else 0

    return {
        "status": "OK",
        "years": results,
        "reliability_score": reliability,
    }