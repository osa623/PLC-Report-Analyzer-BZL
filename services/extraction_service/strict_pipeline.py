from __future__ import annotations

import re
import logging
from collections import defaultdict
from typing import Any


_YEAR_ENTITY_RE = re.compile(
    r"^(?P<year>\d{4})\s*\((?P<entity>Group|Bank|Company|Entity|Parent|Standalone)\)$",
    re.IGNORECASE,
)

_SECTION_ALIASES = {
    "cashflow_statement": "cash_flow",
    "cash_flow_statement": "cash_flow",
    "cashflow": "cash_flow",
    "income": "income_statement",
    "statement_of_income": "income_statement",
    "profit_or_loss": "income_statement",
    "profit_and_loss": "income_statement",
    "statement_of_profit_or_loss": "income_statement",
    "statement_of_profit_and_loss": "income_statement",
    "statement_of_profit_or_loss_and_other_comprehensive_income": "income_statement",
    "balance": "balance_sheet",
}

_INCOME_FALLBACK_SECTION_KEYS = (
    "profit_or_loss",
    "statement_of_profit_or_loss",
    "statement_of_profit_and_loss",
    "statement_of_profit_or_loss_and_other_comprehensive_income",
    "statement_of_profit_loss_and_other_comprehensive_income",
    "statement_of_profit_and_loss_and_other_comprehensive_income",
    "statement_of_comprehensive_income",
    "statement_of_other_comprehensive_income",
    "comprehensive_income",
    "other_comprehensive_income",
)

_ENTITY_PRIORITY = ("Group", "Consolidated", "Bank", "Company", "Entity", "Parent", "Standalone")

_DIRECT_FIELD_ALIASES = {
    "balance_sheet": {
        "cash_and_equivalents": "cash_and_cash_equivalents",
        "borrowings": "total_debt",
    },
    "income_statement": {
        "cost_of_revenue": "cost_of_sales",
    },
    "cash_flow": {
        "cashflow": "cash_flow",
        "net_cash_change": "net_cash_flow",
    },
}


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _slugify_company_name(pdf_name: str | None) -> str:
    if not pdf_name:
        return "Unknown Company"
    base = re.sub(r"\.(pdf|json)$", "", pdf_name, flags=re.IGNORECASE)
    base = re.sub(r"[_\-]+", " ", base).strip()
    return base or "Unknown Company"


def _parse_number(value: Any) -> float | None:
    if _is_number(value):
        return float(value)
    if value is None:
        return None
    text = str(value).strip()
    if not text or text in {"-", "—", "–", "N/A", "NA", "n/a"}:
        return None
    text = text.replace("*", "")
    negative = text.startswith("(") and text.endswith(")")
    text = text.strip("()")
    text = text.replace(" ", "")
    if "." in text and "," not in text:
        dot_parts = [part for part in text.split(".") if part != ""]
        if len(dot_parts) > 1 and all(part.isdigit() for part in dot_parts):
            if all(len(part) == 3 for part in dot_parts[1:]):
                text = "".join(dot_parts)
    text = text.replace(",", "")
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    if negative:
        number = -abs(number)
    return number


def _row_label(row: dict[str, Any]) -> str:
    for key in ("label", "row_header", "description", "Note", "name", "title"):
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    for key, value in row.items():
        if isinstance(key, str) and key and not key.startswith("_") and not _YEAR_ENTITY_RE.match(key):
            if isinstance(value, str) and value.strip():
                return key.strip()
    return ""


def _currency_hint(payload: dict[str, Any]) -> str:
    for key in ("currency", "unit_scale", "unit_multiplier", "parse_meta"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value
        if key == "parse_meta" and isinstance(value, dict):
            for nested_key in ("currency", "unit_scale", "unit"):
                nested_value = value.get(nested_key)
                if isinstance(nested_value, str) and nested_value.strip():
                    return nested_value
    return ""


def _detect_multiplier(currency_hint: str) -> float:
    hint = currency_hint.lower()
    if "bn" in hint or "billion" in hint:
        return 1_000_000_000.0
    elif "mn" in hint or "million" in hint or "mln" in hint:
        return 1_000_000.0
    elif "000" in hint or "thousand" in hint or "k" in hint:
        return 1000.0
    return 1.0


def _normalize_value(value: Any, currency_hint: str) -> float | None:
    number = _parse_number(value)
    if number is None:
        return None
    multiplier = _detect_multiplier(currency_hint)
    result = number * multiplier
    # For large financial figures, round to integer to avoid ambiguous decimals
    # (e.g. 145.401 could be misread as 145,401 in some locales).
    # Keep decimals only for per-share / ratio-scale values (abs < 100).
    if abs(result) >= 100:
        return round(result, 0)
    return round(result, 3)


def _section_rows(statement_payload: Any) -> list[dict[str, Any]]:
    if isinstance(statement_payload, list):
        return [row for row in statement_payload if isinstance(row, dict)]
    if not isinstance(statement_payload, dict):
        return []

    for key in ("financial_data", "rows", "table", "data_rows", "data"):
        rows = statement_payload.get(key)
        if isinstance(rows, list) and rows:
            return [row for row in rows if isinstance(row, dict)]

    segments = statement_payload.get("segments")
    if isinstance(segments, list):
        rows: list[dict[str, Any]] = []
        for segment in segments:
            if not isinstance(segment, dict):
                continue
            segment_rows = segment.get("rows")
            if isinstance(segment_rows, list):
                rows.extend(row for row in segment_rows if isinstance(row, dict))
        return rows

    tables = statement_payload.get("tables")
    if isinstance(tables, list):
        rows: list[dict[str, Any]] = []
        for table in tables:
            if not isinstance(table, dict):
                continue
            table_rows = table.get("rows")
            if not isinstance(table_rows, list):
                table_rows = table.get("data")
            if isinstance(table_rows, list):
                rows.extend(row for row in table_rows if isinstance(row, dict))
        return rows

    sections = statement_payload.get("sections")
    if isinstance(sections, list):
        rows: list[dict[str, Any]] = []
        for section in sections:
            if not isinstance(section, dict):
                continue
            section_rows = section.get("rows")
            if isinstance(section_rows, list):
                rows.extend(row for row in section_rows if isinstance(row, dict))
        return rows

    nested_rows: list[dict[str, Any]] = []
    for value in statement_payload.values():
        if isinstance(value, list):
            nested_rows.extend(row for row in value if isinstance(row, dict))
    if nested_rows:
        return nested_rows

    return []


def _normalize_section_key(key: Any) -> str:
    text = str(key or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return _SECTION_ALIASES.get(text, text)


def _is_income_fallback_key(key: Any) -> bool:
    normalized_key = _normalize_section_key(key)
    if normalized_key in _INCOME_FALLBACK_SECTION_KEYS:
        return True

    text = re.sub(r"\s+", " ", str(key or "").lower()).strip()
    if not text:
        return False

    has_statement = "statement" in text
    has_profit_loss = "profit or loss" in text or "profit and loss" in text
    has_comprehensive_income = (
        "comprehensive income" in text
        or "comprohensive income" in text
        or "other comprehensive income" in text
        or "other comprohensive income" in text
    )
    return has_statement and (has_profit_loss or has_comprehensive_income)


def _section_has_data(payload: Any) -> bool:
    if isinstance(payload, list):
        return any(isinstance(row, dict) and row for row in payload)
    if not isinstance(payload, dict):
        return False
    if _section_rows(payload):
        return True
    return any(_parse_number(value) is not None for value in payload.values())


def _find_statement_payload(container: dict[str, Any], statement_key: str) -> Any:
    direct = container.get(statement_key)
    if _section_has_data(direct):
        return direct

    for possible_key, value in container.items():
        if _normalize_section_key(possible_key) == statement_key and _section_has_data(value):
            return value

    if statement_key != "income_statement":
        return direct

    for possible_key, value in container.items():
        if _is_income_fallback_key(possible_key) and _section_has_data(value):
            logging.info(
                "Using %s as income_statement fallback because income_statement was empty.",
                possible_key,
            )
            return value

    return direct


def _collect_all_rows(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    all_rows = []
    accepted_sections = {
        "income_statement",
        "profit_or_loss",
        "balance_sheet",
        "cash_flow",
        "comprehensive_income",
        *_INCOME_FALLBACK_SECTION_KEYS,
    }
    for record in records:
        statements = record.get("statements")
        if isinstance(statements, dict):
            for statement_key, payload in statements.items():
                normalized_key = _normalize_section_key(statement_key)
                if normalized_key not in accepted_sections and not _is_income_fallback_key(statement_key):
                    continue
                if payload:
                    all_rows.extend(_section_rows(payload))
        
        strict = record.get("strict_statements")
        if isinstance(strict, dict):
            for statement_key, payload in strict.items():
                normalized_key = _normalize_section_key(statement_key)
                if normalized_key not in accepted_sections and not _is_income_fallback_key(statement_key):
                    continue
                if payload:
                    all_rows.extend(_section_rows(payload))
    return all_rows


def _detect_master_years(rows: list[dict[str, Any]]) -> list[str]:
    years_set = set()
    for row in rows:
        for key in row.keys():
            if not isinstance(key, str):
                continue
            match = _YEAR_ENTITY_RE.match(key.strip())
            if match:
                years_set.add(match.group("year"))
                
    if not years_set:
        logging.warning("Zero financial years detected in statement columns.")
        return []
        
    sorted_years = sorted(list(years_set), reverse=True)
    
    if len(sorted_years) < 2:
        logging.warning(f"Detected fewer than 2 financial years: {sorted_years}")
        
    logging.info(
        "Detected financial years from statement columns: %s. Using Group columns when available, "
        "then Bank/Company-style standalone columns as same-year fallback.",
        sorted_years,
    )
    return sorted_years


def _get_year_value(row: dict[str, Any], year: str, currency_hint: str) -> float | None:
    matched_values: dict[str, float] = {}

    for key, value in row.items():
        if not isinstance(key, str):
            continue
        match = _YEAR_ENTITY_RE.match(key.strip())
        if not match or match.group("year") != year:
            continue
        parsed = _normalize_value(value, currency_hint)
        if parsed is None:
            continue
        entity = match.group("entity").title()
        matched_values[entity] = parsed

    for entity in _ENTITY_PRIORITY:
        if entity in matched_values:
            return matched_values[entity]

    return None


def _normalize_direct_field(section_name: str, field_name: str) -> str:
    aliases = _DIRECT_FIELD_ALIASES.get(section_name, {})
    return aliases.get(field_name, field_name)


def _field_map(statement_key: str, label: str) -> str | None:
    normalized = re.sub(r"\s+", " ", label.lower()).strip().rstrip(":")

    if statement_key == "income_statement":
        mapping = [
            ("gross income", "revenue"),
            ("financing income", "revenue"),
            ("financing expenses", "interest_expense"),
            ("interest income", "interest_income"),
            ("net interest income", "net_interest_income"),
            ("less: interest expenses", "interest_expense"),
            ("fee and commission income", "fee_and_commission_income"),
            ("less: fee and commission expenses", "fee_and_commission_expenses"),
            ("net fee and commission income", "net_fee_and_commission_income"),
            ("net interest, fee and commission income", "net_interest_fee_and_commission_income"),
            ("net gains / (losses) from trading", "trading_gain_loss"),
            ("net gain from financial investments at fair value through other comprehensive income", "fair_value_fvoci_gain"),
            ("net insurance premium income", "net_insurance_premium_income"),
            ("net gains arising on de-recognition of financial assets", "derecognition_gain"),
            ("net other operating income", "other_operating_income"),
            ("total operating income", "total_operating_income"),
            ("less: impairment charge for loans and other losses", "impairment_charge"),
            ("net operating income", "net_operating_income"),
            ("personnel expenses", "personnel_expenses"),
            ("benefits, claims and underwriting expenditure", "benefits_claims_and_underwriting_expenditure"),
            ("other expenses", "other_expenses"),
            ("total operating expenses", "total_operating_expenses"),
            ("operating profit before taxes on financial services", "operating_profit_before_tax"),
            ("less: taxes on financial services", "taxes_on_financial_services"),
            ("operating profit after taxes on financial services", "operating_profit"),
            ("share of profit of joint venture (net of income tax)", "share_of_profit_joint_venture"),
            ("profit before income tax", "profit_before_tax"),
            ("less: income tax expense", "income_tax_expense"),
            ("profit for the year", "net_profit"),
            ("equity holders of the bank", "profit_attributable_to_equity_holders"),
            ("non-controlling interests", "non_controlling_interests"),
            ("basic earnings per ordinary share (rs)", "basic_earnings_per_share"),
            ("diluted earnings per ordinary share (rs)", "diluted_earnings_per_share"),
            ("dividend per share: gross (rs)", "dividend_per_share"),
        ]
    elif statement_key == "balance_sheet":
        mapping = [
            ("cash and cash equivalents", "cash_and_cash_equivalents"),
            ("placements with banks", "placements_with_banks"),
            ("balances with central bank of sri lanka", "balances_with_central_bank"),
            ("reverse repurchase agreements", "reverse_repurchase_agreements"),
            ("derivative financial instruments", "derivative_financial_instruments"),
            ("financial assets measured at fair value through profit or loss", "financial_assets_fvtpl"),
            ("financial assets measured at amortised cost - loans and advances to customers", "loans_and_advances_to_customers"),
            ("financial assets measured at amortised cost - debt and other financial instruments", "debt_and_other_financial_instruments"),
            ("financial assets measured at fair value through other comprehensive income", "financial_assets_fvoci"),
            ("investment in joint venture", "investment_in_joint_venture"),
            ("investment in subsidiaries", "investment_in_subsidiaries"),
            ("investment properties", "investment_properties"),
            ("property, plant and equipment", "property_plant_and_equipment"),
            ("right-of-use assets", "right_of_use_assets"),
            ("intangible assets and goodwill", "intangible_assets_and_goodwill"),
            ("deferred tax assets", "deferred_tax_assets"),
            ("other assets", "other_assets"),
            ("due to banks", "due_to_banks"),
            ("securities sold under repurchase agreements", "securities_sold_under_repurchase_agreements"),
            ("financial liabilities measured at amortised cost - due to depositors", "due_to_depositors"),
            ("financial liabilities measured at amortised cost - other borrowings", "other_borrowings"),
            ("debt securities issued", "debt_securities_issued"),
            ("current tax liabilities", "current_tax_liabilities"),
            ("deferred tax liabilities", "deferred_tax_liabilities"),
            ("insurance provision - life", "insurance_provision_life"),
            ("insurance provision - non-life", "insurance_provision_non_life"),
            ("other provisions", "other_provisions"),
            ("other liabilities", "other_liabilities"),
            ("subordinated term debts", "subordinated_term_debts"),
            ("total assets", "current_assets"),
            ("total liabilities", "current_liabilities"),
            ("total assets", "total_assets"),
            ("total liabilities", "total_liabilities"),
            ("total equity", "total_equity"),
            ("inventory", "inventory"),
            ("inventories", "inventory"),
            ("ordinary shares", "shares_outstanding"),
            ("market price", "market_price"),
            ("market value", "market_price"),
            ("financial_assets_measured_at_amortised_cost_loans_and_advances_to_customers","Receivables")
        ]
    else:
        mapping = [
            ("interest receipts", "interest_receipts"),
            ("interest payments", "interest_payments"),
            ("net commission receipts", "net_commission_receipts"),
            ("net trading income", "net_trading_income"),
            ("payments to employees", "payments_to_employees"),
            ("taxes on financial services", "taxes_on_financial_services"),
            ("receipts from other operating activities", "receipts_from_other_operating_activities"),
            ("payments for other operating activities", "payments_for_other_operating_activities"),
            ("operating profit before changes in operating assets and liabilities", "operating_profit_before_changes_in_operating_assets_and_liabilities"),
            ("balances with central bank of sri lanka", "balances_with_central_bank"),
            ("financial assets measured at amortised cost - loans and advances to customers", "loans_and_advances_to_customers"),
            ("reverse repurchase agreements", "reverse_repurchase_agreements"),
            ("other assets", "other_assets"),
            ("increase/(decrease) in operating liabilities", "increase_decrease_in_operating_liabilities"),
            ("financial liabilities measured at amortised cost - due to depositors", "due_to_depositors"),
            ("financial liabilities measured at amortised cost - other borrowings", "other_borrowings"),
            ("securities sold under repurchase agreements", "securities_sold_under_repurchase_agreements"),
            ("other liabilities", "other_liabilities"),
            ("net cash (used in)/generated from operating activities before income tax", "net_operating_cash_before_tax"),
            ("income and surcharge tax paid", "income_and_surcharge_tax_paid"),
            ("net cash (used in)/generated from operating activities", "operating_cash_flow"),
            ("purchase of property, plant and equipment", "purchase_property_plant_and_equipment"),
            ("proceeds from the sale of property, plant and equipment", "ppe_sale_proceeds"),
            ("net proceeds from sale, maturity and purchase of financial investments", "net_investment_cash_flow"),
            ("net purchase of intangible assets", "net_purchase_intangible_assets"),
            ("net cash effect on acquisition of subsidiary through hnb finance plc", "acquisition_cash_effect"),
            ("dividends received from investment in subsidiaries", "dividends_from_subsidiaries"),
            ("dividends received from other investments", "dividends_from_other_investments"),
            ("opening cash", "opening_cash"),
            ("closing cash", "closing_cash"),
            ("net cash flow", "net_cash_flow"),
            ("net cash change", "net_cash_change"),
            ("investing cash flow", "investing_cash_flow"),
            ("financing cash flow", "financing_cash_flow"),
            ("dividends paid", "dividends_paid"),
            ("dividend paid", "dividends_paid"),
            ("net_cash_used_in_generated_from_operating_activities","operating Cash Flow")
        ]

    for needle, canonical in mapping:
        if needle in normalized:
            return canonical
    return None


def _field_count(year_payload: dict[str, Any]) -> int:
    count = 0
    for section_name in ("income_statement", "balance_sheet", "cash_flow"):
        section = year_payload.get(section_name)
        if isinstance(section, dict):
            count += sum(1 for value in section.values() if value is not None)
    return count


def _build_from_financials_format(
    financials: dict[str, Any],
    company_name: str | None,
) -> dict[str, Any]:
    """
    Directly build strict extraction dataset from the structured financials format.
    """
    by_year: dict[str, dict[str, Any]] = {}
    master_years = []
    
    for k in financials.keys():
        if isinstance(k, str) and re.match(r"^\d{4}$", k):
            master_years.append(k)
            
    master_years = sorted(master_years, key=int)
    
    for year in master_years:
        by_year[year] = {
            "income_statement": {},
            "balance_sheet": {},
            "cash_flow": {}
        }
        
        entities_data = financials[year]
        if not isinstance(entities_data, dict):
            continue
            
        lowercase_keys = {k.lower(): k for k in entities_data.keys()}
        # Process standalone/parent/entity first, then group/consolidated last
        # so group-level values overwrite standalone (last-write-wins).
        entity_priorities = ["standalone", "parent", "entity", "company", "bank", "consolidated", "group"]
        other_keys = [k for k in lowercase_keys.keys() if k not in entity_priorities]
        ordered_keys_to_process = other_keys + entity_priorities
        
        for k_lower in ordered_keys_to_process:
            if k_lower not in lowercase_keys:
                continue
            original_key = lowercase_keys[k_lower]
            entity_payload = entities_data[original_key]
            if not isinstance(entity_payload, dict):
                continue
                
            for statement_key in ("income_statement", "balance_sheet", "cash_flow"):
                statement_data = _find_statement_payload(entity_payload, statement_key)
                            
                if not isinstance(statement_data, dict):
                    continue
                    
                for raw_field, raw_val in statement_data.items():
                    parsed_val = _parse_number(raw_val)
                    if parsed_val is not None:
                        # Normalize key name using _field_map
                        cleaned_label = raw_field.replace("_", " ").strip()
                        canonical_field = _field_map(statement_key, cleaned_label)
                        if not canonical_field:
                            canonical_field = _field_map(statement_key, raw_field)
                        if not canonical_field:
                            canonical_field = raw_field
                            
                        by_year[year][statement_key][canonical_field] = round(parsed_val, 3)

    confidence_by_year = {
        year: round(min(100.0, max(0.0, 20.0 + 5.0 * _field_count(payload))), 2)
        for year, payload in by_year.items()
    }
    for year, payload in by_year.items():
        payload["extraction_confidence"] = confidence_by_year.get(year, 0.0)

    normalized_company = _slugify_company_name(str(company_name) if company_name else None)
    financial_graph = {year: by_year[year] for year in master_years}

    return {
        "company_name": normalized_company,
        "company": normalized_company,
        "currency": "LKR_millions",
        "years": financial_graph,
        "financial_graph": financial_graph,
        "metadata": {
            "unit_scale": "LKR_millions",
            "confidence": {
                "overall": round(sum(confidence_by_year.values()) / float(len(confidence_by_year)) if confidence_by_year else 0.0, 2),
                "per_year": confidence_by_year,
                "duplicate_year_merges": 0,
            },
        },
        "extraction_confidence": 100 if financial_graph else 0,
    }


def _source_report_year(record: dict[str, Any]) -> str | None:
    for key in ("source_pdf", "pdf_name", "document_name"):
        value = record.get(key)
        if isinstance(value, str):
            match = re.search(r"(20\d{2})", value)
            if match:
                return match.group(1)
    return None


def _merge_strict_years(
    target: dict[str, Any],
    incoming: dict[str, Any],
    source_report_year: str | None,
) -> None:
    target_years = target.setdefault("years", {})
    target_graph = target.setdefault("financial_graph", target_years)
    incoming_years = incoming.get("years") if isinstance(incoming.get("years"), dict) else {}
    source_weights = target.setdefault("_source_weights", {})

    for year, year_payload in incoming_years.items():
        if not isinstance(year, str) or not isinstance(year_payload, dict):
            continue
        incoming_weight = 2 if source_report_year == year else 1
        existing_weight = source_weights.get(year, 0)
        if year not in target_years:
            target_years[year] = {
                "income_statement": {},
                "balance_sheet": {},
                "cash_flow": {},
            }

        for section_name in ("income_statement", "balance_sheet", "cash_flow"):
            incoming_section = year_payload.get(section_name)
            if not isinstance(incoming_section, dict):
                continue
            target_section = target_years[year].setdefault(section_name, {})
            for field_name, value in incoming_section.items():
                if field_name == "extraction_confidence":
                    continue
                current_value = target_section.get(field_name)
                if current_value is None or incoming_weight >= existing_weight:
                    target_section[field_name] = value

        if incoming_weight >= existing_weight:
            source_weights[year] = incoming_weight

    target["financial_graph"] = target_graph


def _build_from_financials_records(records: list[dict[str, Any]]) -> dict[str, Any]:
    merged: dict[str, Any] = {
        "company_name": "Unknown Company",
        "company": "Unknown Company",
        "currency": "LKR_millions",
        "years": {},
        "financial_graph": {},
        "metadata": {
            "unit_scale": "LKR_millions",
            "confidence": {
                "overall": 0.0,
                "per_year": {},
                "duplicate_year_merges": 0,
            },
        },
        "extraction_confidence": 0,
        "_source_weights": {},
    }
    company_name = None

    for record in records:
        statements = record.get("statements") if isinstance(record.get("statements"), dict) else {}
        financials = None
        if isinstance(statements, dict):
            if "financials" in statements:
                financials = statements["financials"]
            elif any(isinstance(k, str) and re.match(r"^\d{4}$", k) for k in statements):
                financials = statements
        if financials is None and "financials" in record:
            financials = record["financials"]
        if not (isinstance(financials, dict) and any(isinstance(k, str) and re.match(r"^\d{4}$", k) for k in financials)):
            continue

        if not company_name:
            company_name = (
                record.get("company_name")
                or record.get("company")
                or record.get("pdf_name")
                or record.get("source_pdf")
                or record.get("document_name")
                or (statements.get("company") if isinstance(statements, dict) else None)
            )
        partial = _build_from_financials_format(financials, str(company_name) if company_name else None)
        _merge_strict_years(merged, partial, _source_report_year(record))

    ordered_years = sorted(
        (year for year in merged["years"] if isinstance(year, str) and year.isdigit()),
        key=int,
    )
    merged["years"] = {year: merged["years"][year] for year in ordered_years}
    merged["financial_graph"] = merged["years"]

    confidence_by_year = {
        year: round(min(100.0, max(0.0, 20.0 + 5.0 * _field_count(payload))), 2)
        for year, payload in merged["years"].items()
    }
    for year, payload in merged["years"].items():
        payload["extraction_confidence"] = confidence_by_year.get(year, 0.0)

    normalized_company = _slugify_company_name(str(company_name) if company_name else None)
    duplicate_merges = sum(1 for weight in merged.pop("_source_weights", {}).values() if weight > 1)
    merged["company_name"] = normalized_company
    merged["company"] = normalized_company
    merged["metadata"]["confidence"] = {
        "overall": round(sum(confidence_by_year.values()) / float(len(confidence_by_year)) if confidence_by_year else 0.0, 2),
        "per_year": confidence_by_year,
        "duplicate_year_merges": duplicate_merges,
    }
    merged["extraction_confidence"] = 100 if merged["years"] else 0
    return merged


def build_strict_extraction_dataset(extraction_outputs: list[dict[str, Any]]) -> dict[str, Any]:
    records = [item for item in extraction_outputs if isinstance(item, dict)]
    if not records:
        return {
            "company_name": "Unknown Company",
            "company": "Unknown Company",
            "currency": "LKR_millions",
            "years": {},
            "financial_graph": {},
            "metadata": {
                "unit_scale": "LKR_millions",
                "confidence": {"overall": 0.0, "per_year": {}},
            },
            "extraction_confidence": 0,
        }

    # Structured normalized_results.json format detection and routing.
    # Build from all records; each annual report usually contributes current
    # and comparative years, so returning after the first record drops history.
    structured_records: list[dict[str, Any]] = []
    for record in records:
        financials = None
        statements = record.get("statements")
        if isinstance(statements, dict):
            if "financials" in statements:
                financials = statements["financials"]
            elif any(isinstance(k, str) and re.match(r"^\d{4}$", k) for k in statements):
                financials = statements
        if financials is None and "financials" in record:
            financials = record["financials"]
            
        if isinstance(financials, dict) and any(isinstance(k, str) and re.match(r"^\d{4}$", k) for k in financials):
            structured_records.append(record)

    if structured_records:
        return _build_from_financials_records(structured_records)

    all_rows = _collect_all_rows(records)
    master_years = _detect_master_years(all_rows)
        
    by_year: dict[str, dict[str, Any]] = {
        year: {"income_statement": {}, "balance_sheet": {}, "cash_flow": {}} 
        for year in master_years
    }
    
    company_name = None
    duplicate_year_merges = 0 
    
    for record in records:
        if not company_name:
            company_name = (
                record.get("company_name")
                or record.get("company")
                or record.get("pdf_name")
                or record.get("document_name")
            )

        statements = record.get("statements") if isinstance(record.get("statements"), dict) else {}
        
        for statement_key in ("income_statement", "balance_sheet", "cash_flow"):
            payload = _find_statement_payload(statements, statement_key)
            if not payload:
                continue
                
            currency_hint = _currency_hint(payload if isinstance(payload, dict) else {})
            rows = _section_rows(payload)
            
            for row in rows:
                label = _row_label(row)
                if not label:
                    continue
                field_name = _field_map(statement_key, label)
                if not field_name:
                    continue
                    
                for year in master_years:
                    val = _get_year_value(row, year, currency_hint)
                    if val is not None:
                        if by_year[year][statement_key].get(field_name) is None:
                            by_year[year][statement_key][field_name] = round(val, 3)

    ordered_years = sorted(master_years, key=int)
    
    confidence_by_year = {
        year: round(min(100.0, max(0.0, 20.0 + 5.0 * _field_count(payload))), 2)
        for year, payload in by_year.items()
    }
    for year, payload in by_year.items():
        payload["extraction_confidence"] = confidence_by_year.get(year, 0.0)

    normalized_company = _slugify_company_name(str(company_name) if company_name else None)
    financial_graph = {year: by_year[year] for year in ordered_years}

    return {
        "company_name": normalized_company,
        "company": normalized_company,
        "currency": "LKR_millions",
        "years": financial_graph,
        "financial_graph": financial_graph,
        "metadata": {
            "unit_scale": "LKR_millions",
            "confidence": {
                "overall": round(sum(confidence_by_year.values()) / float(len(confidence_by_year)) if confidence_by_year else 0.0, 2),
                "per_year": confidence_by_year,
                "duplicate_year_merges": duplicate_year_merges,
            },
        },
        "extraction_confidence": 100 if financial_graph else 0,
    }
