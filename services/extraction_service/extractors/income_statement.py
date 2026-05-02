from __future__ import annotations
import re
from typing import Any, Dict, List, Union

# =========================================================
# NUMBER PARSER
# =========================================================
def _parse_number(raw: Any) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)

    s = str(raw).strip()
    if s == "" or s.upper() in ("N/A", "NULL", "-"):
        return None

    s = s.replace(",", "").replace("$", "").replace("\xa0", "")
    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1]

    m = re.search(r"-?\d+(?:\.\d+)?", s)
    if not m:
        return None

    val = float(m.group(0))
    return -val if negative else val


def _clean_label(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"^less\s*:?", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


# =========================================================
# DOCUMENT TYPE CLASSIFIER
# =========================================================
BANK_KEYWORDS = [
    "net interest income",
    "tax on financial services",
    "financial services",
    "impairment charge",
    "fee and commission",
    "trading gains",
    "bank",
]

COMPANY_KEYWORDS = [
    "revenue",
    "sales",
    "cost of sales",
    "cogs",
    "operating income",
    "income statement",
]

def detect_document_type(isec: Dict[str, Any]) -> str:
    text_blob = " ".join(
        k.lower()
        for year in isec.values()
        if isinstance(year, dict)
        for k in year.keys()
    )

    bank_hits = sum(k in text_blob for k in BANK_KEYWORDS)
    company_hits = sum(k in text_blob for k in COMPANY_KEYWORDS)

    if bank_hits >= company_hits:
        return "bank"
    return "company"


# =========================================================
# BANK CANDIDATES
# =========================================================
BANK_CANDIDATES = {
    "Interest Income": ["interest income"],
    "Interest Expense": ["interest expense"],
    "Net Interest Income": ["net interest income"],

    "Fee and Commission Income": ["fee and commission income"],
    "Fee and Commission Expense": ["fee and commission expense"],
    "Net Fee and Commission Income": ["net fee and commission income"],

    "Net gains / (losses) from trading": ["net gains / (losses) from trading", "net trading gains"],
    "Net gains / (losses) from financial instruments at fair value through profit or loss": ["net gains / (losses) from financial instruments at fair value through profit or loss", "net gains from financial instruments at fair value through other comprehensive income"],
    "Net Other Operating Income": ["net other operating income"],

    "Trading Gains Losses": ["gains / (losses) from trading", "trading gains"],
    "Other Operating Income": ["other operating income"],

    "Total Operating Income": ["total operating income"],
    "Impairment Charges": ["impairment charge"],

    "Personnel Expenses": ["personnel expenses"],
    "Other Operating Expenses": ["other expenses"],
    "Total Operating Expenses": ["total operating expenses"],

    "Operating Profit Before FS Tax": ["operating profit before taxes on financial services"],
    "Tax On Financial Services": ["taxes on financial services"],
    "Operating Profit After FS Tax": ["operating profit after taxes on financial services"],

    "Profit Before Income Tax": ["profit before income tax"],
    "Income Tax Expense": ["income tax expense"],
    "Profit For The Year": ["profit for the year"],
    "Basic Earnings Per Share": ["basic earnings per share"],
    "Dividends Per Share": ["dividends per share"],
}


# =========================================================
# COMPANY CANDIDATES
# =========================================================
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


# =========================================================
# ACCOUNTING VALIDATION — BANK
# =========================================================
def validate_bank_accounting(m: Dict[str, float]) -> Dict[str, bool]:
    def approx(a, b):
        if a is None or b is None:
            return False
        return abs(a - b) / max(abs(b), 1) < 0.03

    return {
        "interest_chain": approx(
            (m.get("Interest Income") or 0) - (m.get("Interest Expense") or 0),
            m.get("Net Interest Income"),
        ),
        "fee_chain": approx(
            (m.get("Fee and Commission Income") or 0)
            - (m.get("Fee and Commission Expense") or 0),
            m.get("Net Fee and Commission Income"),
        ),
        "profit_chain": approx(
            (m.get("Profit Before Income Tax") or 0)
            - (m.get("Income Tax Expense") or 0),
            m.get("Profit For The Year"),
        ),
    }


# =========================================================
# ACCOUNTING VALIDATION — COMPANY
# =========================================================
def validate_company_accounting(m: Dict[str, float]) -> Dict[str, bool]:
    def approx(a, b):
        if a is None or b is None:
            return False
        return abs(a - b) / max(abs(b), 1) < 0.03

    return {
        "gross_profit": approx(
            (m.get("Revenue") or 0) - (m.get("Cost of Goods Sold") or 0),
            m.get("Gross Profit"),
        ),
        "profit_chain": approx(
            (m.get("Profit Before Income Tax") or 0)
            - (m.get("Income Tax Expense") or 0),
            m.get("Profit For The Year"),
        ),
    }


# =========================================================
# CONFIDENCE MODEL
# =========================================================
def compute_confidence(value, label_matched, accounting_pass):
    if value is None:
        return 0.05
    score = 0.55
    if label_matched:
        score += 0.20
    if accounting_pass:
        score += 0.20
    return round(min(score, 0.95), 2)


# =========================================================
# CORE EXTRACTION ENGINE
# =========================================================
def extract(input_data: Union[List[Dict[str, Any]], Dict[str, Any]]) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    if not isinstance(input_data, dict):
        return results

    isec = input_data.get("income_statement") or {}
    doc_type = detect_document_type(isec)
    CANDIDATES = BANK_CANDIDATES if doc_type == "bank" else COMPANY_CANDIDATES

    year_keys = sorted(k for k in isec.keys() if re.fullmatch(r"\d{4}", str(k)))

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
            if label not in extracted:
                extracted[label] = None

        checks = (
            validate_bank_accounting(extracted)
            if doc_type == "bank"
            else validate_company_accounting(extracted)
        )
        accounting_pass = any(checks.values())

        for label in CANDIDATES.keys():
            value = extracted[label]
            results.append({
                "document_type": doc_type,
                "year": year,
                "label": label,
                "value": value,
                "confidence": compute_confidence(value, value is not None, accounting_pass),
            })

    return results