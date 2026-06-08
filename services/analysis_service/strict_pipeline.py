from __future__ import annotations

import logging
from typing import Any

from .financial_mapping_layer import analyze_normalized_results, normalized_analysis_to_legacy

logger = logging.getLogger(__name__)

# =============================================================================
# 1. HELPERS
# =============================================================================

def _is_number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)

def _pf(v: Any) -> float | None:
    if _is_number(v):
        return float(v)
    if v is None:
        return None
    t = str(v).strip()
    if not t or t in {"-", "—", "–", "N/A", "NA", "n/a"}:
        return None
    t = t.replace("*", "")
    neg = t.startswith("(") and t.endswith(")")
    t = t.strip("()")
    t = t.replace(",", "").replace(" ", "")
    if not t:
        return None
    try:
        n = float(t)
    except ValueError:
        return None
    return -abs(n) if neg else n

def _sd(a, b):
    if a is None or b is None:
        return None
    if abs(float(b)) < 1e-12:
        return None
    return float(a) / float(b)

def _first(*vals):
    for v in vals:
        if v is not None:
            return v
    return None

def _sum_non_none(*vals):
    parts = [v for v in vals if v is not None]
    return sum(parts) if parts else None

def _abs_val(v):
    return abs(v) if v is not None else None

# =============================================================================
# 2. FIELD GETTER — scans section dict with synonym fallback
# =============================================================================

def _gf(payload: dict, section: str, *keys) -> float | None:
    sec = payload.get(section)
    if not isinstance(sec, dict):
        return None
    for k in keys:
        v = _pf(sec.get(k))
        if v is not None:
            return v
    return None

def _scan_all(payload: dict, *keys) -> float | None:
    for section in ("income_statement", "balance_sheet", "cash_flow",
                     "equity", "comprehensive_income"):
        v = _gf(payload, section, *keys)
        if v is not None:
            return v
    return None

# =============================================================================
# 3. NORMALIZE YEAR — robust synonym + fallback + derived values
# =============================================================================

def _normalize_year(p: dict, prev: dict | None = None) -> dict[str, float | None]:
    v: dict[str, float | None] = {}
    src: dict[str, str] = {}  # tracks source type per field

    # --- INCOME STATEMENT ---
    # Revenue: for banks, total_operating_income is the best proxy.
    # revenue_or_interest_income can be mis-scaled, so check magnitude.
    candidates = [
        _gf(p, "income_statement", "revenue"),
        _gf(p, "income_statement", "total_operating_income"),
        _gf(p, "income_statement", "net_operating_income"),
        _gf(p, "income_statement", "revenue_or_interest_income"),
        _gf(p, "income_statement", "net_interest_income"),
        _gf(p, "income_statement", "net_interest_fee_and_commission_income"),
        _gf(p, "income_statement", "gross_income"),
    ]
    # Pick the first non-None candidate, but skip suspiciously tiny values
    # when a larger candidate exists (likely a scaling artifact)
    valid = [c for c in candidates if c is not None]
    if len(valid) > 1:
        max_val = max(abs(c) for c in valid)
        # If the first candidate is <0.01% of the largest, skip it
        raw_rev = None
        for c in valid:
            if abs(c) > max_val * 0.0001 or max_val < 1000:
                raw_rev = c
                break
        if raw_rev is None:
            raw_rev = valid[0]
    elif valid:
        raw_rev = valid[0]
    else:
        raw_rev = None
    v["revenue"] = raw_rev
    src["revenue"] = "exact" if _gf(p, "income_statement", "revenue") is not None else "synonym"

    v["cost_of_sales"] = _gf(p, "income_statement", "cost_of_sales", "cost_of_revenue")
    v["gross_profit"] = _gf(p, "income_statement", "gross_profit")
    v["operating_profit"] = _gf(p, "income_statement", "operating_profit",
                                 "net_operating_income", "operating_profit_before_tax",
                                 "operating_profit_after_tax")
    v["profit_before_tax"] = _gf(p, "income_statement", "profit_before_tax",
                                  "operating_profit_before_tax")
    v["net_profit"] = _gf(p, "income_statement", "net_profit", "profit_for_the_year",
                           "profit_after_tax", "profit_attributable_to_equity_holders")
    v["finance_cost"] = _gf(p, "income_statement", "interest_expense", "finance_cost",
                             "finance_costs")
    v["tax_expense"] = _gf(p, "income_statement", "income_tax_expense", "tax_expense")
    v["eps"] = _gf(p, "income_statement", "basic_earnings_per_share", "eps",
                    "diluted_earnings_per_share")
    v["total_operating_income"] = _gf(p, "income_statement", "total_operating_income")
    v["total_operating_expenses"] = _gf(p, "income_statement", "total_operating_expenses",
                                         "operating_expenses")
    v["impairment_charge"] = _gf(p, "income_statement", "impairment_charge")

    # --- BALANCE SHEET ---
    v["total_assets"] = _gf(p, "balance_sheet", "total_assets")
    v["current_assets"] = _gf(p, "balance_sheet", "current_assets")
    v["inventory"] = _gf(p, "balance_sheet", "inventory", "inventories")
    v["receivables"] = _gf(p, "balance_sheet", "trade_receivables", "receivables",
                            "loans_and_advances_to_customers", "loans_and_advances")
    v["cash"] = _gf(p, "balance_sheet", "cash_and_cash_equivalents", "cash",
                     "cash_and_equivalents")
    if v["cash"] is None:
        v["cash"] = _gf(p, "cash_flow", "closing_cash")
    v["equity"] = _gf(p, "balance_sheet", "total_equity", "equity",
                       "total_shareholders_equity", "shareholders_equity")
    v["total_liabilities"] = _gf(p, "balance_sheet", "total_liabilities")
    v["current_liabilities"] = _gf(p, "balance_sheet", "current_liabilities")
    v["noncurrent_liabilities"] = _gf(p, "balance_sheet", "noncurrent_liabilities",
                                       "non_current_liabilities")
    v["borrowings"] = _gf(p, "balance_sheet", "total_debt", "borrowings",
                           "other_borrowings", "subordinated_term_debts")
    v["deposits"] = _gf(p, "balance_sheet", "due_to_depositors", "customer_deposits",
                         "deposits")
    v["loans"] = _gf(p, "balance_sheet", "loans_and_advances_to_customers",
                      "loans_and_advances")
    v["shares_outstanding"] = _gf(p, "balance_sheet", "shares_outstanding",
                                   "ordinary_shares")
    v["market_price"] = _gf(p, "balance_sheet", "market_price", "market_value")

    # --- CASH FLOW ---
    v["operating_cash_flow"] = _gf(p, "cash_flow", "operating_cash_flow",
                                    "net_operating_cashflow",
                                    "net_operating_cash_before_tax")
    v["investing_cash_flow"] = _gf(p, "cash_flow", "investing_cash_flow",
                                    "net_investment_cash_flow")
    v["financing_cash_flow"] = _gf(p, "cash_flow", "financing_cash_flow")
    v["net_cash_flow"] = _gf(p, "cash_flow", "net_cash_flow", "net_cash_change")
    v["opening_cash"] = _gf(p, "cash_flow", "opening_cash",
                             "cash_at_beginning", "cash_and_cash_equivalents_at_beginning")
    v["closing_cash"] = _gf(p, "cash_flow", "closing_cash",
                             "cash_at_end", "cash_and_cash_equivalents_at_end")
    v["capex"] = _gf(p, "cash_flow", "purchase_property_plant_and_equipment",
                      "capex", "capital_expenditure")
    v["dividends_paid"] = _gf(p, "cash_flow", "dividends_paid", "dividend_paid")

    # Cash flow detail items (for derived calculations)
    v["interest_receipts"] = _gf(p, "cash_flow", "interest_receipts")
    v["interest_payments"] = _gf(p, "cash_flow", "interest_payments")
    v["net_commission_receipts"] = _gf(p, "cash_flow", "net_commission_receipts")
    v["net_trading_income"] = _gf(p, "cash_flow", "net_trading_income")
    v["payments_to_employees"] = _gf(p, "cash_flow", "payments_to_employees")
    v["taxes_on_financial_services"] = _first(
        _gf(p, "cash_flow", "taxes_on_financial_services"),
        _gf(p, "income_statement", "taxes_on_financial_services"))
    v["receipts_from_other_operating"] = _gf(p, "cash_flow",
                                              "receipts_from_other_operating_activities")
    v["payments_for_other_operating"] = _gf(p, "cash_flow",
                                             "payments_for_other_operating_activities")

    # =========================================================================
    # DERIVED VALUES — Step 4
    # =========================================================================

    # Net Interest Income (derived)
    if v["revenue"] is None and v["interest_receipts"] is not None:
        nii = _sum_non_none(v["interest_receipts"],
                            v["interest_payments"])  # payments already negative
        if nii is not None:
            v["revenue"] = abs(nii)
            src["revenue"] = "derived"

    # Finance cost from cash flow interest payments
    if v["finance_cost"] is None and v["interest_payments"] is not None:
        v["finance_cost"] = _abs_val(v["interest_payments"])

    # Operating profit derived from total_operating_income - total_operating_expenses
    if v["operating_profit"] is None:
        ti = v.get("total_operating_income")
        te = v.get("total_operating_expenses")
        if ti is not None and te is not None:
            v["operating_profit"] = ti - abs(te)

    # Gross profit = revenue - cost_of_sales (if not directly available)
    if v["gross_profit"] is None and v["revenue"] is not None and v["cost_of_sales"] is not None:
        v["gross_profit"] = v["revenue"] - abs(v["cost_of_sales"])

    # Net cash flow derived from operating + investing + financing
    if v["net_cash_flow"] is None:
        v["net_cash_flow"] = _sum_non_none(v["operating_cash_flow"],
                                            v["investing_cash_flow"],
                                            v["financing_cash_flow"])

    # Total liabilities derived from total_assets - equity
    if v["total_liabilities"] is None and v["total_assets"] is not None and v["equity"] is not None:
        v["total_liabilities"] = v["total_assets"] - v["equity"]

    # Equity derived from total_assets - total_liabilities
    if v["equity"] is None and v["total_assets"] is not None and v["total_liabilities"] is not None:
        v["equity"] = v["total_assets"] - v["total_liabilities"]

    # =========================================================================
    # AVERAGE VALUES (for ROA/ROE) — Step 4 continued
    # =========================================================================
    if prev is not None:
        prev_assets = prev.get("total_assets")
        prev_equity = prev.get("equity")
        v["avg_assets"] = ((v["total_assets"] + prev_assets) / 2.0
                           if v["total_assets"] is not None and prev_assets is not None
                           else v["total_assets"])
        v["avg_equity"] = ((v["equity"] + prev_equity) / 2.0
                           if v["equity"] is not None and prev_equity is not None
                           else v["equity"])
    else:
        v["avg_assets"] = v["total_assets"]
        v["avg_equity"] = v["equity"]

    v["_src"] = src
    return v

# =============================================================================
# 4. RATIO COMPUTATION — returns value + equation + confidence
# =============================================================================

def _ratio(name, num, den, num_label, den_label, confidence=1.0):
    val = _sd(num, den)
    eq = f"{num_label} ({num}) / {den_label} ({den})"
    return {
        "value": round(val, 6) if val is not None else None,
        "equation": eq,
        "inputs_used": [num_label, den_label],
        "confidence": confidence if val is not None else 0.0,
    }

def _ratio_diff(name, a, b, a_label, b_label, confidence=1.0):
    val = (a - abs(b)) if a is not None and b is not None else None
    eq = f"{a_label} ({a}) - {b_label} ({b})"
    return {
        "value": round(val, 3) if val is not None else None,
        "equation": eq,
        "inputs_used": [a_label, b_label],
        "confidence": confidence if val is not None else 0.0,
    }

def _compute_ratios(v, src):
    conf = lambda field: 1.0 if src.get(field, "exact") == "exact" else (
        0.9 if src.get(field) == "synonym" else (0.8 if src.get(field) == "derived" else 0.7))

    rev_conf = conf("revenue")

    r = {}
    # Profitability
    r["Gross Margin"] = _ratio("Gross Margin", v["gross_profit"], v["revenue"],
                                "Gross Profit", "Revenue", rev_conf)
    r["Operating Margin"] = _ratio("Operating Margin", v["operating_profit"], v["revenue"],
                                    "Operating Profit", "Revenue", rev_conf)
    r["Net Profit Margin"] = _ratio("Net Profit Margin", v["net_profit"], v["revenue"],
                                     "Net Profit", "Revenue", rev_conf)
    r["ROA"] = _ratio("ROA", v["net_profit"], v.get("avg_assets", v["total_assets"]),
                       "Net Profit", "Avg Assets", 0.9 if v.get("avg_assets") != v["total_assets"] else 1.0)
    r["ROE"] = _ratio("ROE", v["net_profit"], v.get("avg_equity", v["equity"]),
                       "Net Profit", "Avg Equity", 0.9 if v.get("avg_equity") != v["equity"] else 1.0)
    r["EBIT Margin"] = _ratio("EBIT Margin", v["operating_profit"], v["revenue"],
                               "Operating Profit", "Revenue", rev_conf)

    # Liquidity
    r["Current Ratio"] = _ratio("Current Ratio", v["current_assets"], v["current_liabilities"],
                                 "Current Assets", "Current Liabilities")
    qa = (v["current_assets"] - v["inventory"]) if v["current_assets"] is not None and v["inventory"] is not None else None
    r["Quick Ratio"] = _ratio("Quick Ratio", qa, v["current_liabilities"],
                               "(Current Assets - Inventory)", "Current Liabilities")
    r["Cash Ratio"] = _ratio("Cash Ratio", v["cash"], v["current_liabilities"],
                              "Cash", "Current Liabilities")

    # Leverage
    r["Debt to Equity"] = _ratio("Debt to Equity", v["total_liabilities"], v["equity"],
                                  "Total Liabilities", "Equity")
    r["Debt Ratio"] = _ratio("Debt Ratio", v["total_liabilities"], v["total_assets"],
                              "Total Liabilities", "Total Assets")
    r["Interest Coverage"] = _ratio("Interest Coverage", v["operating_profit"], v["finance_cost"],
                                     "Operating Profit", "Finance Cost")

    # Efficiency
    r["Asset Turnover"] = _ratio("Asset Turnover", v["revenue"], v["total_assets"],
                                  "Revenue", "Total Assets", rev_conf)
    r["Inventory Turnover"] = _ratio("Inventory Turnover", v["cost_of_sales"], v["inventory"],
                                      "Cost of Sales", "Inventory")
    r["Receivables Turnover"] = _ratio("Receivables Turnover", v["revenue"], v["receivables"],
                                        "Revenue", "Receivables", rev_conf)

    # Cash Flow
    r["OCF Ratio"] = _ratio("OCF Ratio", v["operating_cash_flow"], v["current_liabilities"],
                             "Operating Cash Flow", "Current Liabilities")
    r["Cash Flow to Net Income"] = _ratio("Cash Flow to Net Income",
                                           v["operating_cash_flow"], v["net_profit"],
                                           "Operating Cash Flow", "Net Profit")
    r["Free Cash Flow"] = _ratio_diff("Free Cash Flow",
                                       v["operating_cash_flow"], v["capex"],
                                       "Operating Cash Flow", "CapEx")
    return r

# =============================================================================
# 5. GROWTH
# =============================================================================

def _growth(cur, prev):
    if prev is None:
        return {}
    def _gr(field):
        c = cur.get(field)
        p = prev.get(field)
        if c is None or p is None or abs(p) < 1e-12:
            return None
        return round((c - p) / abs(p), 6)
    return {
        "Revenue Growth": _gr("revenue"),
        "Net Profit Growth": _gr("net_profit"),
        "Asset Growth": _gr("total_assets"),
        "Equity Growth": _gr("equity"),
    }

# =============================================================================
# 6. VALIDATION GATES
# =============================================================================

def _run_gates(v, prev):
    gates = {}
    # Balance Sheet Identity
    ta = v["total_assets"]
    tl = v["total_liabilities"]
    eq = v["equity"]
    if ta is not None and (tl is not None or eq is not None):
        rhs = (tl or 0) + (eq or 0)
        diff = abs(ta - rhs) / max(abs(ta), 1.0)
        gates["Balance Sheet Identity"] = {
            "status": "pass" if diff < 0.05 else "fail",
            "confidence_weight": 0.3,
            "detail": f"Assets={ta}, L+E={rhs}, diff={diff:.4f}",
        }
    else:
        gates["Balance Sheet Identity"] = {"status": "unknown", "confidence_weight": 0.0}

    # Cash Reconciliation
    ocf = v["operating_cash_flow"]
    icf = v["investing_cash_flow"]
    fcf = v["financing_cash_flow"]
    if ocf is not None and icf is not None and fcf is not None:
        total_cf = ocf + icf + fcf
        nc = v["net_cash_flow"]
        if nc is not None and abs(nc) > 1e-6:
            diff = abs(total_cf - nc) / max(abs(nc), 1.0)
            gates["Cash Reconciliation"] = {
                "status": "pass" if diff < 0.10 else "fail",
                "confidence_weight": 0.2,
            }
        else:
            gates["Cash Reconciliation"] = {"status": "unknown", "confidence_weight": 0.0}
    else:
        gates["Cash Reconciliation"] = {"status": "unknown", "confidence_weight": 0.0}

    # Multi-Year Continuity
    if prev is not None:
        jump_detected = False
        for field in ("revenue", "total_assets", "net_profit"):
            c = v.get(field)
            p = prev.get(field)
            if c is not None and p is not None and abs(p) > 1e-6:
                change = abs((c - p) / p)
                if change > 3.0:
                    jump_detected = True
                    break
        gates["Multi-Year Continuity"] = {
            "status": "fail" if jump_detected else "pass",
            "confidence_weight": 0.2,
        }
    else:
        gates["Multi-Year Continuity"] = {"status": "unknown", "confidence_weight": 0.0}

    return gates

# =============================================================================
# 7. SECTOR ADJUSTMENTS
# =============================================================================

def _sector_adjustments(company_name, v):
    name_lower = (company_name or "").lower()
    if any(kw in name_lower for kw in ("bank", "hnb", "finance", "insurance")):
        sector = "Banking/Finance"
        risk_adj = 0.0
        if v.get("equity") and v.get("total_liabilities"):
            de = v["total_liabilities"] / max(v["equity"], 1e-6)
            if de > 15:
                risk_adj = 10.0
        return {"sector": sector, "risk_adjustment": risk_adj, "weight_adjustment": 1.0}
    return {"sector": "General", "risk_adjustment": 0.0, "weight_adjustment": 1.0}

# =============================================================================
# 8. SCORING
# =============================================================================

def _compute_scores(yearly_ratios, gates_all, sector_all):
    ratio_health = 0.0
    ratio_count = 0
    for yr, ratios in yearly_ratios.items():
        for name, r in ratios.items():
            if r["value"] is not None:
                ratio_count += 1
                ratio_health += r["confidence"]

    pass_count = 0
    total_gates = 0
    for yr, gates in gates_all.items():
        for g_name, g in gates.items():
            if g["status"] != "unknown":
                total_gates += 1
                if g["status"] == "pass":
                    pass_count += 1

    gate_score = (pass_count / total_gates * 100) if total_gates > 0 else 50.0
    ratio_avg_conf = (ratio_health / ratio_count) if ratio_count > 0 else 0.5
    coverage = min(ratio_count / max(len(yearly_ratios) * 18, 1) * 100, 100)

    reliability = min(100, gate_score * 0.4 + coverage * 0.4 + ratio_avg_conf * 20)
    risk = max(0, 100 - reliability)

    sector_penalty = sum(s.get("risk_adjustment", 0) for s in sector_all.values())
    risk = min(100, risk + sector_penalty)

    confidence = round(ratio_avg_conf, 2)
    risk_level = "low" if risk < 33 else ("medium" if risk < 66 else "high")
    rel_band = "high" if reliability > 66 else ("medium" if reliability > 33 else "low")

    return {
        "reliability_score": round(reliability, 2),
        "risk_score": round(risk, 2),
        "confidence_score": confidence,
        "risk_level": risk_level,
        "reliability_band": rel_band,
    }

# =============================================================================
# 9. PUBLIC API — build_strict_analysis_result
# =============================================================================

def build_strict_analysis_result(extraction_dataset: dict[str, Any]) -> dict[str, Any]:
    if isinstance(extraction_dataset.get("normalized_results"), (list, dict)):
        normalized_analysis = analyze_normalized_results(extraction_dataset["normalized_results"])
        return normalized_analysis_to_legacy(normalized_analysis)

    if extraction_dataset.get("source") == "normalized_results.json":
        normalized_payload = {
            "company": extraction_dataset.get("company_name") or extraction_dataset.get("company") or "Unknown",
            "financials": extraction_dataset.get("financials") or extraction_dataset.get("years") or {},
        }
        normalized_analysis = analyze_normalized_results(normalized_payload)
        return normalized_analysis_to_legacy(normalized_analysis)

    years = extraction_dataset.get("years") or extraction_dataset.get("financial_graph")
    if not isinstance(years, dict) or not years:
        return {"status": "VALIDATION_FAILED", "reasons": ["No year data available"]}

    company_name = extraction_dataset.get("company_name", "Unknown")
    ordered = sorted((y for y in years if str(y).isdigit()), key=int)


    print("\n========== YEAR DEBUG ==========")
    print("All year keys:", list(years.keys()))
    print("Ordered years:", ordered)

    for year in ordered:
        payload = years[year]

        print("\nYEAR:", year)
        print("TOP LEVEL KEYS:", payload.keys())

    print("========== END DEBUG ==========\n")

    yearly_ratios = {}
    growth_metrics = {}
    validation_gates = {}
    sector_adjustments = {}
    evaluated_equations = {}

    prev_vars = None

    for year in ordered:
        payload = years.get(year)
        if not isinstance(payload, dict):
            continue

        v = _normalize_year(payload, prev_vars)
        src = v.pop("_src", {})

        print(f"\n===== NORMALIZED {year} =====")

        for k in [
            "revenue",
            "net_profit",
            "total_assets",
            "equity",
            "total_liabilities",
            "operating_cash_flow"
        ]:
            print(k, "=", v.get(k))

        print("========================")

        ratios = _compute_ratios(v, src)
        growth = _growth(v, prev_vars)
        gates = _run_gates(v, prev_vars)
        sector = _sector_adjustments(company_name, v)

        yearly_ratios[year] = ratios
        growth_metrics[year] = growth
        validation_gates[year] = gates
        sector_adjustments[year] = sector
        evaluated_equations[year] = {name: r["equation"] for name, r in ratios.items()}

        prev_vars = v

    scores = _compute_scores(yearly_ratios, validation_gates, sector_adjustments)

    return {
        "status": "COMPLETED",
        "valid_years": ordered,
        "yearly_ratios": yearly_ratios,
        "growth_metrics": growth_metrics,
        "validation_gates": validation_gates,
        "sector_adjustments": sector_adjustments,
        "evaluated_equations_by_year": evaluated_equations,
        "scores": scores,
    }


def build_validation_failed_diagnostic(extraction_dataset: dict[str, Any],
                                        reasons: list[str]) -> dict[str, Any]:
    return {"status": "VALIDATION_FAILED", "reasons": reasons}
