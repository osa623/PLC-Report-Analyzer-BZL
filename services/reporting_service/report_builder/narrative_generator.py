from __future__ import annotations


def _format_years(ratios: dict) -> list[str]:
    years = ratios.get("detected_years") if isinstance(ratios, dict) else []
    return [y for y in years if isinstance(y, str)] if isinstance(years, list) else []


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
    current_ratio_text = f"{float(current_ratio):.2f}" if isinstance(current_ratio, (int, float)) else "not available"
    ratio_status = ratios.get("status") if isinstance(ratios, dict) else None
    risk_status = risk.get("status") if isinstance(risk, dict) else None

    if ratio_status == "blocked":
        executive_summary = "Financial metrics were extracted, but ratio analytics were gated because required statement coverage was below the mandatory threshold."
    elif risk_status == "blocked":
        executive_summary = "Ratio analytics were generated, while risk outputs were gated due to insufficient ratio coverage for reliable risk scoring."
    else:
        executive_summary = "Analysis completed using extracted financial metrics from uploaded documents with data-scope transparency."

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
    }
