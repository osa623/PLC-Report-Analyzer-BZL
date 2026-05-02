from __future__ import annotations

import re
from typing import Any, Dict, List, Union


def _parse_number(raw: Any) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)

    s = str(raw).strip()
    if s == "" or s.upper() in ("N/A", "NULL"):
        return None

    s = s.replace("$", "").replace("€", "").replace(",", "").replace("\xa0", "")

    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1]

    m = re.search(r"-?\d+(?:\.\d+)?", s)
    if not m:
        return None

    try:
        val = float(m.group(0))
    except Exception:
        return None

    return -val if negative else val


def _pick_latest_year_map(cf_map: Dict[str, Any]) -> Dict[str, Any]:
    years = [k for k in cf_map.keys() if re.fullmatch(r"\d{4}", str(k))]
    if years:
        years_sorted = sorted(years, reverse=True)
        return cf_map.get(years_sorted[0], {})
    return cf_map


COMPANY_CASHFLOW_CANDIDATES = {
    "loss)/profit before tax": [
        "profit_before_tax",
        "profit_before_tax_pbt",
        "profit_before_tax_income",
        "pbt",
        "profit_before_taxation",
    ],
    "depreciation on property plant": [
        "depreciation_ppe",
        "depreciation_property_plant_equipment",
        "ppe_depreciation",
        "depreciation",
    ],
    "amortization of intangible assets": [
        "amortization_intangibles",
        "intangible_amortization",
        "amortization_intangible_assets",
    ],
    "amortization of rou asset": [
        "amortization_rou",
        "rou_asset_amortization",
    ],
    "retirement benefit obligation": [
        "retirement_provision",
        "employee_benefit_obligation",
        "gratuity_obligation",
    ],
    "obsolete inventories": [
        "inventory_provision",
        "obsolete_stock",
        "inventory_write_down",
    ],
    "impairment on trade receivables": [
        "receivable_impairment",
        "bad_debt_provision",
        "trade_receivable_impairment",
    ],
    "fair value of investment properties": [
        "fv_investment_property",
        "investment_property_fair_value",
    ],
    "biological assets": [
        "fv_biological_assets",
        "biological_asset_fair_value",
    ],
    "unrealized exchange gain": [
        "unrealized_fx_gain",
        "foreign_exchange_gain_unrealized",
        "fx_gain_unrealized",
    ],
    "interest expenses": [
        "interest_expense",
        "finance_cost",
        "interest_cost",
    ],
    "interest income": [
        "interest_income",
        "finance_income",
    ],
    "impairment of goodwill": [
        "goodwill_impairment",
        "impairment_goodwill",
    ],
    "gain on disposal of property": [
        "ppe_disposal_gain",
        "asset_disposal_gain",
    ],

    "operating profit/ (loss) before working capital changes": [
        "operating_before_wc",
        "operating_profit_before_working_capital",
    ],

    "inventories": [
        "change_inventory",
        "inventory_change",
    ],
    "trade and other receivables": [
        "change_receivables",
        "trade_receivables_change",
    ],
    "due from related companies": [
        "change_related_receivable",
        "related_party_receivables",
    ],
    "trade and other payables": [
        "change_payables",
        "trade_payables_change",
    ],
    "due to related companies": [
        "change_related_payables",
        "related_party_payables",
    ],

    "cash (used in)/ generated from operations": [
        "cash_from_operations",
        "operating_cashflow_before_tax",
    ],
    "gratuity paid": [
        "gratuity_paid",
        "employee_benefit_paid",
    ],
    "taxation paid": [
        "tax_paid",
        "income_tax_paid",
    ],
    "net cash (used in)/ generated from operating activities": [
        "net_operating_cashflow",
        "operating_cashflow_net",
    ],

    "acquisition of property": [
        "ppe_purchase",
        "property_purchase",
        "capital_expenditure_ppe",
    ],
    "addition to intangible": [
        "intangible_purchase",
        "intangible_addition",
    ],
    "addition to biological assets": [
        "biological_assets_purchase",
        "biological_addition",
    ],
    "interest income received": [
        "interest_received",
    ],
    "addition of investment property": [
        "investment_property_purchase",
    ],
    "acquisition of subsidiaries": [
        "subsidiary_acquisition",
    ],
    "rights issue": [
        "rights_issue_proceeds",
    ],
    "shares in existing subsidiaries": [
        "subsidiary_share_transactions",
    ],
    "available for sale financial": [
        "afs_disposal",
    ],
    "amalgamation impact": [
        "amalgamation_cash_effect",
    ],
    "net cash generated from/(used in) investing activities": [
        "net_investing_cashflow",
        "investing_cashflow_net",
    ],

    "lease rental paid": [
        "lease_payments",
    ],
    "proceeds from borrowings": [
        "borrowings_received",
    ],
    "repayment of borrowings": [
        "borrowings_repaid",
    ],
    "dividends paid": [
        "dividends_paid",
    ],

    "net cash generated from/(used in) financing activities": [
        "net_financing_cashflow",
        "financing_cashflow_net",
    ],

    "net increase/(decrease) in cash": [
        "net_change_cash",
        "cash_change_net",
    ],
    "cash & cash equivalents at the beginning": [
        "opening_cash",
        "beginning_cash_balance",
    ],
    "cash & cash equivalents at the end": [
        "closing_cash",
        "ending_cash_balance",
    ],
    "cash at bank & in hand": [
        "cash_component",
        "cash_on_hand_bank",
    ],
    "bank overdraft": [
        "bank_overdraft",
    ],
}


BANK_CASHFLOW_CANDIDATES = {
    "interest receipts": [
        "interest_receipts",
    ],
    "interest payments": [
        "interest_payments",
    ],
    "net commission receipts": [
        "net_commission_receipts",
    ],
    "payments to employees": [
        "payments_to_employees",
    ],
    "taxes on financial services": [
        "taxes_on_financial_services",
    ],
    "receipts/exchange gain / (loss) from other operating activities": [
        "fx_other_operating",
    ],
    "payments for other operating activities": [
        "payments_other_operating",
    ],
    "operating profit before changes in operating assets and liabilities": [
        "operating_profit_before_wc",
    ],

    "balances with central bank": [
        "change_balances_central_bank",
    ],
    "loans and advances to customers": [
        "change_loans_advances",
    ],
    "reverse repurchase agreements": [
        "change_reverse_repo",
    ],
    "other assets": [
        "change_other_assets",
    ],

    "due to depositors": [
        "change_deposits",
    ],
    "other borrowings": [
        "change_other_borrowings",
    ],
    "securities sold under repurchase agreements": [
        "change_repo_liabilities",
    ],
    "other liabilities": [
        "change_other_liabilities",
    ],

    "income tax paid": [
        "income_tax_paid",
    ],
    "net cash generated from / (used in) operating activities": [
        "net_operating_cashflow",
    ],

    "purchase of property, plant & equipment": [
        "ppe_purchase",
    ],
    "sale of property, plant and equipment": [
        "ppe_sale",
    ],
    "financial investments": [
        "net_financial_investments",
    ],
    "purchase of intangible assets": [
        "intangible_purchase",
    ],
    "acquisition of subsidiary": [
        "subsidiary_acquisition",
    ],
    "investment in rights issue of subsidiary": [
        "subsidiary_rights_issue",
    ],
    "dividends received from investment in subsidiaries": [
        "dividend_from_subsidiaries",
    ],
    "dividends received from other investments": [
        "dividend_from_investments",
    ],
    "net cash generated from / (used in) investing activities": [
        "net_investing_cashflow",
    ],

    "issue from non-controlling interest": [
        "nci_issue",
    ],
    "issue of subordinated debt": [
        "subordinated_debt_issue",
    ],
    "debt security issued": [
        "debt_security_issue",
    ],
    "repayment of subordinated debt": [
        "debt_repayment",
    ],
    "dividend paid to non controlling interest": [
        "dividend_paid_nci",
    ],
    "dividend paid to shareholders": [
        "dividend_paid_parent",
    ],
    "net cash generated in financing activities": [
        "net_financing_cashflow",
    ],

    "net decrease in cash and cash equivalents": [
        "net_change_cash",
    ],
    "cash and cash equivalents at the beginning of the year": [
        "opening_cash",
    ],
    "cash and cash equivalents at the end of the period": [
        "closing_cash",
    ],
    "cash and cash equivalents": [
        "cash_component",
    ],
    "placements with banks": [
        "bank_placements",
    ],
}


CASHFLOW_CANDIDATES = {
    **COMPANY_CASHFLOW_CANDIDATES,
    **BANK_CASHFLOW_CANDIDATES,
}


def extract(
    input_data: Union[List[Dict[str, Any]], Dict[str, Any]],
) -> List[Dict[str, Any]]:

    results: List[Dict[str, Any]] = []

    if isinstance(input_data, dict) and "cash_flow" in input_data:
        cf = input_data.get("cash_flow") or {}
        cf_entry = _pick_latest_year_map(cf)

        for label_key, synonyms in CASHFLOW_CANDIDATES.items():
            value = None
            confidence = 1.0
            source = None

            for syn in synonyms:
                for fk, fv in cf_entry.items():
                    if isinstance(fk, str) and syn in fk.lower():
                        parsed = _parse_number(fv)
                        if parsed is not None:
                            value = parsed
                            if isinstance(fv, dict) and "confidence" in fv:
                                confidence = float(fv.get("confidence", 1.0))
                            source = fk
                            break
                if value is not None:
                    break

            if value is None and isinstance(cf_entry, dict):
                for fk, fv in cf_entry.items():
                    if isinstance(fv, (int, float)) and label_key.split()[0] in fk.lower():
                        value = float(fv)
                        source = fk
                        break

            results.append(
                {
                    "label": label_key,
                    "value": value,
                    "period": "latest",
                    "confidence": confidence,
                    "source": source,
                }
            )

        return results

    if isinstance(input_data, list):
        for item in input_data:
            label = item.get("label") or item.get("name") or "unknown"
            value = _parse_number(item.get("value") or item.get("text"))
            results.append(
                {
                    "label": label,
                    "value": value,
                    "period": item.get("period", "current"),
                    "confidence": item.get("confidence", 1.0),
                }
            )
        return results

    return results