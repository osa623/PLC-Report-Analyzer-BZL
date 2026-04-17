from __future__ import annotations


def compose_sections(narrative: dict, chart_data: dict) -> dict:
    return {
        "executive_summary": narrative["executive_summary"],
        "company_performance_overview": narrative["financial_health_overview"],
        "financial_analysis": {
            "ratio_analysis": narrative["ratio_analysis"],
            "sector_comparison": narrative["sector_comparison"],
            "pattern_summary": narrative["pattern_summary"],
        },
        "risk_analysis": narrative["risk_analysis"],
        "risk_governance_insights": narrative["risk_governance_insights"],
        "data_limitations_disclosure": narrative["data_scope_and_limitations"],
        "confidence_data_quality": narrative["confidence_data_quality"],
        "charts": chart_data,
    }
