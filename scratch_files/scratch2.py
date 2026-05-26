import json
from services.extraction_service.extractors.engine import extract_financial_data

table = [
    ["", "", "GROUP", "", "COMPANY", ""],
    ["", "", "2024", "2023", "2024", "2023"],
    ["Revenue", "", "14,178,550,721", "17,135,330,652", "45,110,918", "73,159,654"],
    ["Cost of Sales", "", "(10,000,000,000)", "(12,000,000,000)", "(30,000,000)", "(40,000,000)"],
    ["Gross Profit", "", "4,178,550,721", "5,135,330,652", "15,110,918", "33,159,654"]
]

candidates = {
    "revenue": ["revenue", "sales", "turnover"],
    "cost_of_sales": ["cost of sales", "cogs"],
    "gross_profit": ["gross profit"]
}

out = extract_financial_data(table, candidates, "income_statement")
print(json.dumps(out, indent=2))
