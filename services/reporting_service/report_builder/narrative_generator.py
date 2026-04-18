from __future__ import annotations


def _format_years(ratios: dict) -> list[str]:
    years = ratios.get("detected_years") if isinstance(ratios, dict) else []
    return [y for y in years if isinstance(y, str)] if isinstance(years, list) else []


def _sector_guess(validated: dict, sector: dict) -> str:
    explicit = sector.get("sector") if isinstance(sector, dict) else None
    if isinstance(explicit, str) and explicit.strip():
        return explicit.strip().lower()
    notes = []
    if isinstance(validated, dict):
        ns = validated.get("narrative_sections", {})
        if isinstance(ns, dict):
            for key in ("notes", "risk", "segment"):
                values = ns.get(key, [])
                if isinstance(values, list):
                    notes.extend([str(v).lower() for v in values])
    blob = " ".join(notes)
    if any(k in blob for k in ("loan", "deposit", "interest spread", "capital adequacy")):
        return "financials"
    if any(k in blob for k in ("inventory", "factory", "plant", "manufacturing")):
        return "manufacturing"
    if any(k in blob for k in ("subscription", "saas", "platform", "software")):
        return "technology"
    if any(k in blob for k in ("retail", "store", "consumer")):
        return "consumer"
    return "diversified"


def _ratio(v: object, pct: bool = False) -> str:
    if not isinstance(v, (int, float)):
        return "n/a"
    if pct:
        return f"{float(v) * 100:.2f}%"
    return f"{float(v):.2f}"


def generate_narrative(
    validated: dict,
    ratios: dict,
    patterns: list,
    confidence: dict,
    sector: dict,
    risk: dict,
    transparency: dict,
) -> dict:
    ratio_source = ratios
    if isinstance(ratios.get("latest_year"), str) and isinstance(ratios.get("by_year"), dict):
        ratio_source = ratios["by_year"].get(ratios["latest_year"], ratios)

    years = _format_years(ratios)
    year_text = ", ".join(years) if years else "latest reporting period"
    current_ratio = ratio_source.get("current_ratio")
    current_ratio_text = _ratio(current_ratio)
    ratio_status = ratios.get("status") if isinstance(ratios, dict) else None
    risk_status = risk.get("status") if isinstance(risk, dict) else None

    if ratio_status == "blocked":
        executive_summary = "Financial metrics were extracted, but ratio analytics were gated because required statement coverage was below the mandatory threshold."
    elif risk_status == "blocked":
        executive_summary = "Ratio analytics were generated, while risk outputs were gated due to insufficient ratio coverage for reliable risk scoring."
    else:
        executive_summary = "Institutional financial analysis completed with normalized statements, multi-period diagnostics, and risk-weighted interpretation."

    forensic_flags = ratios.get("forensic_flags") if isinstance(ratios.get("forensic_flags"), list) else []
    trend_mode = "Multi-Year Trend Analysis" if len([y for y in years if y.isdigit()]) >= 2 else "Structural Health Analysis"

    sector_type = _sector_guess(validated, sector)
    if sector_type == "financials":
        sector_interpretation = "Banking/financial lens applied: monitor loan growth vs deposit funding quality, net interest economics, and capital strength signals."
    elif sector_type == "manufacturing":
        sector_interpretation = "Industrial lens applied: inventory cycle discipline, capex intensity, and asset utilization are primary value drivers."
    elif sector_type == "technology":
        sector_interpretation = "Technology lens applied: margin scalability and cash conversion vs accounting earnings quality are key."
    elif sector_type == "consumer":
        sector_interpretation = "Consumer/retail lens applied: working capital cycle velocity and inventory turnover quality are central."
    else:
        sector_interpretation = "Diversified lens applied: balance sheet flexibility and cash conversion quality dominate resilience assessment."

    bull_points = []
    bear_points = []
    if isinstance(ratio_source.get("net_margin"), (int, float)) and float(ratio_source["net_margin"]) > 0.1:
        bull_points.append("Profitability profile indicates healthy earnings conversion at the net margin level.")
    if isinstance(ratio_source.get("current_ratio"), (int, float)) and float(ratio_source["current_ratio"]) >= 1.2:
        bull_points.append("Liquidity coverage suggests manageable short-term funding pressure.")
    if isinstance(risk.get("overall_risk_score"), (int, float)) and float(risk["overall_risk_score"]) >= 61:
        bear_points.append("Composite risk score signals elevated downside risk and higher volatility of outcomes.")
    if forensic_flags:
        bear_points.append("Forensic screening identified accounting/operational red flags that warrant deeper diligence.")
    if not bull_points:
        bull_points.append("Base-case support depends on execution consistency across profitability and balance sheet discipline.")
    if not bear_points:
        bear_points.append("No severe forensic red flags were detected, but coverage gaps still require monitoring.")

    final_score = risk.get("overall_risk_score") if isinstance(risk.get("overall_risk_score"), (int, float)) else None
    final_level = risk.get("overall_risk_level") if isinstance(risk.get("overall_risk_level"), str) else "unknown"
    verdict = "Investable with normal monitoring" if final_level == "low" else "Selective exposure with risk controls" if final_level == "moderate" else "High-risk profile; require strict position sizing"

    investor_sections = {
        "Executive Summary": executive_summary,
        "Data Coverage & Report Quality Assessment": {
            "detected_periods": years,
            "comparatives_present": len([y for y in years if y.isdigit()]) >= 2,
            "coverage": ratios.get("data_coverage", {}),
            "confidence": confidence,
            "limitations": transparency,
        },
        "Financial Performance Analysis": {
            "revenue_growth_yoy": ratio_source.get("revenue_growth_yoy"),
            "net_profit_growth_yoy": ratio_source.get("net_profit_growth_yoy"),
            "operating_profit_growth_yoy": ratio_source.get("operating_profit_growth_yoy"),
            "eps_growth_yoy": ratio_source.get("eps_growth_yoy"),
            "asset_growth_yoy": ratio_source.get("asset_growth_yoy"),
            "equity_growth_yoy": ratio_source.get("equity_growth_yoy"),
            "growth_cagr": ratios.get("growth", {}),
        },
        "Ratio Analysis Dashboard": ratio_source,
        f"{trend_mode}": {
            "pattern_summary": patterns,
            "growth_snapshot": ratios.get("latest_growth_snapshot", {}),
        },
        "Cash Flow & Earnings Quality": {
            "operating_cashflow_to_net_profit": ratio_source.get("operating_cashflow_to_net_profit"),
            "free_cash_flow": ratio_source.get("free_cash_flow"),
            "free_cash_flow_growth": ratio_source.get("free_cash_flow_growth"),
            "cash_conversion_quality_score": ratio_source.get("cash_conversion_quality_score"),
        },
        "Balance Sheet Strength": {
            "current_ratio": ratio_source.get("current_ratio"),
            "quick_ratio": ratio_source.get("quick_ratio"),
            "cash_ratio": ratio_source.get("cash_ratio"),
            "debt_to_equity": ratio_source.get("debt_to_equity"),
            "debt_ratio": ratio_source.get("debt_ratio"),
            "interest_coverage": ratio_source.get("interest_coverage"),
        },
        "Risk & Red Flag Detection": {
            "risk": risk,
            "forensic_red_flags": forensic_flags,
        },
        "Sector-Aware Interpretation": {
            "detected_sector_profile": sector_type,
            "interpretation": sector_interpretation,
            "sector_comparison": sector,
        },
        "Investment Perspective (Bull vs Bear case)": {
            "bull_case": bull_points,
            "bear_case": bear_points,
        },
        "Final Risk Score & Verdict": {
            "risk_score_0_100": final_score,
            "risk_level": final_level,
            "verdict": verdict,
        },
        "Annual Report Derived Insights": {
            "source": "annual_reports_only",
            "insights": {
                "ratios": ratio_source,
                "patterns": patterns,
                "risk": risk,
                "confidence": confidence,
            },
        },
        "External Context Insights": {
            "source": "external_optional",
            "enabled": False,
            "notes": [
                "No external market data was required for this run.",
                "If enabled, external inputs are limited to inflation adjustment, industry comparison, and risk-free rate context.",
            ],
        },
    }

    return {
        "executive_summary": executive_summary,
        "financial_health_overview": f"Current ratio: {current_ratio_text}. Detected periods: {year_text}.",
        "ratio_analysis": ratios,
        "risk_analysis": risk,
        "risk_governance_insights": {
            "narrative_risk_extracts": validated.get("narrative_sections", {}).get("risk", []),
            "risk_flags": risk.get("risk_flags", []),
        },
        "sector_comparison": sector,
        "confidence_data_quality": confidence,
        "pattern_summary": patterns,
        "data_scope_and_limitations": transparency,
        "investor_report": investor_sections,
    }
