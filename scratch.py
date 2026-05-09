import json
import re

BANK_CANDIDATES = {
    "Interest Income": ["interest income"],
    "Interest Expense": ["interest expense"],
    "Net Interest Income": ["net interest income"],
}

COMPANY_CANDIDATES = {
    "Revenue": ["revenue", "sales", "total revenue"],
    "Cost of Goods Sold": ["cost of sales", "cogs"],
    "Gross Profit": ["gross profit","gross income"],
    "Interest Income": ["interest income"],
    "Operating Expenses": ["operating expenses", "Operating (Loss)/Profit"],
    "Operating Income": ["operating income"],
    "Finance Costs": ["finance costs", "finance expenses"],
    "Interest Expense": ["interest expense"],
    "Profit Before Income Tax": ["profit before income tax" ,"(Loss)/Profit Before Tax"],
    "Income Tax Expense": ["income tax expense"],
    "Profit For The Year": ["net income", "profit for the year"],
    "Total Comprehensive Income": ["total comprehensive income" , "Total comprehensive income for the year"],
    "Dividends": ["dividends per share"],
    "Earnings Per Share": ["earnings per share"],
    "Tax Expense": ["tax expense","Income Tax Expense"],
}

def _clean_label(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"^less\s*:?", "", text)
    text = re.sub(r"\s+", " ", text)
    return text

def _parse_number(raw):
    return float(raw) if isinstance(raw, (int,float)) else None

def extract(input_data):
    isec = input_data.get("income_statement") or {}
    CANDIDATES = COMPANY_CANDIDATES

    year_keys = ["2023"]
    results = []

    for year in year_keys:
        year_data = isec.get(year, {})
        extracted = {}
        extracted_scores = {}

        for field, raw_val in year_data.items():
            clean = _clean_label(field)
            
            best_label = None
            best_score = 0
            
            for label, keys in CANDIDATES.items():
                for k in keys:
                    k_lower = k.lower()
                    if k_lower == clean:
                        score = 100
                    elif k_lower in clean:
                        score = len(k_lower) / len(clean)
                    else:
                        continue
                        
                    if score > best_score:
                        best_score = score
                        best_label = label
                        
            if best_label:
                if best_label not in extracted or best_score > extracted_scores[best_label]:
                    extracted[best_label] = _parse_number(raw_val)
                    extracted_scores[best_label] = best_score

        for label in CANDIDATES.keys():
            results.append({
                "label": label,
                "value": extracted.get(label),
                "score": extracted_scores.get(label, 0)
            })

    return results

data = {
    "income_statement": {
        "2023": {
            "Cost of sales": 1000,
            "Sales": 5000,
            "Net interest income": 200,
            "Interest income": 300,
            "Interest expense": 100
        }
    }
}

print(json.dumps(extract(data), indent=2))
