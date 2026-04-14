from __future__ import annotations


def generate_narrative(validated: dict, ratios: dict, patterns: list, confidence: dict, sector: dict) -> dict:
    return {
        "executive_summary": "Deterministic analysis completed for uploaded report.",
        "financial_health_overview": f"Current ratio: {ratios.get('current_ratio', 0):.2f}",
        "ratio_analysis": ratios,
        "risk_governance_insights": validated.get("narrative_sections", {}).get("risk", []),
        "sector_comparison": sector,
        "confidence_data_quality": confidence,
        "pattern_summary": patterns,
    }
