from __future__ import annotations

from typing import Any


REQUIRED_FIELDS: tuple[tuple[str, str], ...] = (
    ("income_statement", "revenue"),
    ("balance_sheet", "total_assets"),
    ("balance_sheet", "total_equity"),
    ("cash_flow", "operating_cash_flow"),
    ("income_statement", "net_profit"),
)

ALL_FIELDS: tuple[tuple[str, str], ...] = (
    ("balance_sheet", "total_assets"),
    ("balance_sheet", "total_liabilities"),
    ("balance_sheet", "total_equity"),
    ("balance_sheet", "current_assets"),
    ("balance_sheet", "current_liabilities"),
    ("balance_sheet", "cash_and_cash_equivalents"),
    ("balance_sheet", "total_debt"),
    ("income_statement", "revenue"),
    ("income_statement", "cost_of_sales"),
    ("income_statement", "gross_profit"),
    ("income_statement", "operating_profit"),
    ("income_statement", "net_profit"),
    ("cash_flow", "operating_cash_flow"),
    ("cash_flow", "investing_cash_flow"),
    ("cash_flow", "financing_cash_flow"),
    ("cash_flow", "net_cash_flow"),
    ("cash_flow", "opening_cash"),
    ("cash_flow", "closing_cash"),
)

CONTINUITY_FIELDS: tuple[tuple[str, str], ...] = (
    ("income_statement", "revenue"),
    ("balance_sheet", "total_assets"),
    ("balance_sheet", "total_equity"),
    ("cash_flow", "operating_cash_flow"),
    ("income_statement", "net_profit"),
)

RECOMMENDED_NEXT_ACTIONS = [
    "Improve extraction coverage",
    "Verify cash flow statement presence",
    "Check currency normalization",
    "Remove duplicate year conflicts",
]


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _get_field(year_payload: dict[str, Any], section: str, field: str) -> float | None:
    section_payload = year_payload.get(section)
    if not isinstance(section_payload, dict):
        return None
    value = section_payload.get(field)
    if field == "revenue":
        if not _is_number(value) or float(value) <= 0:
            value = section_payload.get("total_operating_income")
        if not _is_number(value) or float(value) <= 0:
            value = section_payload.get("net_interest_income")
    if field == "operating_cash_flow" and not _is_number(value):
        value = section_payload.get("net_operating_cashflow")
    if field == "operating_cash_flow" and not _is_number(value):
        value = section_payload.get("net_cash_flow")
    if field == "net_cash_flow" and not _is_number(value):
        value = section_payload.get("net_cash_change")
    if not _is_number(value):
        return None
    return float(value)


def _relative_gap(left: float, right: float) -> float:
    denom = max(abs(float(left)), abs(float(right)), 1.0)
    return abs(float(left) - float(right)) / denom


def _safe_div(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator is None or abs(float(denominator)) <= 1e-12:
        return None
    return round(float(numerator) / float(denominator), 6)


def _year_completeness(year_payload: dict[str, Any]) -> float:
    present = 0
    for section, field in ALL_FIELDS:
        if _get_field(year_payload, section, field) is not None:
            present += 1
    return present / float(len(ALL_FIELDS))


def _missing_required_fields(year_payload: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    for section, field in REQUIRED_FIELDS:
        if _get_field(year_payload, section, field) is None:
            missing.append(f"{section}.{field}")
    return missing


def _balance_gate(year_payload: dict[str, Any]) -> tuple[bool, str | None]:
    assets = _get_field(year_payload, "balance_sheet", "total_assets")
    liabilities = _get_field(year_payload, "balance_sheet", "total_liabilities")
    equity = _get_field(year_payload, "balance_sheet", "total_equity")
    if None in (assets, liabilities, equity):
        return True, None
    if _relative_gap(float(assets), float(liabilities) + float(equity)) > 0.03:
        return False, "Balance sheet equation failed beyond 3% tolerance"
    return True, None


def _cash_gate(year_payload: dict[str, Any]) -> tuple[bool, str | None]:
    opening_cash = _get_field(year_payload, "cash_flow", "opening_cash")
    net_cash_flow = _get_field(year_payload, "cash_flow", "net_cash_flow")
    closing_cash = _get_field(year_payload, "cash_flow", "closing_cash")
    if None in (opening_cash, net_cash_flow, closing_cash):
        return True, None
    if _relative_gap(float(opening_cash) + float(net_cash_flow), float(closing_cash)) > 0.03:
        return False, "Cash reconciliation failed beyond 3% tolerance"
    return True, None


def _build_ratio_row(year_payload: dict[str, Any]) -> dict[str, float | None]:
    revenue = _get_field(year_payload, "income_statement", "revenue")
    net_profit = _get_field(year_payload, "income_statement", "net_profit")
    total_assets = _get_field(year_payload, "balance_sheet", "total_assets")
    total_equity = _get_field(year_payload, "balance_sheet", "total_equity")
    current_assets = _get_field(year_payload, "balance_sheet", "current_assets")
    current_liabilities = _get_field(year_payload, "balance_sheet", "current_liabilities")
    total_debt = _get_field(year_payload, "balance_sheet", "total_debt")
    return {
        "ROE": _safe_div(net_profit, total_equity),
        "ROA": _safe_div(net_profit, total_assets),
        "Net Margin": _safe_div(net_profit, revenue),
        "Current Ratio": _safe_div(current_assets, current_liabilities),
        "Debt to Equity": _safe_div(total_debt, total_equity),
        "Asset Turnover": _safe_div(revenue, total_assets),
    }


def _continuity_flags(extraction_dataset: dict[str, Any]) -> list[dict[str, Any]]:
    years = extraction_dataset.get("years")
    if not isinstance(years, dict):
        return []

    ordered_years = sorted((year for year in years.keys() if year.isdigit()), key=int)
    flags: list[dict[str, Any]] = []

    for section, field in CONTINUITY_FIELDS:
        previous_year: str | None = None
        previous_value: float | None = None
        for year in ordered_years:
            current_payload = years.get(year)
            if not isinstance(current_payload, dict):
                continue
            current_value = _get_field(current_payload, section, field)
            if current_value is None:
                continue
            if previous_year is not None and previous_value is not None and abs(previous_value) > 1e-12:
                yoy_change = abs((float(current_value) - float(previous_value)) / abs(float(previous_value)))
                if yoy_change > 5.0:
                    flags.append(
                        {
                            "year": year,
                            "code": "MULTI_YEAR_CONTINUITY_FAILED",
                            "message": f"{section}.{field} changed by more than 500% from {previous_year} to {year}",
                            "severity": "error",
                        }
                    )
            previous_year = year
            previous_value = current_value

    return flags


def _ratio_stability_score(financial_ratios: dict[str, dict[str, float | None]]) -> float:
    years = sorted((year for year in financial_ratios.keys() if year.isdigit()), key=int)
    if not years:
        return 0.0
    if len(years) == 1:
        return 50.0

    changes: list[float] = []
    ratio_names = ("ROE", "ROA", "Net Margin", "Current Ratio", "Debt to Equity", "Asset Turnover")
    for index in range(1, len(years)):
        previous = financial_ratios.get(years[index - 1], {})
        current = financial_ratios.get(years[index], {})
        for ratio_name in ratio_names:
            left = previous.get(ratio_name)
            right = current.get(ratio_name)
            if not _is_number(left) or not _is_number(right):
                continue
            changes.append(_relative_gap(float(left), float(right)))

    if not changes:
        return 50.0
    average_change = sum(changes) / float(len(changes))
    return round(max(0.0, min(100.0, 100.0 * (1.0 - min(average_change, 2.0) / 2.0))), 2)


def build_strict_analysis_result(extraction_dataset: dict[str, Any]) -> dict[str, Any]:
    years = extraction_dataset.get("years")
    if not isinstance(years, dict):
        return build_validation_failed_diagnostic({"years": {}}, ["No extracted years were available for validation"])

    ordered_years = sorted((year for year in years.keys() if year.isdigit()), key=int)
    validation_flags: list[dict[str, Any]] = []
    rejected_years: list[str] = []
    valid_years: list[str] = []

    continuity_flags = _continuity_flags(extraction_dataset)
    continuity_rejections = {flag["year"] for flag in continuity_flags if isinstance(flag.get("year"), str)}

    completeness_scores: list[float] = []
    accounting_passes = 0
    positive_operating_cash_flow_years = 0
    financial_ratios: dict[str, dict[str, float | None]] = {}

    for year in ordered_years:
        payload = years.get(year)
        if not isinstance(payload, dict):
            continue

        completeness = _year_completeness(payload)
        completeness_scores.append(completeness)

        year_errors: list[dict[str, Any]] = []
        missing_required = _missing_required_fields(payload)
        if missing_required:
            year_errors.append(
                {
                    "year": year,
                    "code": "MINIMUM_COMPLETENESS_FAILED",
                    "message": f"Missing required fields: {', '.join(missing_required)}",
                    "severity": "error",
                }
            )

        balance_ok, balance_message = _balance_gate(payload)
        if not balance_ok:
            year_errors.append(
                {
                    "year": year,
                    "code": "BALANCE_SHEET_EQUATION_FAILED",
                    "message": balance_message,
                    "severity": "error",
                }
            )

        cash_ok, cash_message = _cash_gate(payload)
        if not cash_ok:
            year_errors.append(
                {
                    "year": year,
                    "code": "CASH_RECONCILIATION_FAILED",
                    "message": cash_message,
                    "severity": "error",
                }
            )

        if year in continuity_rejections:
            for flag in continuity_flags:
                if flag.get("year") == year:
                    year_errors.append(flag)

        if not year_errors:
            valid_years.append(year)
            if balance_ok and cash_ok:
                accounting_passes += 1
            ratios = _build_ratio_row(payload)
            financial_ratios[year] = ratios
            operating_cash_flow = _get_field(payload, "cash_flow", "operating_cash_flow")
            if operating_cash_flow is not None and float(operating_cash_flow) > 0:
                positive_operating_cash_flow_years += 1
        else:
            rejected_years.append(year)
            validation_flags.extend(year_errors)

    if not validation_flags:
        validation_flags = []

    completeness_score = round((sum(completeness_scores) / float(len(completeness_scores))) * 100.0, 2) if completeness_scores else 0.0
    accounting_consistency_score = round((accounting_passes / float(len(ordered_years))) * 100.0, 2) if ordered_years else 0.0
    continuity_score = round((1.0 - (len(continuity_rejections) / float(len(ordered_years)))) * 100.0, 2) if ordered_years else 0.0
    ratio_stability_score = _ratio_stability_score(financial_ratios)
    cash_flow_health_score = round((positive_operating_cash_flow_years / float(len(valid_years))) * 100.0, 2) if valid_years else 0.0

    financial_health_score = round(
        (completeness_score * 0.30)
        + (accounting_consistency_score * 0.25)
        + (continuity_score * 0.20)
        + (ratio_stability_score * 0.15)
        + (cash_flow_health_score * 0.10),
        2,
    )

    if not valid_years:
        reasons = [flag["message"] for flag in validation_flags if isinstance(flag, dict) and isinstance(flag.get("message"), str)]
        return build_validation_failed_diagnostic(extraction_dataset, reasons)

    return {
        "valid_years": valid_years,
        "rejected_years": rejected_years,
        "validation_flags": validation_flags,
        "financial_ratios": {year: financial_ratios[year] for year in sorted(financial_ratios.keys(), key=int)},
        "financial_health_score": financial_health_score,
    }


def build_validation_failed_diagnostic(extraction_dataset: dict[str, Any], reasons: list[str]) -> dict[str, Any]:
    years = extraction_dataset.get("years")
    missing_fields_by_year: dict[str, list[str]] = {}
    if isinstance(years, dict):
        for year, payload in years.items():
            if isinstance(year, str) and year.isdigit() and isinstance(payload, dict):
                missing_fields_by_year[year] = _missing_required_fields(payload)

    unique_reasons = sorted({reason for reason in reasons if isinstance(reason, str) and reason.strip()})
    return {
        "status": "VALIDATION_FAILED",
        "reasons": unique_reasons or ["No year passed the mandatory validation gates"],
        "missing_fields_by_year": missing_fields_by_year,
        "recommended_next_actions": RECOMMENDED_NEXT_ACTIONS,
    }
