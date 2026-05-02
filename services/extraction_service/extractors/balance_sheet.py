from __future__ import annotations
import re
from typing import Any, Dict, List, Union

# ==========================================================
# NUMBER PARSER
# ==========================================================
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


def _clean(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"\s+", " ", text)
    return text


# ==========================================================
# COMPANY KEYWORD MAP 

COMPANY_BS_CANDIDATES = {
    # ASSETS
    "Cash and Cash Equivalents": ["cash and cash equivalents"],
    "Inventories": ["inventories"],
    "Trade and Other Receivables": ["trade and other receivables"],
    "Property Plant Equipment": ["property, plant and equipment"],
    "Investment Properties": ["investment properties"],
    "Right of Use Assets": ["right of use assets"],
    "Intangible Assets": ["intangible assets"],
    "Investment in Subsidiaries": ["investment in subsidiaries"],

    "Total Current Assets": ["total current assets"],
    "Total Non Current Assets": ["total non current assets"],
    "Total Assets": ["total assets"],

    # EQUITY
    "Stated Capital": ["stated capital"],
    "Retained Earnings": ["retained earnings"],
    "Revaluation Reserve": ["revaluation reserve"],
    "Total Equity": ["total equity"],

    # LIABILITIES
    "Interest Bearing Borrowings": ["interest bearing borrowings"],
    "Lease Liabilities": ["lease liabilities"],
    "Trade and Other Payables": ["trade and other payables"],
    "Bank Overdrafts": ["bank overdrafts"],
    "Deferred Tax Liabilities": ["deferred tax liabilities"],

    "Total Current Liabilities": ["total current liabilities"],
    "Total Non Current Liabilities": ["total non current liabilities"],
    "Total Liabilities": ["total liabilities"],
}


# ==========================================================
# BANK KEYWORD MAP  

BANK_BS_CANDIDATES = {
    # ASSETS
    "Cash and Balances": ["cash and cash equivalents", "balances with central bank"],
    "Placements With Banks": ["placements with banks"],
    "Loans to Customers": ["loans and advances to customers"],
    "Financial Investments": ["financial assets measured"],
    "Investment Properties": ["investment properties"],
    "Property Plant Equipment": ["property, plant and equipment"],
    "Intangible Assets": ["intangibles and goodwill"],
    "Deferred Tax Assets": ["deferred tax assets"],
    "Other Assets": ["other assets"],
    "Total Assets": ["total assets"],

    # LIABILITIES
    "Due to Banks": ["due to banks"],
    "Due to Customers": ["due to depositors"],
    "Other Borrowings": ["other borrowings"],
    "Debt Securities": ["debt securities issued"],
    "Current Tax Liabilities": ["current tax liabilities"],
    "Other Liabilities": ["other liabilities"],
    "Total Liabilities": ["total liabilities"],

    # EQUITY
    "Total Equity": ["total equity"],
}


# ==========================================================
# ACCOUNTING VALIDATION
# ==========================================================
def _approx(a, b):
    if a is None or b is None:
        return False
    if abs(b) < 1:
        return True
    return abs(a - b) / abs(b) < 0.03


def _validate_accounting(year_map: Dict[str, float]) -> bool:
    assets = year_map.get("Total Assets")
    liabilities = year_map.get("Total Liabilities")
    equity = year_map.get("Total Equity")

    if assets is None or liabilities is None or equity is None:
        return False

    return _approx(assets, liabilities + equity)


# ==========================================================
# CONTINUITY VALIDATION -- BOOST OR PENALIZE CONFIDENCE BASED ON YEAR-ON-YEAR CONTINUITY

def _continuity_boost(results):
    by_label = {}
    for r in results:
        by_label.setdefault(r["label"], []).append(r)

    for label, rows in by_label.items():
        rows.sort(key=lambda x: x["year"])
        prev = None
        for r in rows:
            if prev and r["value"] and prev["value"]:
                growth = abs(r["value"] - prev["value"]) / max(abs(prev["value"]), 1)
                if growth < 5:
                    r["confidence"] += 0.05
                else:
                    r["confidence"] -= 0.15
            prev = r


# ==========================================================
# CORE MATCHER
# ==========================================================
def _extract_year(year_data, candidates):
    extracted = {}
    extracted_scores = {}

    for field, raw_val in year_data.items():
        clean = _clean(field)
        
        best_label = None
        best_score = 0
        
        for label, keys in candidates.items():
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
            parsed = _parse_number(raw_val)
            if parsed is not None:
                if best_label not in extracted or best_score > extracted_scores[best_label]:
                    extracted[best_label] = parsed
                    extracted_scores[best_label] = best_score

    for label in candidates.keys():
        if label not in extracted:
            extracted[label] = None

    return extracted


# ==========================================================
# MAIN EXTRACTOR
# ==========================================================
def extract(input_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    bs = input_data.get("balance_sheet") or {}

    year_keys = sorted([k for k in bs.keys() if re.fullmatch(r"\d{4}", str(k))])

    for year in year_keys:
        year_data = bs.get(year, {})

        # detect bank vs company automatically
        text_blob = " ".join([str(k).lower() for k in year_data.keys()])
        is_bank = "due to banks" in text_blob or "loans and advances" in text_blob

        candidates = BANK_BS_CANDIDATES if is_bank else COMPANY_BS_CANDIDATES

        extracted_year = _extract_year(year_data, candidates)
        accounting_pass = _validate_accounting(extracted_year)

        for label, value in extracted_year.items():
            confidence = 0.6
            if value is not None:
                confidence += 0.2
            if accounting_pass:
                confidence += 0.2
            else:
                confidence -= 0.3

            confidence = max(0.1, min(confidence, 0.98))

            results.append(
                {
                    "label": label,
                    "value": value,
                    "year": year,
                    "confidence": confidence,
                }
            )

    _continuity_boost(results)
    return results