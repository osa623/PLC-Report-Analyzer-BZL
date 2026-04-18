from __future__ import annotations


def compose_sections(narrative: dict, chart_data: dict) -> dict:
    legacy = {
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

    investor_report = narrative.get("investor_report") if isinstance(narrative.get("investor_report"), dict) else {}
    ordered = {
        "Data Reliability & Restatement Report": investor_report.get("Data Coverage & Report Quality Assessment", {}),
        "Financial Ratio Tables (Year-wise)": investor_report.get("Ratio Analysis Dashboard", {}),
        "Multi-Year Trend Analysis": investor_report.get("Multi-Year Trend Analysis", investor_report.get("Structural Health Analysis", {})),
        "Forensic & Anomaly Findings": investor_report.get("Risk & Red Flag Detection", {}),
        "Risk Scoring Dashboard": investor_report.get("Final Risk Score & Verdict", {}),
        "Investor-Grade Analytical Narrative": {
            "executive_summary": investor_report.get("Executive Summary", ""),
            "investment_perspective": investor_report.get("Investment Perspective (Bull vs Bear case)", {}),
            "sector_interpretation": investor_report.get("Sector-Aware Interpretation", {}),
            "annual_report_derived_insights": investor_report.get("Annual Report Derived Insights", {}),
            "external_context_insights": investor_report.get("External Context Insights", {}),
        },
    }
    return {
        "investor_grade_report": investor_report,
        "institutional_research_report": ordered,
        **legacy,
    }
