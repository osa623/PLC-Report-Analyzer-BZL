from __future__ import annotations

from typing import Any

FIELD_LABELS = {
    # Income Statement
    "revenue": "Revenue / Turnover",
    "cost_of_sales": "Cost of Sales / Cost of Revenue",
    "gross_profit": "Gross Profit",
    "operating_profit": "Operating Profit / EBIT",
    "profit_before_tax": "Profit Before Tax",
    "net_profit": "Net Profit After Tax",
    "finance_cost": "Finance Costs / Interest Expense",
    "tax_expense": "Income Tax Expense",
    "eps": "Earnings Per Share (EPS)",
    "total_operating_income": "Total Operating Income",
    "total_operating_expenses": "Total Operating Expenses",
    "impairment_charge": "Impairment Charge",
    
    # Balance Sheet
    "total_assets": "Total Assets",
    "current_assets": "Current Assets",
    "inventory": "Inventory / Inventories",
    "receivables": "Trade & Other Receivables",
    "cash": "Cash & Cash Equivalents",
    "equity": "Total Shareholders Equity",
    "total_liabilities": "Total Liabilities",
    "current_liabilities": "Current Liabilities",
    "noncurrent_liabilities": "Non-Current Liabilities",
    "borrowings": "Borrowings / Total Debt",
    "deposits": "Customer Deposits",
    "loans": "Loans & Advances to Customers",
    "shares_outstanding": "Ordinary Shares Outstanding",
    "market_price": "Market Price per Share",
    
    # Cash Flow
    "operating_cash_flow": "Net Cash Flow from Operating Activities",
    "investing_cash_flow": "Net Cash Flow from Investing Activities",
    "financing_cash_flow": "Net Cash Flow from Financing Activities",
    "net_cash_flow": "Net Increase/Decrease in Cash",
    "opening_cash": "Cash at Beginning of Year",
    "closing_cash": "Cash at End of Year",
    "capex": "Capital Expenditure (CapEx)",
    "dividends_paid": "Dividends Paid",
}


def map_company_to_extraction_format(company_doc: dict[str, Any]) -> dict[str, Any]:
    """Convert a MongoDB company document into the format expected by build_strict_analysis_result."""
    if not company_doc:
        return {}
    
    financials = company_doc.get("financials") or {}
    
    return {
        "company_name": company_doc.get("name", "Unknown"),
        "company": company_doc.get("name", "Unknown"),
        "currency": company_doc.get("currency", "LKR_millions"),
        "years": financials,
        "financial_graph": financials,
        "metadata": company_doc.get("metadata", {}),
    }


def map_financials_for_display(financials: dict[str, Any]) -> dict[str, Any]:
    """Format financials for the frontend review display.
    Adds human-readable labels, organizes by year > section > field.
    """
    if not financials:
        return {}
        
    def get_label(key: str) -> str:
        if key in FIELD_LABELS:
            return FIELD_LABELS[key]
        return key.replace("_", " ").title()
        
    result = {}
    for year, statements in financials.items():
        year_data = {}
        for stmt_type, fields in statements.items():
            if isinstance(fields, dict):
                stmt_list = []
                for k, v in fields.items():
                    stmt_list.append({
                        "key": k,
                        "label": get_label(k),
                        "value": v
                    })
                year_data[stmt_type] = stmt_list
            else:
                year_data[stmt_type] = fields
        result[year] = year_data
    return result
