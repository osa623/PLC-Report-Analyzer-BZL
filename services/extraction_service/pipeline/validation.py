from typing import Any, Dict, List, Tuple

MANDATORY_FIELDS = {
    "income_statement": ["revenue_or_interest_income", "net_profit"],
    "balance_sheet": ["total_assets", "total_liabilities"],
    "cashflow_statement": ["operating_cash_flow"],
}

def validate_extracted_statements(
    statements: Dict[str, Any], 
    previous_years_statements: List[Dict[str, Any]] = None
) -> Tuple[bool, List[str], Dict[str, Any]]:
    """
    Validates the extracted statements.
    Returns:
        is_valid: bool
        missing_fields: list of missing mandatory field paths
        clean_statements: statements with anomalies removed
    """
    if previous_years_statements is None:
        previous_years_statements = []

    missing_fields = []
    clean_statements = {}

    for section in ["balance_sheet", "income_statement", "cashflow_statement"]:
        clean_statements[section] = {}
        section_data = statements.get(section) if isinstance(statements.get(section), dict) else {}
        
        # Check mandatory fields
        if section in MANDATORY_FIELDS:
            for field in MANDATORY_FIELDS[section]:
                val = section_data.get(field)
                if not isinstance(val, (int, float)):
                    missing_fields.append(f"{section}.{field}")
        
        # Check for anomalies and clean
        for field, value in section_data.items():
            if not isinstance(value, (int, float)):
                clean_statements[section][field] = value
                continue
                
            is_anomaly = False
            
            # Anomaly: Identical values across years (excluding 0)
            if value != 0:
                for prev_stmt in previous_years_statements:
                    prev_section = prev_stmt.get(section) if isinstance(prev_stmt.get(section), dict) else {}
                    prev_val = prev_section.get(field)
                    if isinstance(prev_val, (int, float)) and prev_val == value:
                        # Identical value across years is highly suspicious
                        is_anomaly = True
                        break
                        
            # Anomaly: Extreme jumps (>50x)
            if not is_anomaly and value != 0:
                for prev_stmt in previous_years_statements:
                    prev_section = prev_stmt.get(section) if isinstance(prev_stmt.get(section), dict) else {}
                    prev_val = prev_section.get(field)
                    if isinstance(prev_val, (int, float)) and prev_val != 0:
                        ratio = abs(value / prev_val)
                        if ratio > 50 or ratio < 1/50:
                            is_anomaly = True
                            break

            if not is_anomaly:
                clean_statements[section][field] = value

    # Check nulls percentage
    total_fields = 0
    null_fields = 0
    for section_data in clean_statements.values():
        total_fields += len(section_data)
        for val in section_data.values():
            if val is None:
                null_fields += 1

    if total_fields > 0 and (null_fields / total_fields) > 0.4:
        # Too many nulls
        is_valid = False
    else:
        is_valid = len(missing_fields) == 0

    return is_valid, missing_fields, clean_statements
