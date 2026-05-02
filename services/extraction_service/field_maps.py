from __future__ import annotations

# ==========================================================
# BANK MAPPINGS
# ==========================================================

BANK_BALANCE_SHEET_MAP = {
    "cash_and_equivalents": ["cash and cash equivalents", "balances with central bank", "cash and balances"],
    "placements_with_banks": ["placements with banks"],
    "loans_to_customers": ["loans and advances to customers", "loans to customers"],
    "financial_investments": ["financial assets measured", "financial investments"],
    "investment_properties": ["investment properties"],
    "property_plant_equipment": ["property, plant and equipment", "property plant equipment"],
    "intangible_assets": ["intangibles and goodwill", "intangible assets"],
    "deferred_tax_assets": ["deferred tax assets"],
    "other_assets": ["other assets"],
    "total_assets": ["total assets"],
    
    "due_to_banks": ["due to banks"],
    "due_to_customers": ["due to depositors", "due to customers"],
    "other_borrowings": ["other borrowings"],
    "debt_securities": ["debt securities issued", "debt securities"],
    "current_tax_liabilities": ["current tax liabilities"],
    "other_liabilities": ["other liabilities"],
    "total_liabilities": ["total liabilities"],
    
    "total_equity": ["total equity"],
}

BANK_INCOME_MAP = {
    "revenue_or_interest_income": ["interest income"],
    "interest_expense": ["interest expense"],
    "net_interest_income": ["net interest income"],
    "fee_commission_income": ["fee and commission income"],
    "fee_commission_expense": ["fee and commission expense"],
    "net_fee_commission_income": ["net fee and commission income"],
    "trading_gains_losses": ["net gains / (losses) from trading", "trading gains losses"],
    "financial_instrument_gains_losses": ["net gains / (losses) from financial instruments at fair value through profit or loss"],
    "net_other_operating_income": ["net other operating income"],
    "other_operating_income": ["other operating income"],
    "total_operating_income": ["total operating income"],
    "impairment_charges": ["impairment charges"],
    "personnel_expenses": ["personnel expenses"],
    "other_operating_expenses": ["other operating expenses"],
    "operating_expenses": ["total operating expenses"],
    "operating_profit_before_fs_tax": ["operating profit before fs tax"],
    "tax_on_financial_services": ["tax on financial services"],
    "operating_profit": ["operating profit after fs tax"],
    "profit_before_tax": ["profit before income tax"],
    "tax_expense": ["income tax expense"],
    "net_profit": ["profit for the year", "net income", "profit attributable"],
    "earnings_per_share": ["basic earnings per share"],
    "dividends_per_share": ["dividends per share"],
}

BANK_CASHFLOW_MAP = {
    "operating_cash_flow": ["net cash generated from / (used in) operating activities", "net cash from operating activities"],
    "investing_cash_flow": ["net cash generated from / (used in) investing activities", "net cash from investing activities"],
    "financing_cash_flow": ["net cash generated in financing activities", "net cash from financing activities"],
    "net_cash_flow": ["net decrease in cash and cash equivalents", "net increase in cash"],
    "opening_cash": ["cash and cash equivalents at the beginning of the year", "opening cash"],
    "closing_cash": ["cash and cash equivalents at the end of the period", "closing cash"],
}

# ==========================================================
# COMPANY MAPPINGS
# ==========================================================

COMPANY_BALANCE_SHEET_MAP = {
    "cash_and_equivalents": ["cash and cash equivalents"],
    "inventories": ["inventories"],
    "trade_receivables": ["trade and other receivables"],
    "property_plant_equipment": ["property, plant and equipment", "property plant equipment"],
    "investment_properties": ["investment properties"],
    "right_of_use_assets": ["right of use assets"],
    "intangible_assets": ["intangible assets"],
    "investment_in_subsidiaries": ["investment in subsidiaries"],
    
    "current_assets": ["total current assets", "current assets"],
    "non_current_assets": ["total non current assets", "non current assets"],
    "total_assets": ["total assets"],
    
    "stated_capital": ["stated capital"],
    "retained_earnings": ["retained earnings"],
    "revaluation_reserve": ["revaluation reserve"],
    "total_equity": ["total equity", "shareholder equity"],
    
    "borrowings": ["interest bearing borrowings", "borrowings", "debt", "total debt"],
    "lease_liabilities": ["lease liabilities"],
    "trade_payables": ["trade and other payables"],
    "bank_overdrafts": ["bank overdrafts"],
    "deferred_tax_liabilities": ["deferred tax liabilities"],
    
    "current_liabilities": ["total current liabilities", "current liabilities"],
    "non_current_liabilities": ["total non current liabilities", "non current liabilities"],
    "total_liabilities": ["total liabilities"],
}

COMPANY_INCOME_MAP = {
    "revenue": ["revenue", "turnover", "sales"],
    "cost_of_sales": ["cost of goods sold", "cost of sales", "cost of revenue", "cogs"],
    "gross_profit": ["gross profit"],
    "interest_income": ["interest income"],
    "operating_expenses": ["operating expenses"],
    "operating_profit": ["operating income", "operating profit"],
    "interest_expense": ["interest expense", "finance cost"],
    "profit_before_tax": ["profit before income tax", "profit before tax", "pbt"],
    "tax_expense": ["income tax expense", "tax expense", "taxation"],
    "net_profit": ["profit for the year", "net profit", "net income"],
    "total_comprehensive_income": ["total comprehensive income"],
    "dividends": ["dividends"],
    "earnings_per_share": ["earnings per share"],
}

COMPANY_CASHFLOW_MAP = {
    "operating_cash_flow": ["net cash (used in)/ generated from operating activities", "net cash from operating activities", "operating cash flow"],
    "investing_cash_flow": ["net cash generated from/(used in) investing activities", "net cash from investing activities", "investing cash flow"],
    "financing_cash_flow": ["net cash generated from/(used in) financing activities", "net cash from financing activities", "financing cash flow"],
    "net_cash_flow": ["net increase/(decrease) in cash", "net cash flow", "net change in cash and cash equivalents"],
    "opening_cash": ["cash & cash equivalents at the beginning", "opening cash", "cash and cash equivalents at beginning"],
    "closing_cash": ["cash & cash equivalents at the end", "closing cash", "cash and cash equivalents at end"],
}

# ==========================================================
# MASTER MAPS
# ==========================================================

SECTION_LABEL_MAPS = {
    "bank": {
        "balance_sheet": BANK_BALANCE_SHEET_MAP,
        "income_statement": BANK_INCOME_MAP,
        "cashflow_statement": BANK_CASHFLOW_MAP,
    },
    "company": {
        "balance_sheet": COMPANY_BALANCE_SHEET_MAP,
        "income_statement": COMPANY_INCOME_MAP,
        "cashflow_statement": COMPANY_CASHFLOW_MAP,
    },
}
