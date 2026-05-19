"""
Data loader: reads normalized_results.json and transforms it for analysis.
"""
import json
from pathlib import Path


def _parse_num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(",", "").replace(" ", "")
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("()")
    if not s or s in ("-", "—", "N/A"):
        return None
    try:
        n = float(s)
        return -abs(n) if neg else n
    except ValueError:
        return None


def _get(d, *keys):
    if not isinstance(d, dict):
        return None
    for k in keys:
        v = _parse_num(d.get(k))
        if v is not None:
            return v
    return None


def load_normalized_data(json_path=None):
    if json_path is None:
        json_path = Path(__file__).parent.parent / "extraction_service" / "normalized_results.json"
    with open(json_path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, list):
        raw = [raw]

    merged_years = {}

    for entry in raw:
        financials = entry.get("financials", {})
        for year_key, year_data in financials.items():
            if not str(year_key).isdigit():
                continue

            bank = year_data.get("bank", {})
            inc = bank.get("income_statement", {})
            bs = bank.get("balance_sheet", {})
            cf = bank.get("cash_flow", year_data.get("cash_flow", {}))
            eq = bank.get("equity", year_data.get("equity", {}))
            ci = bank.get("comprehensive_income", {})
            comp_eq = year_data.get("company", {}).get("equity", {})

            if year_key not in merged_years:
                merged_years[year_key] = {
                    "income_statement": {},
                    "balance_sheet": {},
                    "cash_flow": {},
                    "equity": {},
                    "comprehensive_income": {},
                }

            target = merged_years[year_key]
            # Merge - don't overwrite existing non-None values
            for section_name, section_data in [
                ("income_statement", inc),
                ("balance_sheet", bs),
                ("cash_flow", cf if isinstance(cf, dict) else {}),
                ("comprehensive_income", ci),
            ]:
                if not isinstance(section_data, dict):
                    continue
                for k, v in section_data.items():
                    parsed = _parse_num(v)
                    if parsed is not None and (
                        k not in target[section_name]
                        or target[section_name][k] is None
                    ):
                        target[section_name][k] = parsed

    return merged_years


def extract_banking_metrics(merged_years):
    """Extract key financial metrics per year for banking analysis."""
    years_sorted = sorted(merged_years.keys(), key=int)
    metrics = {}

    for yr in years_sorted:
        d = merged_years[yr]
        inc = d.get("income_statement", {})
        bs = d.get("balance_sheet", {})
        cf = d.get("cash_flow", {})

        # Revenue proxies for banks
        financing_income = _get(inc, "financing_income")
        net_financing_income = _get(inc, "net_financing_income", "net_interest_income")
        total_op_income = _get(inc, "total_operating_income")
        net_op_income = _get(inc, "net_operating_income")

        # Expenses
        total_op_expenses = _get(inc, "total_operating_expenses")
        personnel = _get(inc, "personnel_expenses")
        depreciation = _get(inc, "depreciation_of_property_plant_and_equipment",
                           "depreciation_of_property_plant_equipment_and_right_of_use_assets")
        amortisation = _get(inc, "amortisation_of_intangible_assets")
        other_opex = _get(inc, "other_operating_expenses")
        impairment = _get(inc, "impairment_on_financial_assets")
        financing_expenses = _get(inc, "financing_expenses")

        # Profits
        pbt = _get(inc, "profit_before_tax")
        net_profit = _get(inc, "profit_for_the_year")
        tax = _get(inc, "tax_expenses")
        eps = _get(inc, "earnings_per_share", "earnings_per_share_basic_diluted")

        # Operating profit (various naming)
        op_profit = _get(inc,
            "operating_profit_before_value_added_tax_on_financial_services_nation_building_tax",
            "operating_profit_before_value_added_tax_on_financial_services_nation_building_tax_and_debt_repayment_levy",
            "operating_profit_before_vat_on_financial_services_social_security_contribution_levy",
            "operating_profit_before_value_added_tax_on_financial_services_nation_building_tax_debt_repayment_levy")
        vat_nbt = _get(inc,
            "value_added_tax_on_financial_services_nation_building_tax",
            "value_added_tax_on_financial_services_nation_building_tax_and_debt_repayment_levy",
            "vat_on_financial_services_social_security_contribution_levy",
            "value_added_tax_on_financial_services_nation_building_tax_debt_repayment_levy")

        fees_commission = _get(inc, "net_fees_and_commission_income", "net_fee_and_commission_income")
        trading_income = _get(inc, "net_trading_income")

        # Balance sheet
        total_assets = _get(bs, "total_assets")
        total_liabilities = _get(bs, "total_liabilities")
        total_equity = _get(bs, "total_equity")
        cash = _get(bs, "cash_and_cash_equivalents")
        stated_capital = _get(bs, "stated_capital")
        retained_earnings = _get(bs, "retained_earnings")
        ppe = _get(bs, "property_plant_and_equipment",
                   "property_plant_equipment_and_right_of_use_assets")
        intangibles = _get(bs, "intangible_assets")

        # Loans (various naming)
        loans = _get(bs, "financing_and_receivables_to_other_customers",
                     "financial_assets_at_amortised_cost_financing_and_receivables_to_other_customers")

        # Deposits (various naming)
        deposits = _get(bs, "due_to_other_customers",
                        "financial_liabilities_at_amortised_cost_due_to_depositors")

        nav_per_share = _get(bs, "net_asset_value_per_share")
        num_employees = _get(bs, "number_of_employees")
        num_branches = _get(bs, "number_of_branches")

        # Cash flow
        ocf = _get(cf, "net_cash_flow_from_operating_activities",
                   "net_cash_used_in_from_operating_activities")
        icf = _get(cf, "net_cash_flows_used_in_investing_activities",
                   "net_cash_used_from_investing_activities")
        fcf_financing = _get(cf, "net_cash_flows_from_financing_activities",
                             "net_cash_used_in_from_financing_activities")
        capex = _get(cf, "acquisition_of_property_plant_and_equipment")
        dividends_paid = _get(cf, "dividend_paid")
        net_cash_change = _get(cf, "net_increase_decrease_in_cash_and_cash_equivalents")
        opening_cash = _get(cf, "cash_and_cash_equivalents_at_the_beginning_of_the_year")
        closing_cash = _get(cf, "cash_and_cash_equivalents_at_the_end_of_the_year",
                           "cash_and_cash_equivalents_at_the_end_of_the_year_gross_of_allowance_for_impairment_losses")

        # Derive equity if missing
        if total_equity is None and total_assets is not None and total_liabilities is not None:
            total_equity = total_assets - total_liabilities

        metrics[yr] = {
            "financing_income": financing_income,
            "financing_expenses": financing_expenses,
            "net_financing_income": net_financing_income,
            "total_operating_income": total_op_income,
            "net_operating_income": net_op_income,
            "total_operating_expenses": total_op_expenses,
            "personnel_expenses": personnel,
            "depreciation": depreciation,
            "amortisation": amortisation,
            "other_opex": other_opex,
            "impairment": impairment,
            "operating_profit": op_profit,
            "vat_nbt": vat_nbt,
            "profit_before_tax": pbt,
            "tax_expense": tax,
            "net_profit": net_profit,
            "eps": eps,
            "fees_commission": fees_commission,
            "trading_income": trading_income,
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "total_equity": total_equity,
            "cash": cash,
            "stated_capital": stated_capital,
            "retained_earnings": retained_earnings,
            "ppe": ppe,
            "intangibles": intangibles,
            "loans": loans,
            "deposits": deposits,
            "nav_per_share": nav_per_share,
            "num_employees": num_employees,
            "num_branches": num_branches,
            "ocf": ocf,
            "icf": icf,
            "fcf_financing": fcf_financing,
            "capex": capex,
            "dividends_paid": dividends_paid,
            "net_cash_change": net_cash_change,
            "opening_cash": opening_cash,
            "closing_cash": closing_cash,
        }

    return metrics, years_sorted


def build_strict_pipeline_input(merged_years):
    """Transform merged data into the format expected by strict_pipeline."""
    dataset = {"years": {}, "company_name": "AMANA Banking"}
    for yr, data in merged_years.items():
        dataset["years"][yr] = data
    return dataset


if __name__ == "__main__":
    merged = load_normalized_data()
    metrics, years = extract_banking_metrics(merged)
    print(f"Loaded {len(years)} years: {years}")
    for yr in years:
        m = metrics[yr]
        has = [k for k, v in m.items() if v is not None]
        print(f"  {yr}: {len(has)} metrics available")
