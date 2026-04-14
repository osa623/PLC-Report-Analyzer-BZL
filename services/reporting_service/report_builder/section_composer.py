from __future__ import annotations


def compose_sections(narrative: dict, chart_data: dict) -> dict:
    return {
        "executive_summary": narrative["executive_summary"],
        "financial_health_overview": narrative["financial_health_overview"],
        "ratio_analysis": narrative["ratio_analysis"],
        "risk_governance_insights": narrative["risk_governance_insights"],
        "sector_comparison": narrative["sector_comparison"],
        "confidence_data_quality": narrative["confidence_data_quality"],
        "charts": chart_data,
        "patterns": narrative["pattern_summary"],
    }
