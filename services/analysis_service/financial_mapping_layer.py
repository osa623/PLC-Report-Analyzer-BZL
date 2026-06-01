from __future__ import annotations

import re
from collections import defaultdict
from typing import Any


SUPPORTED_SECTORS = {"Banking", "Finance", "Insurance", "Manufacturing", "Diversified"}
STATEMENT_KEYS = ("income_statement", "balance_sheet", "cash_flow", "equity", "comprehensive_income")


FIELD_MAPPING: dict[str, dict[str, tuple[str, tuple[str, ...]]]] = {
    "Diversified": {
        "revenue": ("income_statement", (
            "revenue", "turnover", "sales", "total_revenue", "gross_income", "total_operating_income",
            "operating_income", "total_income", "gross_revenue", "revenue_from_contracts_with_customers"
        )),
        "net_profit": ("income_statement", (
            "net_profit", "profit_for_the_year", "profit_after_tax", "net_income", "profit_for_the_period",
            "profit_attributable_to_owners", "profit_after_taxation", "pat", "profit_attributable_to_equity_holders"
        )),
        "operating_profit": ("income_statement", (
            "operating_profit", "results_from_operating_activities", "operating_income", "ebit",
            "profit_from_operations", "operating_profit_before_tax", "operating_profit_after_tax"
        )),
        "profit_before_tax": ("income_statement", (
            "profit_before_tax", "profit_before_income_tax", "profit_before_taxation", "pbt"
        )),
        "tax_expense": ("income_statement", (
            "tax_expense", "income_tax_expense", "tax_expenses", "income_tax", "taxation"
        )),
        "cost_of_sales": ("income_statement", (
            "cost_of_sales", "cost_of_revenue", "cost_of_goods_sold", "cost_of_sales_and_services", "cogs"
        )),
        "gross_profit": ("income_statement", (
            "gross_profit", "gross_margin_value"
        )),
        "finance_cost": ("income_statement", (
            "finance_cost", "finance_costs", "interest_expense", "interest_expenses", "borrowing_costs"
        )),
        "eps": ("income_statement", (
            "eps", "earnings_per_share", "earnings_per_share_basic", "basic_earnings_per_share",
            "earnings_per_share_diluted_lkr", "earnings_per_share_basic_lkr"
        )),
        "total_assets": ("balance_sheet", (
            "total_assets", "assets_total", "total_assets_as_at"
        )),
        "total_liabilities": ("balance_sheet", (
            "total_liabilities", "liabilities_total", "total_liabilities_and_equity"
        )),
        "equity": ("balance_sheet", (
            "total_equity", "equity", "shareholders_equity", "total_shareholders_equity",
            "equity_attributable_to_owners", "total_equity_attributable_to_equity_holders_of_the_bank",
            "total_equity_attributable_to_equity_holders"
        )),
        "cash": ("balance_sheet", (
            "cash_and_cash_equivalents", "cash", "cash_and_equivalents", "cash_in_hand_and_at_banks",
            "cash_in_hand"
        )),
        "current_assets": ("balance_sheet", (
            "current_assets", "total_current_assets"
        )),
        "current_liabilities": ("balance_sheet", (
            "current_liabilities", "total_current_liabilities"
        )),
        "inventory": ("balance_sheet", (
            "inventory", "inventories", "stock", "stocks"
        )),
        "receivables": ("balance_sheet", (
            "receivables", "trade_receivables", "accounts_receivable", "trade_and_other_receivables",
            "loans_and_receivables_to_other_customers", "loans_and_advances_to_customers"
        )),
        "borrowings": ("balance_sheet", (
            "borrowings", "total_debt", "debt", "interest_bearing_debt", "debt_securities_issued",
            "financial_liabilities_at_amortised_cost_other_borrowed_funds", "other_borrowed_funds"
        )),
        "deposits": ("balance_sheet", (
            "deposits", "customer_deposits", "due_to_depositors", "due_to_other_customers",
            "financial_liabilities_at_amortised_cost_due_to_customers", "due_to_customers"
        )),
        "loans": ("balance_sheet", (
            "loans", "loans_and_advances", "loans_and_receivables_to_other_customers",
            "financing_and_receivables_to_other_customers", "financial_assets_at_amortised_cost_loans_and_advances_to_customers",
            "loans_and_advances_to_customers"
        )),
        "operating_cash_flow": ("cash_flow", (
            "operating_cash_flow", "net_cash_from_operating_activities", "net_cash_flow_from_operating_activities",
            "net_cash_from_used_in_operating_activities", "net_cash_generated_from_operating_activities"
        )),
        "investing_cash_flow": ("cash_flow", (
            "investing_cash_flow", "net_cash_from_investing_activities", "net_cash_used_in_investing_activities",
            "net_cash_flows_used_in_investing_activities", "net_cash_from_used_in_investing_activities"
        )),
        "financing_cash_flow": ("cash_flow", (
            "financing_cash_flow", "net_cash_from_financing_activities", "net_cash_flows_from_financing_activities",
            "net_cash_from_used_in_financing_activities"
        )),
        "net_cash_flow": ("cash_flow", (
            "net_cash_flow", "net_cash_change", "net_increase_decrease_in_cash_and_cash_equivalents",
            "net_increase_in_cash_and_cash_equivalents"
        )),
        "opening_cash": ("cash_flow", (
            "opening_cash", "cash_at_beginning", "cash_and_cash_equivalents_at_beginning_of_the_year",
            "cash_and_cash_equivalents_at_beginning"
        )),
        "closing_cash": ("cash_flow", (
            "closing_cash", "cash_at_end", "cash_and_cash_equivalents_at_end_of_the_year",
            "cash_and_cash_equivalents_at_end", "total_cash_and_cash_equivalents_at_end_of_the_year"
        )),
        "capex": ("cash_flow", (
            "capex", "capital_expenditure", "purchase_of_property_plant_equipment", "acquisition_of_property_plant_and_equipment",
            "purchase_of_property_plant_and_equipment_and_intangibles"
        )),
        "dividends_paid": ("cash_flow", (
            "dividends_paid", "dividend_paid", "dividend_paid_used_in", "dividends"
        )),
    }
}

FIELD_MAPPING["Manufacturing"] = {
    **FIELD_MAPPING["Diversified"],
    "revenue": ("income_statement", ("revenue", "turnover", "sales", "total_revenue")),
}
FIELD_MAPPING["Banking"] = {
    **FIELD_MAPPING["Diversified"],
    "revenue": ("income_statement", (
        "total_operating_income", "gross_income", "interest_income", "net_interest_income",
        "net_operating_income", "total_income", "operating_income"
    )),
    "net_profit": ("income_statement", (
        "profit_for_the_year", "net_profit", "profit_after_tax", "equity_holders_of_the_parent",
        "profit_for_the_period"
    )),
    "operating_profit": ("income_statement", (
        "results_from_operating_activities", "operating_profit", "net_operating_income",
        "profit_before_value_added_tax_vat_on_financial_services_social_security_contribution_levy_sscl",
        "profit_before_vat"
    )),
}
FIELD_MAPPING["Finance"] = {
    **FIELD_MAPPING["Banking"],
    "revenue": ("income_statement", (
        "total_operating_income", "financing_income", "gross_income", "interest_income", "net_financing_income"
    )),
}
FIELD_MAPPING["Insurance"] = {
    **FIELD_MAPPING["Diversified"],
    "revenue": ("income_statement", (
        "gross_written_premium", "net_premium_income", "insurance_revenue", "total_operating_income", "gross_income"
    )),
    "cost_of_sales": ("income_statement", (
        "claims_and_benefits", "net_claims", "benefits_claims_and_underwriting_expenditure"
    )),
}


def parse_numeric(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"-", "n/a", "na", "null", "none"}:
        return None
    negative = text.startswith("(") and text.endswith(")")
    text = text.strip("()")
    text = text.replace(",", "").replace(" ", "").replace("*", "")
    text = text.replace("\u2014", "").replace("\u2013", "")
    if not text:
        return None
    try:
        parsed = float(text)
    except ValueError:
        return None
    return -abs(parsed) if negative else parsed


def _flatten_numeric(section: Any, prefix: str = "") -> dict[str, float]:
    values: dict[str, float] = {}
    if not isinstance(section, dict):
        return values
    for key, value in section.items():
        path = f"{prefix}.{key}" if prefix else str(key)
        parsed = parse_numeric(value)
        if parsed is not None:
            values[path] = parsed
        elif isinstance(value, dict):
            values.update(_flatten_numeric(value, path))
    return values


def _get_statement(entity_payload: dict[str, Any], statement: str) -> dict[str, Any]:
    value = entity_payload.get(statement)
    return value if isinstance(value, dict) else {}


def _detect_sector(company_name: str, entity_payload: dict[str, Any]) -> str:
    text_parts = [company_name.lower()]
    for statement in STATEMENT_KEYS:
        payload = _get_statement(entity_payload, statement)
        text_parts.extend(str(k).lower() for k in payload.keys())
    blob = " ".join(text_parts)
    if any(token in blob for token in ("bank", "interest_income", "net_interest_income", "due_to_depositors", "due_to_other_customers")):
        return "Banking"
    if any(token in blob for token in ("financing_income", "finance_lease", "microfinance")):
        return "Finance"
    if any(token in blob for token in ("insurance", "premium", "claims", "underwriting")):
        return "Insurance"
    if any(token in blob for token in ("inventory", "cost_of_sales", "factory", "manufacturing")):
        return "Manufacturing"
    return "Diversified"


def _match_field(entity_payload: dict[str, Any], sector: str, standard_field: str) -> tuple[float | None, dict[str, Any] | None]:
    mapping = FIELD_MAPPING.get(sector, FIELD_MAPPING["Diversified"])
    section_name, aliases = mapping[standard_field]
    sections_to_search = [section_name] + [s for s in STATEMENT_KEYS if s != section_name]
    for statement in sections_to_search:
        section = _get_statement(entity_payload, statement)
        flattened = _flatten_numeric(section)
        # 1. Exact matches (normalized keys) first
        for alias in aliases:
            norm_alias = alias.lower().replace("_", "").replace(" ", "")
            for path, val in flattened.items():
                leaf = path.split(".")[-1]
                norm_leaf = leaf.lower().replace("_", "").replace(" ", "")
                if norm_leaf == norm_alias:
                    return val, {"statement": statement, "source_field": leaf, "source_path": f"{statement}.{path}"}
        # 2. Suffix/contains heuristic match second
        for source_path, value in flattened.items():
            leaf = source_path.split(".")[-1]
            norm_leaf = leaf.lower().replace("_", "").replace(" ", "")
            for alias in aliases:
                norm_alias = alias.lower().replace("_", "").replace(" ", "")
                if norm_alias in norm_leaf or norm_leaf in norm_alias:
                    return value, {"statement": statement, "source_field": leaf, "source_path": f"{statement}.{source_path}"}
    return None, None


def _all_numeric_paths(entity_payload: dict[str, Any]) -> set[str]:
    paths: set[str] = set()
    for statement in STATEMENT_KEYS:
        for path in _flatten_numeric(_get_statement(entity_payload, statement)).keys():
            paths.add(f"{statement}.{path}")
    return paths


def map_entity_year(entity_payload: dict[str, Any], sector: str) -> dict[str, Any]:
    standardized: dict[str, float | None] = {}
    trace: dict[str, dict[str, Any]] = {}
    used_paths: set[str] = set()
    missing: list[str] = []

    for standard_field in FIELD_MAPPING["Diversified"].keys():
        value, source = _match_field(entity_payload, sector, standard_field)
        standardized[standard_field] = value
        if source:
            trace[standard_field] = {**source, "value": value}
            used_paths.add(str(source["source_path"]))
        else:
            missing.append(standard_field)

    if standardized["equity"] is None and standardized["total_assets"] is not None and standardized["total_liabilities"] is not None:
        standardized["equity"] = standardized["total_assets"] - standardized["total_liabilities"]
        trace["equity"] = {"statement": "derived", "source_field": "total_assets-total_liabilities", "source_path": "derived.equity", "value": standardized["equity"]}

    if standardized["total_liabilities"] is None and standardized["total_assets"] is not None and standardized["equity"] is not None:
        standardized["total_liabilities"] = standardized["total_assets"] - standardized["equity"]
        trace["total_liabilities"] = {"statement": "derived", "source_field": "total_assets-equity", "source_path": "derived.total_liabilities", "value": standardized["total_liabilities"]}

    if standardized["cash"] is None and standardized["closing_cash"] is not None:
        standardized["cash"] = standardized["closing_cash"]
        trace["cash"] = {"statement": "cash_flow", "source_field": "closing_cash", "source_path": "cash_flow.closing_cash", "value": standardized["cash"]}

    if standardized["net_cash_flow"] is None:
        cash_parts = [standardized["operating_cash_flow"], standardized["investing_cash_flow"], standardized["financing_cash_flow"]]
        if all(v is not None for v in cash_parts):
            standardized["net_cash_flow"] = float(sum(cash_parts))
            trace["net_cash_flow"] = {"statement": "derived", "source_field": "operating+investing+financing", "source_path": "derived.net_cash_flow", "value": standardized["net_cash_flow"]}

    unmapped = []
    for path in sorted(_all_numeric_paths(entity_payload) - used_paths):
        unmapped.append({
            "field": path.split(".")[-1],
            "source_path": path,
            "exists_in_normalized": True,
            "used_in_analysis": False,
            "reason": "No analysis field mapping consumed this normalized value",
        })

    return {"standardized": standardized, "trace": trace, "missing_fields": missing, "unmapped_normalized_values": unmapped}


def _ratio(numerator: float | None, denominator: float | None, source_fields: list[str], sector: str, calculation: str, year: Any = None, applicable: bool = True) -> dict[str, Any]:
    if not applicable:
        return {"status": "NOT_APPLICABLE", "reason": f"Metric not applicable to {sector} sector", "source_fields": source_fields}
    missing = [field for field, value in zip(source_fields, (numerator, denominator)) if value is None]
    if missing:
        return {
            "status": "FAILED",
            "reason": f"Required field missing after mapping: {', '.join(missing)}",
            "missing_fields": missing,
            "calculation": calculation,
            "year": int(year) if year and str(year).isdigit() else year,
            "source_fields": source_fields
        }
    if denominator == 0:
        return {
            "status": "FAILED",
            "reason": "Denominator is zero",
            "calculation": calculation,
            "year": int(year) if year and str(year).isdigit() else year,
            "source_fields": source_fields
        }
    return {"status": "OK", "value": round(float(numerator) / float(denominator), 6), "source_fields": source_fields}


def _difference(a: float | None, b: float | None, source_fields: list[str], calculation: str, year: Any = None) -> dict[str, Any]:
    missing = [field for field, value in zip(source_fields, (a, b)) if value is None]
    if missing:
        return {
            "status": "FAILED",
            "reason": f"Required field missing after mapping: {', '.join(missing)}",
            "missing_fields": missing,
            "calculation": calculation,
            "year": int(year) if year and str(year).isdigit() else year,
            "source_fields": source_fields
        }
    return {"status": "OK", "value": round(float(a) - abs(float(b)), 3), "source_fields": source_fields}


def _growth(current: float | None, previous: float | None, source_fields: list[str], calculation: str, year: Any = None) -> dict[str, Any]:
    if previous is None or current is None:
        missing = []
        if current is None:
            missing.append(source_fields[0])
        if previous is None:
            missing.append(source_fields[1])
        return {
            "status": "FAILED",
            "reason": f"Required field missing for growth: {', '.join(missing)}",
            "missing_fields": missing,
            "calculation": calculation,
            "year": int(year) if year and str(year).isdigit() else year,
            "source_fields": source_fields
        }
    if previous == 0:
        return {
            "status": "FAILED",
            "reason": "Previous period denominator is zero",
            "calculation": calculation,
            "year": int(year) if year and str(year).isdigit() else year,
            "source_fields": source_fields
        }
    return {"status": "OK", "value": round((float(current) - float(previous)) / abs(float(previous)), 6), "source_fields": source_fields}


def _completeness(entity_payload: dict[str, Any], mapped: dict[str, Any]) -> dict[str, Any]:
    present_statements = [s for s in STATEMENT_KEYS if _get_statement(entity_payload, s)]
    required_fields = ("revenue", "net_profit", "total_assets", "total_liabilities", "equity", "cash")
    present_fields = [field for field in required_fields if mapped["standardized"].get(field) is not None]
    total = len(STATEMENT_KEYS) + len(required_fields)
    score = ((len(present_statements) + len(present_fields)) / total) * 100.0
    return {
        "completeness_score": round(score, 2),
        "present_statements": present_statements,
        "missing_statements": [s for s in STATEMENT_KEYS if s not in present_statements],
        "missing_fields": [field for field in required_fields if field not in present_fields],
    }


def _validation(v: dict[str, float | None], prev: dict[str, float | None] | None, completeness: dict[str, Any]) -> dict[str, Any]:
    checks: dict[str, Any] = {}
    assets, liabilities, equity = v.get("total_assets"), v.get("total_liabilities"), v.get("equity")
    if None not in (assets, liabilities, equity):
        diff = abs(float(assets) - (float(liabilities) + float(equity))) / max(abs(float(assets)), 1.0)
        checks["balance_sheet_identity"] = {"status": "PASS" if diff <= 0.05 else "FAILED", "difference": round(diff, 6), "source_fields": ["total_assets", "total_liabilities", "equity"]}
    else:
        missing = [name for name, value in (("total_assets", assets), ("total_liabilities", liabilities), ("equity", equity)) if value is None]
        checks["balance_sheet_identity"] = {"status": "FAILED", "reason": "Required field missing after mapping", "missing_fields": missing}

    opening, movement, closing = v.get("opening_cash"), v.get("net_cash_flow"), v.get("closing_cash")
    if None not in (opening, movement, closing):
        diff = abs((float(opening) + float(movement)) - float(closing)) / max(abs(float(closing)), 1.0)
        checks["cash_flow_reconciliation"] = {"status": "PASS" if diff <= 0.10 else "FAILED", "difference": round(diff, 6), "source_fields": ["opening_cash", "net_cash_flow", "closing_cash"]}
    else:
        missing = [name for name, value in (("opening_cash", opening), ("net_cash_flow", movement), ("closing_cash", closing)) if value is None]
        checks["cash_flow_reconciliation"] = {"status": "FAILED", "reason": "Required field missing after mapping", "missing_fields": missing}

    if prev:
        jumps = []
        for field in ("revenue", "total_assets", "equity"):
            current, previous = v.get(field), prev.get(field)
            if current is not None and previous not in (None, 0):
                change = abs((float(current) - float(previous)) / float(previous))
                if change > 3.0:
                    jumps.append({"field": field, "change": round(change, 6)})
        checks["multi_year_continuity"] = {"status": "FAILED" if jumps else "PASS", "jumps": jumps}
    else:
        checks["multi_year_continuity"] = {"status": "NOT_APPLICABLE", "reason": "First period has no previous year"}

    checks["completeness_validation"] = {
        "status": "PASS" if completeness["completeness_score"] >= 60 else "FAILED",
        **completeness,
    }
    invalid_numeric = [field for field, value in v.items() if value is not None and not isinstance(value, (int, float))]
    checks["numeric_integrity"] = {"status": "PASS" if not invalid_numeric else "FAILED", "invalid_fields": invalid_numeric}
    return checks


def _sector_ratios(v: dict[str, float | None], sector: str, year: Any = None) -> dict[str, Any]:
    manufacturing_like = sector in {"Manufacturing", "Diversified", "Insurance"}
    quick_assets = None
    if v.get("current_assets") is not None and v.get("inventory") is not None:
        quick_assets = v["current_assets"] - v["inventory"]
    capex = v.get("capex")
    if capex is None and v.get("investing_cash_flow") is not None and v["investing_cash_flow"] < 0:
        capex = abs(v["investing_cash_flow"])

    return {
        "ROA": _ratio(v.get("net_profit"), v.get("total_assets"), ["net_profit", "total_assets"], sector, "ROA = net_profit / total_assets", year),
        "ROE": _ratio(v.get("net_profit"), v.get("equity"), ["net_profit", "equity"], sector, "ROE = net_profit / equity", year),
        "Debt To Equity": _ratio(v.get("total_liabilities"), v.get("equity"), ["total_liabilities", "equity"], sector, "Debt To Equity = total_liabilities / equity", year),
        "Debt Ratio": _ratio(v.get("total_liabilities"), v.get("total_assets"), ["total_liabilities", "total_assets"], sector, "Debt Ratio = total_liabilities / total_assets", year),
        "Net Profit Margin": _ratio(v.get("net_profit"), v.get("revenue"), ["net_profit", "revenue"], sector, "Net Profit Margin = net_profit / revenue", year),
        "Operating Margin": _ratio(v.get("operating_profit"), v.get("revenue"), ["operating_profit", "revenue"], sector, "Operating Margin = operating_profit / revenue", year),
        "Gross Margin": _ratio(v.get("gross_profit"), v.get("revenue"), ["gross_profit", "revenue"], sector, "Gross Margin = gross_profit / revenue", year, applicable=manufacturing_like),
        "Current Ratio": _ratio(v.get("current_assets"), v.get("current_liabilities"), ["current_assets", "current_liabilities"], sector, "Current Ratio = current_assets / current_liabilities", year, applicable=manufacturing_like),
        "Quick Ratio": _ratio(quick_assets, v.get("current_liabilities"), ["current_assets", "inventory", "current_liabilities"], sector, "Quick Ratio = (current_assets - inventory) / current_liabilities", year, applicable=manufacturing_like),
        "Cash Ratio": _ratio(v.get("cash"), v.get("current_liabilities"), ["cash", "current_liabilities"], sector, "Cash Ratio = cash / current_liabilities", year, applicable=manufacturing_like),
        "Asset Turnover": _ratio(v.get("revenue"), v.get("total_assets"), ["revenue", "total_assets"], sector, "Asset Turnover = revenue / total_assets", year),
        "Cash Flow to Net Income": _ratio(v.get("operating_cash_flow"), v.get("net_profit"), ["operating_cash_flow", "net_profit"], sector, "Cash Flow to Net Income = operating_cash_flow / net_profit", year),
        "OCF Ratio": _ratio(v.get("operating_cash_flow"), v.get("current_liabilities"), ["operating_cash_flow", "current_liabilities"], sector, "OCF Ratio = operating_cash_flow / current_liabilities", year, applicable=manufacturing_like),
        "Free Cash Flow": _difference(v.get("operating_cash_flow"), capex, ["operating_cash_flow", "capex"], "Free Cash Flow = operating_cash_flow - capex", year),
        "Loan To Deposit Ratio": _ratio(v.get("loans"), v.get("deposits"), ["loans", "deposits"], sector, "Loan To Deposit Ratio = loans / deposits", year, applicable=sector in {"Banking", "Finance"}),
    }


def _scores(years: dict[str, Any]) -> dict[str, Any]:
    ratio_items = [ratio for payload in years.values() for ratio in payload["ratio_analysis"].values()]
    ok_ratios = [ratio for ratio in ratio_items if ratio.get("status") == "OK"]
    attempted_ratios = [ratio for ratio in ratio_items if ratio.get("status") != "NOT_APPLICABLE"]
    validations = [check for payload in years.values() for check in payload["validation_results"].values()]
    passed_validations = [check for check in validations if check.get("status") in {"PASS", "NOT_APPLICABLE"}]
    completeness = [payload["completeness_metrics"]["completeness_score"] for payload in years.values()]
    mapping_rates = [payload["mapping_success_rate"] for payload in years.values()]
    extraction_conf = [payload.get("extraction_confidence", 0.0) for payload in years.values()]

    ratio_coverage = len(ok_ratios) / max(len(attempted_ratios), 1)
    validation_score = len(passed_validations) / max(len(validations), 1)
    completeness_score = (sum(completeness) / max(len(completeness), 1)) / 100.0
    mapping_success = sum(mapping_rates) / max(len(mapping_rates), 1)
    extraction_score = min((sum(extraction_conf) / max(len(extraction_conf), 1)) / 100.0, 1.0)
    confidence = (
        extraction_score * 0.20
        + completeness_score * 0.25
        + validation_score * 0.20
        + mapping_success * 0.20
        + ratio_coverage * 0.15
    )
    reliability = min(100.0, confidence * 100.0)
    risk = max(0.0, 100.0 - reliability)
    return {
        "confidence_score": round(confidence, 4),
        "reliability_score": round(reliability, 2),
        "risk_score": round(risk, 2),
        "ratio_coverage": round(ratio_coverage, 4),
        "validation_score": round(validation_score, 4),
        "mapping_success_rate": round(mapping_success, 4),
        "completeness_score": round(completeness_score * 100.0, 2),
        "risk_level": "low" if risk < 33 else "medium" if risk < 66 else "high",
        "reliability_band": "high" if reliability >= 80 else "medium" if reliability >= 60 else "low",
    }


def analyze_normalized_results(normalized_results: Any) -> dict[str, Any]:
    records = normalized_results if isinstance(normalized_results, list) else [normalized_results]
    entity_years: dict[str, dict[str, Any]] = defaultdict(dict)
    diagnostics: list[dict[str, Any]] = []
    metadata = {"record_count": len(records), "source": "normalized_results.json", "companies": []}

    for record in records:
        if not isinstance(record, dict):
            continue
        company_name = str(record.get("company") or record.get("company_name") or "Unknown")
        metadata["companies"].append(company_name)
        financials = record.get("financials") if isinstance(record.get("financials"), dict) else {}
        for year, year_payload in financials.items():
            if not str(year).isdigit() or not isinstance(year_payload, dict):
                continue
            for entity_name, entity_payload in year_payload.items():
                if entity_name not in {"bank", "group", "company", "entity", "parent", "standalone"}:
                    continue
                if not isinstance(entity_payload, dict):
                    continue
                sector = _detect_sector(company_name, entity_payload)
                mapped = map_entity_year(entity_payload, sector)
                completeness = _completeness(entity_payload, mapped)
                extraction_confidence = parse_numeric(entity_payload.get("extraction_confidence")) or parse_numeric(year_payload.get("extraction_confidence")) or 0.0
                mapped_count = len([v for v in mapped["standardized"].values() if v is not None])
                mapping_success_rate = mapped_count / max(len(FIELD_MAPPING["Diversified"]), 1)
                entity_years[entity_name][str(year)] = {
                    "sector": sector,
                    "standardized_fields": mapped["standardized"],
                    "field_traceability": mapped["trace"],
                    "completeness_metrics": completeness,
                    "mapping_success_rate": round(mapping_success_rate, 4),
                    "extraction_confidence": extraction_confidence,
                    "mapping_missing_fields": mapped["missing_fields"],
                    "diagnostics": mapped["unmapped_normalized_values"],
                }
                for item in mapped["unmapped_normalized_values"]:
                    diagnostics.append({"year": int(year), "entity": entity_name, **item})

    analyses: dict[str, Any] = {}
    for entity_name, years in entity_years.items():
        prev_fields = None
        for year in sorted(years.keys(), key=int):
            fields = years[year]["standardized_fields"]
            years[year]["ratio_analysis"] = _sector_ratios(fields, years[year]["sector"], year)
            years[year]["growth_analysis"] = {
                "Revenue Growth": _growth(fields.get("revenue"), prev_fields.get("revenue") if prev_fields else None, ["revenue", "previous_revenue"], "Revenue Growth = (revenue - previous_revenue) / previous_revenue", year),
                "Net Profit Growth": _growth(fields.get("net_profit"), prev_fields.get("net_profit") if prev_fields else None, ["net_profit", "previous_net_profit"], "Net Profit Growth = (net_profit - previous_net_profit) / previous_net_profit", year),
                "Asset Growth": _growth(fields.get("total_assets"), prev_fields.get("total_assets") if prev_fields else None, ["total_assets", "previous_total_assets"], "Asset Growth = (total_assets - previous_total_assets) / previous_total_assets", year),
                "Equity Growth": _growth(fields.get("equity"), prev_fields.get("equity") if prev_fields else None, ["equity", "previous_equity"], "Equity Growth = (equity - previous_equity) / previous_equity", year),
            }
            years[year]["validation_results"] = _validation(fields, prev_fields, years[year]["completeness_metrics"])
            prev_fields = fields
        analyses[f"{entity_name}_analysis"] = {"years": years, "scores": _scores(years)}

    completeness_metrics = {
        entity_key.replace("_analysis", ""): {
            year: payload.get("completeness_metrics", {})
            for year, payload in analysis.get("years", {}).items()
        }
        for entity_key, analysis in analyses.items()
    }
    ratio_analysis = {
        entity_key.replace("_analysis", ""): {
            year: payload.get("ratio_analysis", {})
            for year, payload in analysis.get("years", {}).items()
        }
        for entity_key, analysis in analyses.items()
    }
    growth_analysis = {
        entity_key.replace("_analysis", ""): {
            year: payload.get("growth_analysis", {})
            for year, payload in analysis.get("years", {}).items()
        }
        for entity_key, analysis in analyses.items()
    }
    validation_results = {
        entity_key.replace("_analysis", ""): {
            year: payload.get("validation_results", {})
            for year, payload in analysis.get("years", {}).items()
        }
        for entity_key, analysis in analyses.items()
    }
    confidence_scores = {entity_key.replace("_analysis", ""): analysis.get("scores", {}).get("confidence_score") for entity_key, analysis in analyses.items()}
    reliability_scores = {entity_key.replace("_analysis", ""): analysis.get("scores", {}).get("reliability_score") for entity_key, analysis in analyses.items()}
    risk_scores = {entity_key.replace("_analysis", ""): analysis.get("scores", {}).get("risk_score") for entity_key, analysis in analyses.items()}

    return {
        "status": "COMPLETED" if analyses else "VALIDATION_FAILED",
        "normalized_dataset_metadata": metadata,
        "completeness_metrics": completeness_metrics,
        "sector_classification": {entity: {year: payload["sector"] for year, payload in years.items()} for entity, years in entity_years.items()},
        "ratio_analysis": ratio_analysis,
        "growth_analysis": growth_analysis,
        "validation_results": validation_results,
        "confidence_scores": confidence_scores,
        "reliability_scores": reliability_scores,
        "risk_scores": risk_scores,
        "diagnostics": diagnostics,
        **analyses,
    }


def normalized_analysis_to_legacy(normalized_analysis: dict[str, Any], preferred_entity: str | None = None) -> dict[str, Any]:
    analysis_keys = [key for key in normalized_analysis.keys() if key.endswith("_analysis")]
    if not analysis_keys:
        return normalized_analysis
    preferred_key = f"{preferred_entity}_analysis" if preferred_entity else None
    selected_key = preferred_key if preferred_key in normalized_analysis else ("group_analysis" if "group_analysis" in normalized_analysis else analysis_keys[0])
    selected = normalized_analysis[selected_key]
    years = selected.get("years", {})
    yearly_ratios = {year: payload.get("ratio_analysis", {}) for year, payload in years.items()}
    growth_metrics = {year: payload.get("growth_analysis", {}) for year, payload in years.items()}
    validation_gates = {year: payload.get("validation_results", {}) for year, payload in years.items()}
    scores = selected.get("scores", {})
    return {
        **normalized_analysis,
        "yearly_ratios": yearly_ratios,
        "growth_metrics": growth_metrics,
        "validation_gates": validation_gates,
        "sector_adjustments": normalized_analysis.get("sector_classification", {}),
        "evaluated_equations_by_year": {
            year: {name: ratio.get("source_fields", []) for name, ratio in ratios.items()}
            for year, ratios in yearly_ratios.items()
        },
        "scores": scores,
        "valid_years": sorted(years.keys(), key=int),
        "rejected_years": [],
    }
