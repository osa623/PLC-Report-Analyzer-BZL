"""
Comprehensive Manual Analysis Test for AMANA Banking
Reads normalized_results.json and produces investment-grade analysis.
"""
import json, sys, os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from services.analysis_service.test_data_loader import (
    load_normalized_data, extract_banking_metrics, build_strict_pipeline_input
)
from services.analysis_service.strict_pipeline import build_strict_analysis_result


def sd(a, b):
    if a is None or b is None or abs(b) < 1e-12:
        return None
    return a / b


def yoy(cur, prev):
    if cur is None or prev is None or abs(prev) < 1e-12:
        return None
    return (cur - prev) / abs(prev)


def fmt(v, pct=False, dec=2):
    if v is None:
        return "N/A"
    if pct:
        return f"{v*100:.{dec}f}%"
    if abs(v) >= 1e9:
        return f"{v/1e9:.{dec}f}B"
    if abs(v) >= 1e6:
        return f"{v/1e6:.{dec}f}M"
    if abs(v) >= 1e3:
        return f"{v/1e3:.{dec}f}K"
    return f"{v:.{dec}f}"


def compute_full_analysis(metrics, years):
    """Compute all ratios for all years."""
    results = {}
    for i, yr in enumerate(years):
        m = metrics[yr]
        prev = metrics[years[i-1]] if i > 0 else {}
        r = {}

        # ===== RETURN RATIOS =====
        avg_equity = ((m.get("total_equity") or 0) + (prev.get("total_equity") or 0)) / 2 if prev.get("total_equity") else m.get("total_equity")
        avg_assets = ((m.get("total_assets") or 0) + (prev.get("total_assets") or 0)) / 2 if prev.get("total_assets") else m.get("total_assets")

        r["ROE"] = sd(m.get("net_profit"), avg_equity)
        r["ROA"] = sd(m.get("net_profit"), avg_assets)

        # ROCE = EBIT / Capital Employed (Assets - Current Liabilities)
        capital_employed = m.get("total_assets")  # For banks, use total assets
        r["ROCE"] = sd(m.get("operating_profit") or m.get("profit_before_tax"), capital_employed)

        # ROIC = NOPAT / Invested Capital
        nopat = None
        if m.get("operating_profit") and m.get("tax_expense") and m.get("profit_before_tax"):
            eff_tax = abs(m["tax_expense"]) / abs(m["profit_before_tax"]) if m["profit_before_tax"] else 0
            nopat = m["operating_profit"] * (1 - eff_tax)
        invested_capital = None
        if m.get("total_equity") and m.get("total_liabilities"):
            invested_capital = m["total_equity"] + (m.get("deposits") or 0) * 0  # simplified for bank
        r["ROIC"] = sd(nopat, m.get("total_equity"))

        # ===== PER-SHARE RATIOS =====
        r["EPS"] = m.get("eps")
        r["Book_Value_Per_Share"] = m.get("nav_per_share")

        # ===== PROFITABILITY =====
        r["Net_Profit_Margin"] = sd(m.get("net_profit"), m.get("total_operating_income"))
        r["Operating_Margin"] = sd(m.get("operating_profit"), m.get("total_operating_income"))
        r["Net_Interest_Margin"] = sd(m.get("net_financing_income"), avg_assets)
        r["Effective_Tax_Rate"] = sd(abs(m["tax_expense"]) if m.get("tax_expense") else None,
                                     m.get("profit_before_tax"))
        r["Cost_to_Income_Ratio"] = sd(m.get("total_operating_expenses"), m.get("total_operating_income"))
        r["Operating_Expense_Ratio"] = sd(m.get("total_operating_expenses"), m.get("total_operating_income"))

        # EBITDA proxy for banks
        ebitda = None
        if m.get("operating_profit") and m.get("depreciation") and m.get("amortisation"):
            ebitda = m["operating_profit"] + abs(m["depreciation"]) + abs(m["amortisation"])
        r["EBITDA"] = ebitda
        r["EBITDA_Margin"] = sd(ebitda, m.get("total_operating_income"))

        # ===== GROWTH RATES =====
        r["Revenue_Growth"] = yoy(m.get("total_operating_income"), prev.get("total_operating_income"))
        r["Net_Profit_Growth"] = yoy(m.get("net_profit"), prev.get("net_profit"))
        r["Asset_Growth"] = yoy(m.get("total_assets"), prev.get("total_assets"))
        r["Equity_Growth"] = yoy(m.get("total_equity"), prev.get("total_equity"))
        r["Loan_Growth"] = yoy(m.get("loans"), prev.get("loans"))
        r["Deposit_Growth"] = yoy(m.get("deposits"), prev.get("deposits"))
        r["EPS_Growth"] = yoy(m.get("eps"), prev.get("eps"))

        # EBIT growth vs revenue growth
        r["EBIT_Growth"] = yoy(m.get("operating_profit"), prev.get("operating_profit"))
        r["EBIT_vs_Revenue_Growth"] = sd(r.get("EBIT_Growth"), r.get("Revenue_Growth"))

        # Expense elasticity
        r["Expense_Elasticity"] = sd(
            yoy(m.get("total_operating_expenses"), prev.get("total_operating_expenses")),
            r.get("Revenue_Growth")
        )

        # ===== LEVERAGE =====
        r["Debt_to_Equity"] = sd(m.get("total_liabilities"), m.get("total_equity"))
        r["Debt_Ratio"] = sd(m.get("total_liabilities"), m.get("total_assets"))
        r["Equity_Ratio"] = sd(m.get("total_equity"), m.get("total_assets"))
        r["Equity_Multiplier"] = sd(m.get("total_assets"), m.get("total_equity"))

        # ===== BANKING SPECIFIC =====
        r["Loan_to_Deposit_Ratio"] = sd(m.get("loans"), m.get("deposits"))
        r["Loan_to_Asset_Ratio"] = sd(m.get("loans"), m.get("total_assets"))
        r["Deposit_to_Asset_Ratio"] = sd(m.get("deposits"), m.get("total_assets"))
        r["Impairment_to_Loans"] = sd(abs(m["impairment"]) if m.get("impairment") else None, m.get("loans"))
        r["Net_Interest_Spread"] = None
        if m.get("financing_income") and m.get("loans") and m.get("financing_expenses") and m.get("deposits"):
            yield_on_loans = sd(m["financing_income"], m["loans"])
            cost_of_deposits = sd(abs(m["financing_expenses"]), m["deposits"])
            if yield_on_loans and cost_of_deposits:
                r["Net_Interest_Spread"] = yield_on_loans - cost_of_deposits

        # Personnel metrics
        r["Personnel_to_OpEx"] = sd(m.get("personnel_expenses"), m.get("total_operating_expenses"))
        r["Revenue_per_Employee"] = sd(m.get("total_operating_income"), m.get("num_employees"))
        r["Profit_per_Employee"] = sd(m.get("net_profit"), m.get("num_employees"))
        r["Assets_per_Branch"] = sd(m.get("total_assets"), m.get("num_branches"))

        # ===== CASH FLOW =====
        r["OCF"] = m.get("ocf")
        r["OCF_to_Net_Profit"] = sd(m.get("ocf"), m.get("net_profit"))
        r["OCF_to_Assets"] = sd(m.get("ocf"), m.get("total_assets"))
        fcf = (m["ocf"] - abs(m["capex"])) if m.get("ocf") and m.get("capex") else None
        r["Free_Cash_Flow"] = fcf
        r["CapEx"] = m.get("capex")

        # Coverage ratios
        r["Dividend_Payout_Ratio"] = sd(abs(m["dividends_paid"]) if m.get("dividends_paid") else None,
                                        m.get("net_profit"))
        r["Cash_Interest_Coverage"] = sd(m.get("ocf"),
                                         abs(m["financing_expenses"]) if m.get("financing_expenses") else None)

        # ===== EFFICIENCY =====
        r["Asset_Turnover"] = sd(m.get("total_operating_income"), avg_assets)
        r["Fixed_Asset_Intensity"] = sd(m.get("ppe"), m.get("total_assets"))
        r["Depreciation_Ratio"] = sd(
            (abs(m["depreciation"] or 0) + abs(m["amortisation"] or 0)) if m.get("depreciation") else None,
            m.get("total_operating_income")
        )

        # ===== EARNINGS QUALITY =====
        r["Earnings_Quality"] = sd(m.get("ocf"), m.get("net_profit"))  # >1 = high quality
        r["Impairment_Coverage"] = sd(abs(m["impairment"]) if m.get("impairment") else None,
                                      m.get("total_operating_income"))

        # Core earnings (operating profit excluding impairments)
        if m.get("net_operating_income"):
            r["Core_Earnings"] = m["net_operating_income"]
        elif m.get("operating_profit") and m.get("impairment"):
            r["Core_Earnings"] = m["operating_profit"] + abs(m["impairment"])
        else:
            r["Core_Earnings"] = None

        results[yr] = r
    return results


def compute_scores(results, years):
    """Compute financial health scores (0-100)."""
    latest_yr = years[-1]
    r = results.get(latest_yr, {})

    # Find last year with meaningful data
    for yr in reversed(years):
        if results[yr].get("ROE") is not None:
            r = results[yr]
            latest_yr = yr
            break

    def score_range(val, bad, good):
        if val is None: return 50
        if good > bad:
            return max(0, min(100, (val - bad) / (good - bad) * 100))
        return max(0, min(100, (bad - val) / (bad - good) * 100))

    profitability = (
        score_range(r.get("ROE"), 0, 0.15) * 0.3 +
        score_range(r.get("ROA"), 0, 0.02) * 0.3 +
        score_range(r.get("Net_Profit_Margin"), 0, 0.25) * 0.2 +
        score_range(r.get("Cost_to_Income_Ratio"), 0.85, 0.45) * 0.2
    )

    leverage = score_range(r.get("Equity_Ratio"), 0.03, 0.12)

    growth_scores = []
    for g in ["Revenue_Growth", "Net_Profit_Growth", "Loan_Growth"]:
        v = r.get(g)
        if v is not None:
            growth_scores.append(score_range(v, -0.1, 0.2))
    growth = sum(growth_scores) / len(growth_scores) if growth_scores else 50

    efficiency = score_range(r.get("Cost_to_Income_Ratio"), 0.9, 0.4)

    banking = (
        score_range(r.get("Net_Interest_Margin"), 0, 0.05) * 0.3 +
        score_range(r.get("Loan_to_Deposit_Ratio"), 1.2, 0.7) * 0.3 +
        score_range(r.get("Impairment_to_Loans"), 0.05, 0.005) * 0.4
    )

    overall = (profitability * 0.30 + leverage * 0.15 + growth * 0.20 +
               efficiency * 0.15 + banking * 0.20)

    return {
        "profitability_score": round(profitability, 1),
        "leverage_score": round(leverage, 1),
        "growth_score": round(growth, 1),
        "efficiency_score": round(efficiency, 1),
        "banking_score": round(banking, 1),
        "overall_score": round(overall, 1),
        "latest_year_used": latest_yr,
    }


def detect_risks(results, years):
    """Detect financial risks and generate warnings."""
    risks = []
    latest = None
    for yr in reversed(years):
        if results[yr].get("ROE") is not None:
            latest = results[yr]
            break
    if not latest:
        return ["Insufficient data for risk analysis"]

    if latest.get("Cost_to_Income_Ratio") and latest["Cost_to_Income_Ratio"] > 0.75:
        risks.append("HIGH: Cost-to-income ratio elevated — operational efficiency concern")
    if latest.get("Impairment_to_Loans") and latest["Impairment_to_Loans"] > 0.02:
        risks.append("MEDIUM: Elevated impairment charges suggest credit quality deterioration")
    if latest.get("Loan_to_Deposit_Ratio") and latest["Loan_to_Deposit_Ratio"] > 1.0:
        risks.append("MEDIUM: Loan-to-deposit ratio >100% — liquidity pressure")
    if latest.get("Debt_to_Equity") and latest["Debt_to_Equity"] > 12:
        risks.append("INFO: High leverage typical for banking sector")
    if latest.get("Net_Profit_Growth") and latest["Net_Profit_Growth"] < -0.1:
        risks.append("WARNING: Net profit declining year-over-year")
    if latest.get("Earnings_Quality") and latest["Earnings_Quality"] < 0.5:
        risks.append("WARNING: Low earnings quality — cash flow not supporting accounting profits")

    # Trend-based risks
    margin_trend = []
    for yr in years:
        v = results[yr].get("Net_Profit_Margin")
        if v is not None:
            margin_trend.append(v)
    if len(margin_trend) >= 3:
        if all(margin_trend[i] < margin_trend[i-1] for i in range(max(1, len(margin_trend)-3), len(margin_trend))):
            risks.append("WARNING: Persistent margin deterioration over recent years")

    if not risks:
        risks.append("No major risk flags detected")
    return risks


def generate_report(metrics, results, years, scores, risks, strict_result):
    """Generate the full analysis report."""
    lines = []
    w = lines.append

    w("=" * 90)
    w("  AMANA BANKING PLC — COMPREHENSIVE FINANCIAL ANALYSIS REPORT")
    w(f"  Analysis Period: {years[0]} – {years[-1]} ({len(years)} years)")
    w("=" * 90)

    # ===== EXECUTIVE SUMMARY =====
    w("\n" + "─" * 90)
    w("  1. EXECUTIVE SUMMARY")
    w("─" * 90)
    outlook = "BULLISH" if scores["overall_score"] >= 65 else "NEUTRAL" if scores["overall_score"] >= 45 else "BEARISH"
    w(f"  Overall Financial Health Score: {scores['overall_score']}/100")
    w(f"  Investment Outlook: {outlook}")
    w(f"  Sector: Banking (Sri Lanka)")
    w(f"  Based on year: {scores['latest_year_used']}")
    w(f"\n  Component Scores:")
    w(f"    Profitability:  {scores['profitability_score']}/100")
    w(f"    Leverage:       {scores['leverage_score']}/100")
    w(f"    Growth:         {scores['growth_score']}/100")
    w(f"    Efficiency:     {scores['efficiency_score']}/100")
    w(f"    Banking Health: {scores['banking_score']}/100")

    # ===== RATIO DASHBOARD =====
    w("\n" + "─" * 90)
    w("  2. FINANCIAL RATIO DASHBOARD")
    w("─" * 90)

    # Determine which years have meaningful data
    data_years = [yr for yr in years if results[yr].get("ROE") is not None]

    def print_ratio_row(label, key, is_pct=True, formula=""):
        vals = []
        for yr in data_years:
            v = results[yr].get(key)
            vals.append(fmt(v, pct=is_pct))
        trend = ""
        numeric_vals = [results[yr].get(key) for yr in data_years if results[yr].get(key) is not None]
        if len(numeric_vals) >= 2:
            trend = "UP" if numeric_vals[-1] > numeric_vals[-2] else "DN" if numeric_vals[-1] < numeric_vals[-2] else "--"
        header = f"  {label:<32}"
        for v_str in vals:
            header += f" {v_str:>12}"
        header += f"  {trend}"
        if formula:
            header += f"  [{formula}]"
        w(header)

    # Header row
    header = f"  {'Metric':<32}"
    for yr in data_years:
        header += f" {yr:>12}"
    header += f"  {'Trend':>5}"
    w(header)
    w("  " + "─" * (35 + 13 * len(data_years)))

    w("\n  ── RETURN RATIOS ──")
    print_ratio_row("Return on Equity (ROE)", "ROE", True, "NP / Avg Equity")
    print_ratio_row("Return on Assets (ROA)", "ROA", True, "NP / Avg Assets")
    print_ratio_row("Return on Cap Employed", "ROCE", True, "EBIT / Total Assets")
    print_ratio_row("Return on Invested Cap", "ROIC", True, "NOPAT / Equity")

    w("\n  ── PER-SHARE RATIOS ──")
    print_ratio_row("Earnings Per Share (EPS)", "EPS", False)
    print_ratio_row("Book Value Per Share", "Book_Value_Per_Share", False)

    w("\n  ── PROFITABILITY ──")
    print_ratio_row("Net Profit Margin", "Net_Profit_Margin", True, "NP / Op Income")
    print_ratio_row("Operating Margin", "Operating_Margin", True, "Op Profit / Op Income")
    print_ratio_row("Net Interest Margin", "Net_Interest_Margin", True, "NII / Avg Assets")
    print_ratio_row("Cost-to-Income Ratio", "Cost_to_Income_Ratio", True, "OpEx / Op Income")
    print_ratio_row("Effective Tax Rate", "Effective_Tax_Rate", True, "Tax / PBT")
    print_ratio_row("EBITDA Margin", "EBITDA_Margin", True, "EBITDA / Op Income")

    w("\n  ── GROWTH RATES ──")
    print_ratio_row("Revenue Growth (YoY)", "Revenue_Growth", True)
    print_ratio_row("Net Profit Growth (YoY)", "Net_Profit_Growth", True)
    print_ratio_row("Asset Growth (YoY)", "Asset_Growth", True)
    print_ratio_row("Loan Growth (YoY)", "Loan_Growth", True)
    print_ratio_row("Deposit Growth (YoY)", "Deposit_Growth", True)
    print_ratio_row("EPS Growth (YoY)", "EPS_Growth", True)
    print_ratio_row("EBIT vs Revenue Growth", "EBIT_vs_Revenue_Growth", False)
    print_ratio_row("Expense Elasticity", "Expense_Elasticity", False)

    w("\n  ── LEVERAGE & SOLVENCY ──")
    print_ratio_row("Debt-to-Equity Ratio", "Debt_to_Equity", False, "Liabilities / Equity")
    print_ratio_row("Debt Ratio", "Debt_Ratio", True, "Liabilities / Assets")
    print_ratio_row("Equity Ratio", "Equity_Ratio", True, "Equity / Assets")
    print_ratio_row("Equity Multiplier", "Equity_Multiplier", False, "Assets / Equity")

    w("\n  ── BANKING SPECIFIC ──")
    print_ratio_row("Loan-to-Deposit Ratio", "Loan_to_Deposit_Ratio", True, "Loans / Deposits")
    print_ratio_row("Loan-to-Asset Ratio", "Loan_to_Asset_Ratio", True, "Loans / Assets")
    print_ratio_row("Deposit-to-Asset Ratio", "Deposit_to_Asset_Ratio", True, "Deposits / Assets")
    print_ratio_row("Impairment-to-Loans", "Impairment_to_Loans", True, "Impairment / Loans")
    print_ratio_row("Net Interest Spread", "Net_Interest_Spread", True)
    print_ratio_row("Personnel/OpEx Ratio", "Personnel_to_OpEx", True)
    print_ratio_row("Revenue per Employee", "Revenue_per_Employee", False)
    print_ratio_row("Profit per Employee", "Profit_per_Employee", False)

    w("\n  ── EFFICIENCY ──")
    print_ratio_row("Asset Turnover", "Asset_Turnover", False, "Revenue / Avg Assets")
    print_ratio_row("Fixed Asset Intensity", "Fixed_Asset_Intensity", True, "PPE / Assets")
    print_ratio_row("Depreciation Ratio", "Depreciation_Ratio", True, "D&A / Revenue")

    w("\n  ── CASH FLOW ──")
    print_ratio_row("Operating Cash Flow", "OCF", False)
    print_ratio_row("Free Cash Flow", "Free_Cash_Flow", False)
    print_ratio_row("OCF / Net Profit", "OCF_to_Net_Profit", False)
    print_ratio_row("OCF / Total Assets", "OCF_to_Assets", True)
    print_ratio_row("Dividend Payout Ratio", "Dividend_Payout_Ratio", True)
    print_ratio_row("Cash Interest Coverage", "Cash_Interest_Coverage", False)

    w("\n  ── EARNINGS QUALITY ──")
    print_ratio_row("Earnings Quality Ratio", "Earnings_Quality", False, "OCF / Net Profit")
    print_ratio_row("Impairment Coverage", "Impairment_Coverage", True, "Impairment / Revenue")
    print_ratio_row("Core Earnings", "Core_Earnings", False)

    # ===== RISK DETECTION =====
    w("\n" + "─" * 90)
    w("  3. RISK DETECTION")
    w("─" * 90)
    for risk in risks:
        w(f"  • {risk}")

    # ===== STRICT PIPELINE RESULTS =====
    w("\n" + "─" * 90)
    w("  4. STRICT PIPELINE ENGINE RESULTS")
    w("─" * 90)
    w(f"  Status: {strict_result.get('status', 'N/A')}")
    if strict_result.get("scores"):
        sc = strict_result["scores"]
        w(f"  Reliability Score: {sc.get('reliability_score', 'N/A')}")
        w(f"  Risk Score: {sc.get('risk_score', 'N/A')}")
        w(f"  Confidence: {sc.get('confidence_score', 'N/A')}")
        w(f"  Risk Level: {sc.get('risk_level', 'N/A')}")

    if strict_result.get("validation_gates"):
        w("\n  Validation Gates by Year:")
        for yr, gates in strict_result["validation_gates"].items():
            passed = sum(1 for g in gates.values() if isinstance(g, dict) and g.get("status") == "pass")
            total = sum(1 for g in gates.values() if isinstance(g, dict) and g.get("status") != "unknown")
            w(f"    {yr}: {passed}/{total} gates passed")

    if strict_result.get("yearly_ratios"):
        w("\n  Strict Pipeline Ratios (latest available):")
        for yr in sorted(strict_result["yearly_ratios"].keys(), key=int):
            ratios = strict_result["yearly_ratios"][yr]
            computed = {k: v for k, v in ratios.items() if isinstance(v, dict) and v.get("value") is not None}
            w(f"    {yr}: {len(computed)} ratios computed")
            for name, val in list(computed.items())[:5]:
                w(f"      {name}: {val['value']:.4f}  (conf: {val['confidence']})")

    # ===== INVESTMENT CONCLUSION =====
    w("\n" + "─" * 90)
    w("  5. AI INVESTMENT CONCLUSION")
    w("─" * 90)
    w(f"  Financial Quality Score: {scores['overall_score']}/100")
    w(f"  Investment Outlook: {outlook}")

    if scores["overall_score"] >= 65:
        w("  Long-term: POSITIVE — Strong fundamentals with consistent growth trajectory")
        w("  Short-term: ACCUMULATE — Banking sector tailwinds support near-term performance")
    elif scores["overall_score"] >= 45:
        w("  Long-term: NEUTRAL — Adequate fundamentals but monitor efficiency metrics")
        w("  Short-term: HOLD — Wait for clearer catalysts before position changes")
    else:
        w("  Long-term: CAUTIOUS — Structural challenges require management intervention")
        w("  Short-term: REDUCE — Near-term headwinds outweigh catalysts")

    w("\n  Key Catalysts:")
    # Find positive trends
    for yr in reversed(data_years):
        r = results[yr]
        if r.get("Revenue_Growth") and r["Revenue_Growth"] > 0.1:
            w(f"    ✓ Strong revenue growth ({fmt(r['Revenue_Growth'], True)}) in {yr}")
            break
    for yr in reversed(data_years):
        r = results[yr]
        if r.get("Loan_Growth") and r["Loan_Growth"] > 0.1:
            w(f"    ✓ Robust loan book expansion ({fmt(r['Loan_Growth'], True)}) in {yr}")
            break

    w("\n  Key Threats:")
    for risk in risks[:3]:
        w(f"    ✗ {risk}")

    w("\n" + "=" * 90)
    w("  END OF REPORT")
    w("=" * 90)

    return "\n".join(lines)


def main():
    print("Loading normalized_results.json...")
    merged = load_normalized_data()
    metrics, years = extract_banking_metrics(merged)
    print(f"Loaded {len(years)} years: {years}")

    for yr in years:
        m = metrics[yr]
        has = sum(1 for v in m.values() if v is not None)
        print(f"  {yr}: {has}/{len(m)} fields populated")

    # Run strict pipeline
    print("\nRunning strict_pipeline analysis...")
    dataset = build_strict_pipeline_input(merged)
    strict_result = build_strict_analysis_result(dataset)
    print(f"Strict pipeline status: {strict_result.get('status')}")

    # Run comprehensive analysis
    print("\nComputing comprehensive ratios...")
    results = compute_full_analysis(metrics, years)

    # Compute scores
    scores = compute_scores(results, years)
    print(f"Overall Financial Health Score: {scores['overall_score']}/100")

    # Detect risks
    risks = detect_risks(results, years)

    # Generate report
    report = generate_report(metrics, results, years, scores, risks, strict_result)

    # Save report
    output_path = Path(__file__).parent / "analysis_report_output.txt"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"\nReport saved to: {output_path}")

    # Save JSON results
    json_output = {
        "company": "AMANA Banking PLC",
        "sector": "Banking",
        "analysis_years": years,
        "scores": scores,
        "risks": risks,
        "yearly_analysis": {},
        "strict_pipeline": strict_result,
    }
    for yr in years:
        json_output["yearly_analysis"][yr] = {
            k: round(v, 6) if isinstance(v, float) else v
            for k, v in results[yr].items()
        }

    json_path = Path(__file__).parent / "analysis_report_output.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_output, f, indent=2, default=str)
    print(f"JSON saved to: {json_path}")

    # Print report (handle Windows encoding)
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        print("\n" + report)
    except Exception:
        print("\n" + report.encode('ascii', errors='replace').decode('ascii'))


if __name__ == "__main__":
    main()
