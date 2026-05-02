import re
from typing import Any, Dict, List, Optional

# =========================================================
# STEP 4 — VALUE PARSING
# =========================================================
def parse_number(raw: Any) -> Optional[float]:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)

    s = str(raw).strip()
    if s == "" or s.upper() in ("N/A", "NULL", "-", "–"):
        return None

    # Handle (1,234) as negative
    s = s.replace(",", "").replace("$", "").replace("\xa0", "")
    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1]

    m = re.search(r"-?\d+(?:\.\d+)?", s)
    if not m:
        return None

    try:
        val = float(m.group(0))
        return -val if negative else val
    except Exception:
        return None

# =========================================================
# STEP 3 — ROW PROCESSING
# =========================================================
def clean_label(text: str) -> str:
    text = str(text).lower().strip()
    text = re.sub(r"^less\s*:?", "", text)
    text = re.sub(r"[\(\)\[\]:]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

# =========================================================
# CORE EXTRACTION ENGINE (STEPS 1-10)
# =========================================================
def extract_financial_data(
    table: List[List[Any]], 
    candidates: Dict[str, List[str]], 
    statement_type: str
) -> List[Dict[str, Any]]:
    """
    Extracts structured data from OCR-extracted table rows (list of lists).
    Implements the 10-step Financial Document Intelligence Engine logic.
    """
    if not table or not isinstance(table, list):
        return []

    # STEP 1 & 2 — TABLE HEADER ANALYSIS & COLUMN VALIDATION
    col_map: Dict[int, Dict[str, str]] = {}
    
    # Track entity per column
    entity_by_col = {}
    last_seen_entity = "company"
    
    data_start_idx = 0
    for r_idx, row in enumerate(table):
        # Determine if this row is a data row (has numbers in multiple columns)
        num_count = sum(1 for c in row if re.search(r"\d", str(c)) and not re.search(r"20\d{2}", str(c)))
        if num_count >= 2:
            data_start_idx = r_idx
            break
            
        for c_idx, cell in enumerate(row):
            cell_str = str(cell).lower().strip()
            if "group" in cell_str or "consolidated" in cell_str:
                entity_by_col[c_idx] = "group"
                last_seen_entity = "group"
            elif "company" in cell_str or "parent" in cell_str:
                entity_by_col[c_idx] = "company"
                last_seen_entity = "company"
                
    if data_start_idx == 0:
        data_start_idx = min(3, len(table))

    # Forward/backward fill entities
    for c_idx in range(max((len(r) for r in table), default=0)):
        if c_idx not in entity_by_col:
            # Look left
            left_entity = None
            for i in range(c_idx - 1, -1, -1):
                if i in entity_by_col:
                    left_entity = entity_by_col[i]
                    break
            if left_entity:
                entity_by_col[c_idx] = left_entity
            else:
                entity_by_col[c_idx] = "company"

    for r_idx in range(data_start_idx):
        row = table[r_idx]
        for c_idx, cell in enumerate(row):
            match = re.search(r"(20\d{2})", str(cell))
            if match:
                year = match.group(1)
                col_map[c_idx] = {"year": year, "entity": entity_by_col.get(c_idx, "company")}

    # If no valid year columns found -> LOW CONFIDENCE / ignore
    if not col_map:
        return []

    results: List[Dict[str, Any]] = []

    # Process Rows
    for row_idx in range(data_start_idx, len(table)):
        row = table[row_idx]
        if not row:
            continue
            
        # First non-empty cell = label
        label_raw = None
        label_col_idx = 0
        for c_idx, cell in enumerate(row):
            if cell and str(cell).strip() != "":
                label_raw = cell
                label_col_idx = c_idx
                break
                
        if not label_raw:
            continue
            
        clean_lbl = clean_label(label_raw)
        
        # Ignore purely textual or note rows
        if not clean_lbl or clean_lbl.startswith("note ") or len(clean_lbl) < 3:
            continue

        # STEP 5 — FINANCIAL LABEL MATCHING (FUZZY)
        best_label = None
        best_score = 0.0
        
        for std_label, keys in candidates.items():
            for k in keys:
                k_lower = k.lower()
                score = 0.0
                if k_lower == clean_lbl:
                    score = 100.0
                elif k_lower in clean_lbl:
                    score = (len(k_lower) / len(clean_lbl)) * 100.0
                    
                if score > best_score:
                    best_score = score
                    best_label = std_label

        if best_score < 60.0:  # Fuzzy match threshold
            continue

        # STEP 4 & 7 — VALUE PARSING & MULTI-YEAR STRUCTURING
        for c_idx, meta in col_map.items():
            if c_idx < len(row) and c_idx != label_col_idx:
                val = parse_number(row[c_idx])
                if val is not None:
                    # CONFIDENCE RULES
                    confidence = 0.5
                    if best_score >= 80.0:
                        confidence += 0.2  # label matched clearly
                    confidence += 0.2  # column mapping is valid
                    
                    # Output record (STEP 10)
                    results.append({
                        "statement": statement_type,
                        "year": meta["year"],
                        "entity": meta["entity"],
                        "label": best_label,
                        "value": val,
                        "confidence": min(0.95, round(confidence, 2))
                    })

    # STEP 9 — YEAR CONSISTENCY CHECK
    # Check for anomalies (e.g. identical values across years, or >10x difference)
    # We group by (entity, label)
    grouped_data = {}
    for r in results:
        key = (r["entity"], r["label"])
        if key not in grouped_data:
            grouped_data[key] = []
        grouped_data[key].append(r)

    validated_results = []
    for key, records in grouped_data.items():
        if len(records) > 1:
            # Sort by year
            records.sort(key=lambda x: x["year"])
            for i in range(1, len(records)):
                prev = records[i-1]["value"]
                curr = records[i]["value"]
                
                # If identical across years -> suspicious
                if prev == curr:
                    records[i]["confidence"] -= 0.3
                    records[i-1]["confidence"] -= 0.3
                    
                # If >10x difference -> anomaly
                elif prev != 0 and curr != 0:
                    ratio = abs(curr / prev) if prev != 0 else 0
                    if ratio > 10 or ratio < 0.1:
                        records[i]["confidence"] -= 0.4
                        
        for r in records:
            r["confidence"] = max(0.05, round(r["confidence"], 2))
            validated_results.append(r)

    return validated_results

