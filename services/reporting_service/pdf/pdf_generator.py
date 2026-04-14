from __future__ import annotations

from datetime import datetime, timezone


def render_report_payload(report_id: str, sections: dict) -> dict:
    markdown = [
        f"# Final Report: {report_id}",
        "",
        "## Executive Summary",
        str(sections.get("executive_summary", "")),
        "",
        "## Financial Health Overview",
        str(sections.get("financial_health_overview", "")),
        "",
        "## Ratio Analysis",
        str(sections.get("ratio_analysis", {})),
        "",
        "## Risk & Governance Insights",
        str(sections.get("risk_governance_insights", [])),
        "",
        "## Sector Comparison",
        str(sections.get("sector_comparison", {})),
        "",
        "## Confidence & Data Quality",
        str(sections.get("confidence_data_quality", {})),
    ]
    return {
        "report_id": report_id,
        "status": "generated",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "format": "markdown",
        "content": "\n".join(markdown),
        "sections": sections,
    }
