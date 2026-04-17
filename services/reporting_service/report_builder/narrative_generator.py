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

    return {
        "executive_summary": "Analysis completed successfully using all available uploaded financial data.",
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
