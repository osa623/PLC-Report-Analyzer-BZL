from __future__ import annotations

from typing import Any

def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)

def _fmt_metric(value: Any) -> float | None:
    if not _is_number(value):
        return None
    return round(float(value), 6)

def _value(section: dict[str, Any], key: str) -> Any:
    value = section.get(key) if isinstance(section, dict) else None
    if key == "revenue":
        if not _is_number(value) or float(value) <= 0:
            value = section.get("total_operating_income")
        if not _is_number(value) or float(value) <= 0:
            value = section.get("net_interest_income")
    if key == "operating_cash_flow" and not _is_number(value):
        value = section.get("net_operating_cashflow")
    if key == "operating_cash_flow" and not _is_number(value):
        value = section.get("net_cash_flow")
    if key == "net_cash_flow" and not _is_number(value):
        value = section.get("net_cash_change")
    return value

def _table(columns: list[str], rows: list[list[Any]]) -> dict[str, Any]:
    return {
        "columns": columns,
        "rows": rows,
    }

def _health_interpretation(risk_level: str, reliability_band: str) -> str:
    if risk_level == "low" and reliability_band == "high":
        return "strong financial health based on validated years"
    if risk_level == "high" or reliability_band == "low":
        return "weak financial health and elevated diligence requirements"
    return "moderate financial health with some caution flags"

def build_strict_report(extraction_dataset: dict[str, Any], analysis_result: dict[str, Any]) -> dict[str, Any]:
    if analysis_result.get("status") == "VALIDATION_FAILED":
        return dict(analysis_result)

    years = extraction_dataset.get("years")
    if not isinstance(years, dict):
        return {
            "status": "VALIDATION_FAILED",
            "reasons": ["Strict extraction dataset was unavailable during report generation"]
        }

    validation_gates = analysis_result.get("validation_gates", {})
    valid_years = sorted([year for year in validation_gates.keys() if year in years], key=int)
    
    ratios = analysis_result.get("yearly_ratios", {})
    scores = analysis_result.get("scores", {})

    income_rows: list[list[Any]] = []
    balance_rows: list[list[Any]] = []
    cash_rows: list[list[Any]] = []
    ratio_rows: list[list[Any]] = []

    for year in valid_years:
        year_payload = years.get(year)
        if not isinstance(year_payload, dict):
            continue
        income = year_payload.get("income_statement") if isinstance(year_payload.get("income_statement"), dict) else {}
        balance = year_payload.get("balance_sheet") if isinstance(year_payload.get("balance_sheet"), dict) else {}
        cash_flow = year_payload.get("cash_flow") if isinstance(year_payload.get("cash_flow"), dict) else {}
        ratio_row = ratios.get(year, {})

        income_rows.append(
            [
                year,
                _fmt_metric(_value(income, "revenue")),
                _fmt_metric(_value(income, "operating_profit")),
                _fmt_metric(_value(income, "net_profit")),
            ]
        )
        balance_rows.append(
            [
                year,
                _fmt_metric(balance.get("total_assets")),
                _fmt_metric(balance.get("total_liabilities")),
                _fmt_metric(balance.get("total_equity")),
            ]
        )
        cash_rows.append(
            [
                year,
                _fmt_metric(_value(cash_flow, "operating_cash_flow")),
                _fmt_metric(_value(cash_flow, "investing_cash_flow")),
                _fmt_metric(_value(cash_flow, "financing_cash_flow")),
                _fmt_metric(_value(cash_flow, "closing_cash")),
            ]
        )
        ratio_rows.append(
            [
                year,
                _fmt_metric(ratio_row.get("Return on Equity (ROE)")),
                _fmt_metric(ratio_row.get("Return on Assets (ROA)")),
                _fmt_metric(ratio_row.get("Current Ratio")),
                _fmt_metric(ratio_row.get("Debt to Equity")),
                _fmt_metric(ratio_row.get("Net Profit Margin")),
                _fmt_metric(ratio_row.get("Gross Margin")),
                _fmt_metric(ratio_row.get("Operating Margin")),
                _fmt_metric(ratio_row.get("Cash Ratio")),
            ]
        )

    anomalies = []
    rejected_by_year: dict[str, list[str]] = {}
    
    for year, gates in validation_gates.items():
        year_rejections = []
        for gate_name, gate_res in gates.items():
            if gate_res.get("status") == "fail":
                year_rejections.append(f"{gate_name} failed")
                if gate_name == "Multi-Year Continuity":
                    anomalies.append(f"{year}: Significant multi-year discontinuity detected.")
        if year_rejections:
            rejected_by_year[year] = year_rejections

    validation_summary = [f"Processed years: {', '.join(valid_years)}"] if valid_years else []
    for year in sorted(rejected_by_year.keys(), key=int):
        validation_summary.append(f"Validation warnings for year {year}: {'; '.join(sorted(set(rejected_by_year[year])))}")

    key_findings: list[str] = []
    if valid_years:
        latest_year = valid_years[-1]
        latest_payload = years.get(latest_year, {})
        latest_income = latest_payload.get("income_statement") if isinstance(latest_payload.get("income_statement"), dict) else {}
        latest_ratios = ratios.get(latest_year, {})
        key_findings.append(f"Processed years available for reporting: {', '.join(valid_years)}.")
        key_findings.append(
            f"Latest year {latest_year} revenue was {_fmt_metric(_value(latest_income, 'revenue'))} and net profit was {_fmt_metric(_value(latest_income, 'net_profit'))}."
        )
        if _is_number(latest_ratios.get("Current Ratio")):
            key_findings.append(f"Latest liquidity ratio (Current Ratio) was {_fmt_metric(latest_ratios.get('Current Ratio'))}.")

    risk_level = scores.get("risk_level", "medium")
    reliability_band = scores.get("reliability_band", "medium")
    key_findings.append(f"Overall analysis indicates {_health_interpretation(risk_level, reliability_band)} (Risk: {risk_level}, Reliability: {reliability_band}).")

    return {
        "tables": {
            "income_statement": _table(
                ["Year", "Revenue", "Operating Profit", "Net Profit"],
                income_rows,
            ),
            "balance_sheet": _table(
                ["Year", "Total Assets", "Total Liabilities", "Total Equity"],
                balance_rows,
            ),
            "cash_flow": _table(
                ["Year", "Operating CF", "Investing CF", "Financing CF", "Closing Cash"],
                cash_rows,
            ),
            "ratios": _table(
                ["Year", "ROE", "ROA", "Current Ratio", "Debt/Equity", "Net Margin", "Gross Margin", "Operating Margin", "Cash Ratio"],
                ratio_rows,
            ),
        },
        "key_findings": key_findings,
        "anomalies": sorted(set(anomalies)),
        "validation_summary": validation_summary,
        "financial_health_score": scores.get("reliability_score", 0.0),
        "risk_score": scores.get("risk_score", 0.0),
        "scores": scores,
        "evaluated_equations_by_year": analysis_result.get("evaluated_equations_by_year", {})
    }
