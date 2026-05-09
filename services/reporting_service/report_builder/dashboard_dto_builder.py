from __future__ import annotations

from typing import Any

from platform_core.contracts import (
    DASHBOARD_DTO_SCHEMA_VERSION,
    REPORTING_CALCULATION_VERSION,
    DashboardDTO,
    build_envelope,
)


def _to_float(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _round2(value: Any) -> float | None:
    parsed = _to_float(value)
    if parsed is None:
        return None
    return round(parsed, 2)


def _fmt_currency(value: Any, currency: str = "LKR") -> str:
    parsed = _to_float(value)
    if parsed is None:
        return "n/a"
    return f"{currency} {parsed:,.2f}"


def _fmt_percent(value: Any) -> str:
    parsed = _to_float(value)
    if parsed is None:
        return "n/a"
    return f"{parsed * 100.0:.2f}%"


def _fmt_number(value: Any) -> str:
    parsed = _to_float(value)
    if parsed is None:
        return "n/a"
    return f"{parsed:.2f}"


def build_dashboard_dto(
    analysis_result: dict[str, Any],
    financial_statement_model: dict[str, Any],
    risk: dict[str, Any],
) -> DashboardDTO:
    envelope = analysis_result.get("envelope") if isinstance(analysis_result.get("envelope"), dict) else {}
    dataset_id = str(envelope.get("dataset_id") or "dataset_unknown")
    dto_envelope = build_envelope(
        dataset_id=dataset_id,
        schema_version=DASHBOARD_DTO_SCHEMA_VERSION,
        calculation_version=REPORTING_CALCULATION_VERSION,
    )

    metrics = analysis_result.get("metrics") if isinstance(analysis_result.get("metrics"), dict) else {}
    by_year = metrics.get("by_year") if isinstance(metrics.get("by_year"), dict) else {}
    years = sorted([y for y in by_year.keys() if isinstance(y, str) and y.isdigit()], key=lambda y: int(y))
    latest_year = metrics.get("latest_year") if isinstance(metrics.get("latest_year"), str) else (years[-1] if years else "")
    latest = by_year.get(latest_year) if isinstance(by_year.get(latest_year), dict) else {}

    health_scores = analysis_result.get("financial_health_scores") if isinstance(analysis_result.get("financial_health_scores"), dict) else {}

    metadata = financial_statement_model.get("metadata") if isinstance(financial_statement_model.get("metadata"), dict) else {}
    currency = str(metadata.get("currency") or "LKR")
    income_stmt = financial_statement_model.get("income_statement") if isinstance(financial_statement_model.get("income_statement"), dict) else {}
    balance_sheet = financial_statement_model.get("balance_sheet") if isinstance(financial_statement_model.get("balance_sheet"), dict) else {}

    top_summary_cards = {
        "net_profit": {
            "raw": _round2(latest.get("net_profit")),
            "display": _fmt_currency(latest.get("net_profit"), currency),
        },
        "roe": {
            "raw": _round2(latest.get("return_on_equity")),
            "display": _fmt_percent(latest.get("return_on_equity")),
        },
        "current_ratio": {
            "raw": _round2(latest.get("current_ratio")),
            "display": _fmt_number(latest.get("current_ratio")),
        },
        "debt_to_equity": {
            "raw": _round2(latest.get("debt_to_equity")),
            "display": _fmt_number(latest.get("debt_to_equity")),
        },
        "financial_health_score": {
            "raw": _round2(health_scores.get("overall_health_score")),
            "display": _fmt_number(health_scores.get("overall_health_score")),
        },
    }

    chart_datasets = {
        "revenue_trend": [
            {"year": year, "value": _round2((by_year.get(year) or {}).get("revenue"))}
            for year in years
        ],
        "profit_trend": [
            {"year": year, "value": _round2((by_year.get(year) or {}).get("net_profit"))}
            for year in years
        ],
        "ratio_radar": [
            {"metric": "Gross Margin", "value": _round2(latest.get("gross_margin"))},
            {"metric": "Operating Margin", "value": _round2(latest.get("operating_margin"))},
            {"metric": "Net Margin", "value": _round2(latest.get("net_margin"))},
            {"metric": "Current Ratio", "value": _round2(latest.get("current_ratio"))},
            {"metric": "Debt to Equity", "value": _round2(latest.get("debt_to_equity"))},
            {"metric": "ROE", "value": _round2(latest.get("return_on_equity"))},
            {"metric": "Asset Turnover", "value": _round2(latest.get("asset_turnover"))},
        ],
        "financial_health_distribution": [
            {"category": "Profitability", "score": _round2(health_scores.get("profitability_score"))},
            {"category": "Liquidity", "score": _round2(health_scores.get("liquidity_score"))},
            {"category": "Leverage", "score": _round2(health_scores.get("leverage_score"))},
            {"category": "Efficiency", "score": _round2(health_scores.get("efficiency_score"))},
            {"category": "Growth", "score": _round2(health_scores.get("growth_score"))},
        ],
    }

    table_data = {
        "income_statement_table": [
            {"metric": "Revenue", "value": _fmt_currency(income_stmt.get("revenue"), currency)},
            {"metric": "Cost of Sales", "value": _fmt_currency(income_stmt.get("cost_of_sales"), currency)},
            {"metric": "Gross Profit", "value": _fmt_currency(income_stmt.get("gross_profit"), currency)},
            {"metric": "Operating Profit", "value": _fmt_currency(income_stmt.get("operating_profit"), currency)},
            {"metric": "Net Profit", "value": _fmt_currency(income_stmt.get("net_profit"), currency)},
        ],
        "balance_sheet_table": [
            {"metric": "Total Assets", "value": _fmt_currency(balance_sheet.get("total_assets"), currency)},
            {"metric": "Total Liabilities", "value": _fmt_currency(balance_sheet.get("total_liabilities"), currency)},
            {"metric": "Equity", "value": _fmt_currency(balance_sheet.get("equity"), currency)},
            {"metric": "Current Assets", "value": _fmt_currency(balance_sheet.get("current_assets"), currency)},
            {"metric": "Current Liabilities", "value": _fmt_currency(balance_sheet.get("current_liabilities"), currency)},
            {"metric": "Inventory", "value": _fmt_currency(balance_sheet.get("inventory"), currency)},
            {"metric": "Cash", "value": _fmt_currency(balance_sheet.get("cash"), currency)},
            {"metric": "Total Debt", "value": _fmt_currency(balance_sheet.get("total_debt"), currency)},
        ],
        "ratio_comparison_table": [
            {
                "year": year,
                "gross_margin": _fmt_percent((by_year.get(year) or {}).get("gross_margin")),
                "operating_margin": _fmt_percent((by_year.get(year) or {}).get("operating_margin")),
                "net_margin": _fmt_percent((by_year.get(year) or {}).get("net_margin")),
                "roe": _fmt_percent((by_year.get(year) or {}).get("return_on_equity")),
                "current_ratio": _fmt_number((by_year.get(year) or {}).get("current_ratio")),
                "debt_to_equity": _fmt_number((by_year.get(year) or {}).get("debt_to_equity")),
            }
            for year in years
        ],
        "risk_indicators_table": [
            {"flag": flag, "status": "active"}
            for flag in (analysis_result.get("risk_flags") if isinstance(analysis_result.get("risk_flags"), list) else [])
        ]
        or [
            {
                "flag": "none",
                "status": str(risk.get("overall_risk_level") or "low"),
            }
        ],
    }

    presentation = {
        "rounding": 2,
        "currency": currency,
        "percentage_format": "x100_with_2_decimals",
        "notes": "Presentation layer only: no metric calculations performed in reporting service.",
    }

    return DashboardDTO(
        envelope=dto_envelope,
        top_summary_cards=top_summary_cards,
        chart_datasets=chart_datasets,
        table_data=table_data,
        presentation=presentation,
    )
