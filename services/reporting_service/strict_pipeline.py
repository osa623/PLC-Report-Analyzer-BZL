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


def _health_interpretation(score: float) -> str:
    if score >= 80.0:
        return "strong financial health based on validated years"
    if score >= 60.0:
        return "moderate financial health with some caution flags"
    return "weak financial health and elevated diligence requirements"


def build_strict_report(extraction_dataset: dict[str, Any], analysis_result: dict[str, Any]) -> dict[str, Any]:
    if analysis_result.get("status") == "VALIDATION_FAILED":
        return analysis_result

    years = extraction_dataset.get("years")
    if not isinstance(years, dict):
        return {
            "status": "VALIDATION_FAILED",
            "reasons": ["Strict extraction dataset was unavailable during report generation"],
            "missing_fields_by_year": {},
            "recommended_next_actions": [
                "Improve extraction coverage",
                "Verify cash flow statement presence",
                "Check currency normalization",
                "Remove duplicate year conflicts",
            ],
        }

    valid_years = [year for year in analysis_result.get("valid_years", []) if isinstance(year, str) and year in years]
    valid_years = sorted(valid_years, key=int)
    ratios = analysis_result.get("financial_ratios") if isinstance(analysis_result.get("financial_ratios"), dict) else {}
    validation_flags = analysis_result.get("validation_flags") if isinstance(analysis_result.get("validation_flags"), list) else []

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
        ratio_row = ratios.get(year) if isinstance(ratios.get(year), dict) else {}

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
                _fmt_metric(ratio_row.get("ROE")),
                _fmt_metric(ratio_row.get("ROA")),
                _fmt_metric(ratio_row.get("Current Ratio")),
                _fmt_metric(ratio_row.get("Debt to Equity")),
                _fmt_metric(ratio_row.get("Net Margin")),
            ]
        )

    anomalies = sorted(
        {
            str(flag.get("message"))
            for flag in validation_flags
            if isinstance(flag, dict)
            and flag.get("code") == "MULTI_YEAR_CONTINUITY_FAILED"
            and isinstance(flag.get("message"), str)
        }
    )

    rejected_by_year: dict[str, list[str]] = {}
    for flag in validation_flags:
        if not isinstance(flag, dict):
            continue
        year = flag.get("year")
        message = flag.get("message")
        if not isinstance(year, str) or not year.isdigit() or not isinstance(message, str):
            continue
        rejected_by_year.setdefault(year, []).append(message)

    validation_summary = [f"Validated years: {', '.join(valid_years)}"] if valid_years else []
    for year in sorted(rejected_by_year.keys(), key=int):
        validation_summary.append(f"Rejected year {year}: {'; '.join(sorted(set(rejected_by_year[year])))}")

    key_findings: list[str] = []
    if valid_years:
        latest_year = valid_years[-1]
        latest_payload = years.get(latest_year, {})
        latest_income = latest_payload.get("income_statement") if isinstance(latest_payload.get("income_statement"), dict) else {}
        latest_ratios = ratios.get(latest_year) if isinstance(ratios.get(latest_year), dict) else {}
        key_findings.append(f"Validated years available for reporting: {', '.join(valid_years)}.")
        key_findings.append(
            f"Latest validated year {latest_year} revenue was {_fmt_metric(_value(latest_income, 'revenue'))} LKR millions and net profit was {_fmt_metric(_value(latest_income, 'net_profit'))} LKR millions."
        )
        if _is_number(latest_ratios.get("Current Ratio")):
            key_findings.append(f"Latest validated liquidity ratio was {_fmt_metric(latest_ratios.get('Current Ratio'))}.")

    financial_health_score = float(analysis_result.get("financial_health_score", 0.0) or 0.0)
    key_findings.append(f"Financial health score of {round(financial_health_score, 2)} indicates {_health_interpretation(financial_health_score)}.")

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
                ["Year", "ROE", "ROA", "Current Ratio", "Debt/Equity", "Net Margin"],
                ratio_rows,
            ),
        },
        "key_findings": key_findings,
        "anomalies": anomalies,
        "validation_summary": validation_summary,
        "financial_health_score": round(financial_health_score, 2),
    }
