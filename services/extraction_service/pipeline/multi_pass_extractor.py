from typing import Any, Dict, List
import copy

from .annual_backend_adapter import extract_with_annual_backend
from .gemini_statement_extractor import (
    _section_anchored_extract,
    _fallback_regex_extract,
    _normalize_statements,
    _coalesce_statement_sources,
    _normalize_mandatory_magnitude,
    _clamp_income_outliers,
    _repair_balance_identity,
    _repair_cashflow_consistency,
    _normalize_net_income_linkage,
    _maybe_downscale_unrealistic_values,
    _normalize_unit_multiplier,
    _extract_detected_years,
    _document_year,
    MANDATORY_METRICS
)
from .validation import validate_extracted_statements


def _get_document_type(pass1_outputs: List[Dict[str, Any]]) -> str:
    for output in pass1_outputs:
        dtype = output.get("document_type")
        if dtype in ("bank", "company"):
            return dtype
    return "company"


def run_multi_pass_extraction(
    full_text: str,
    file_path: str,
    report_id: str,
    focus_fields: List[str] = None
) -> Dict[str, Any]:
    
    currency, multiplier, unit_label, confidence_unit = _normalize_unit_multiplier(full_text)
    detected_years = _extract_detected_years(full_text)
    doc_year = _document_year(full_text)
    analysis_years = [int(doc_year)] if isinstance(doc_year, int) else sorted({int(y) for y in detected_years if isinstance(y, int)})

    if currency != "LKR":
        return {
            "status": "failed",
            "report_id": report_id,
            "file_path": file_path,
            "document_year": doc_year,
            "detected_years": detected_years,
            "analysis_years": analysis_years,
            "metrics_extracted_count": 0,
            "missing_required_metrics": MANDATORY_METRICS,
            "failure_reason": "Only LKR-denominated statement extraction is supported",
            "confidence": "low"
        }

    # PASS 1: STRICT EXTRACTION
    pass1_outputs = []
    try:
        pass1_outputs = extract_with_annual_backend(file_path, full_text, report_id)
    except Exception as e:
        print(f"Pass 1 failed with exception: {e}")

    document_type = _get_document_type(pass1_outputs)
    
    # We will pick the latest year output from Pass 1, if it exists and is valid
    best_output = None
    if pass1_outputs:
        sorted_outputs = sorted(
            [o for o in pass1_outputs if isinstance(o, dict)],
            key=lambda item: int(item.get("document_year", 0) or 0),
            reverse=True,
        )
        for output in sorted_outputs:
            statements = output.get("statements", {})
            is_valid, missing, clean_statements = validate_extracted_statements(statements, [])
            if is_valid:
                best_output = output
                best_output["statements"] = clean_statements
                best_output["strict_statements"] = clean_statements
                break

    if best_output:
        best_output["status"] = "completed"
        return best_output

    # PASS 2: RELAXED EXTRACTION
    # Triggered if Pass 1 is missing or invalid
    normalized_section = _normalize_statements(_section_anchored_extract(full_text), multiplier, document_type)
    normalized_fallback = _normalize_statements(_fallback_regex_extract(full_text), multiplier, document_type)

    merged_statements = _coalesce_statement_sources(
        {"balance_sheet": {}, "income_statement": {}, "cashflow_statement": {}, "equity_statement": {}},
        normalized_section,
        normalized_fallback,
        document_type,
    )
    
    merged_statements = _normalize_mandatory_magnitude(merged_statements, multiplier)
    merged_statements = _clamp_income_outliers(merged_statements)
    merged_statements = _repair_balance_identity(merged_statements)
    merged_statements = _repair_cashflow_consistency(merged_statements, full_text)
    merged_statements = _normalize_net_income_linkage(merged_statements, full_text)
    merged_statements, downscale_factor = _maybe_downscale_unrealistic_values(merged_statements)
    
    is_valid, missing_fields, clean_statements = validate_extracted_statements(merged_statements, [])
    
    # PASS 3: AI ASSISTED RECOVERY (Skipped for now as local regex mapping is comprehensive)
    # Could be implemented here to map unmapped line items to missing fields.

    extracted_count = 0
    for section in clean_statements.values():
        for val in section.values():
            if val is not None:
                extracted_count += 1
                
    extraction_confidence = min(1.0, extracted_count / float(len(MANDATORY_METRICS)))
    
    if is_valid and extracted_count >= 5:
        status = "completed"
        failure_reason = None
    else:
        # Failure handling -> return partial status rather than hard failure
        status = "partial"
        failure_reason = "Missing mandatory fields or too many nulls"

    result = {
        "status": status,
        "report_id": report_id,
        "file_path": file_path,
        "document_type": document_type,
        "document_year": doc_year,
        "detected_years": detected_years,
        "analysis_years": analysis_years,
        "currency": currency,
        "unit_multiplier": multiplier,
        "unit_detected": unit_label,
        "confidence_unit": confidence_unit,
        "strict_statements": clean_statements,
        "statements": clean_statements,
        "value_trace": {},
        "metrics_extracted_count": extracted_count,
        "missing_required_metrics": missing_fields,
        "missing_fields": missing_fields, # Added for partial schema
        "quality_issues": [],
        "hard_quality_issues": [],
        "extraction_confidence": extraction_confidence,
        "confidence": "low" if status == "partial" else "high",
        "downscale_factor": downscale_factor,
        "failure_reason": failure_reason,
    }
    
    return result
