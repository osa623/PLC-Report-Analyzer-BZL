"""
Pipeline Bridge — connects Gemini extraction output to the strict analysis + report pipeline.

This module converts the Gemini full-report extraction format into the strict
extraction dataset format, then chains analysis and report generation.
No new services. Just glue code between existing modules.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import uuid as _uuid
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Ensure repo root is importable
# ---------------------------------------------------------------------------
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# ---------------------------------------------------------------------------
# Import strict pipeline functions (graceful fallback)
# ---------------------------------------------------------------------------
try:
    from services.extraction_service.strict_pipeline import build_strict_extraction_dataset
    from services.analysis_service.strict_pipeline import (
        build_strict_analysis_result,
        build_validation_failed_diagnostic,
    )
    from services.reporting_service.strict_pipeline import build_strict_report

    PIPELINE_AVAILABLE = True
except ImportError as _err:
    logger.warning("Strict pipeline imports unavailable: %s", _err)
    PIPELINE_AVAILABLE = False


# ---------------------------------------------------------------------------
# Label → canonical field mapping (covers bank + company report labels)
# ---------------------------------------------------------------------------
_LABEL_MAP: dict[str, tuple[str, str]] = {}

_INCOME_LABELS = {
    "revenue": "revenue",
    "total revenue": "revenue",
    "gross income": "revenue",
    "interest income": "revenue",
    "net interest income": "net_interest_income",
    "total operating income": "total_operating_income",
    "cost of sales": "cost_of_sales",
    "cost of revenue": "cost_of_sales",
    "gross profit": "gross_profit",
    "operating profit": "operating_profit",
    "operating income": "operating_profit",
    "profit before tax": "profit_before_tax",
    "profit before income tax": "profit_before_tax",
    "net profit": "net_profit",
    "net income": "net_profit",
    "profit for the year": "net_profit",
    "profit for the period": "net_profit",
    "operating expenses": "operating_expenses",
    "total operating expenses": "operating_expenses",
    "interest expense": "interest_expense",
    "basic earnings per ordinary share": "eps",
    "basic earnings per share": "eps",
    "earnings per share": "eps",
    "dividend per share": "dividends_per_share",
}
for _lbl, _fld in _INCOME_LABELS.items():
    _LABEL_MAP[_lbl] = ("income_statement", _fld)

_BALANCE_LABELS = {
    "total assets": "total_assets",
    "total liabilities": "total_liabilities",
    "total equity": "total_equity",
    "current assets": "current_assets",
    "current liabilities": "current_liabilities",
    "cash and cash equivalents": "cash_and_cash_equivalents",
    "cash and equivalents": "cash_and_cash_equivalents",
    "total debt": "total_debt",
    "borrowings": "total_debt",
    "inventory": "inventory",
    "inventories": "inventory",
    "market price per share": "market_price",
}
for _lbl, _fld in _BALANCE_LABELS.items():
    _LABEL_MAP[_lbl] = ("balance_sheet", _fld)

_CASH_LABELS = {
    "operating cash flow": "operating_cash_flow",
    "net cash from operating activities": "operating_cash_flow",
    "net cash (used in)/generated from operating activities": "operating_cash_flow",
    "cash flows from operating activities": "operating_cash_flow",
    "investing cash flow": "investing_cash_flow",
    "net cash from investing activities": "investing_cash_flow",
    "net cash used in investing activities": "investing_cash_flow",
    "cash flows from investing activities": "investing_cash_flow",
    "financing cash flow": "financing_cash_flow",
    "net cash from financing activities": "financing_cash_flow",
    "cash flows from financing activities": "financing_cash_flow",
    "net cash flow": "net_cash_flow",
    "net increase/(decrease) in cash": "net_cash_flow",
    "net increase in cash": "net_cash_flow",
    "net decrease in cash": "net_cash_flow",
    "opening cash": "opening_cash",
    "cash at beginning": "opening_cash",
    "cash and cash equivalents at the beginning": "opening_cash",
    "closing cash": "closing_cash",
    "cash at end": "closing_cash",
    "cash and cash equivalents at the end": "closing_cash",
}
for _lbl, _fld in _CASH_LABELS.items():
    _LABEL_MAP[_lbl] = ("cash_flow", _fld)

_YEAR_RE = re.compile(r"(20\d{2})")
_DEFAULT_NORMALIZED_RESULTS_PATH = _REPO_ROOT / "services" / "extraction_service" / "normalized_results.json"
_OUTPUTS_ROOT = _REPO_ROOT / "outputs"


def generate_batch_id() -> str:
    """Generate a unique batch identifier."""
    return _uuid.uuid4().hex[:12]


def get_batch_output_dir(batch_id: str) -> Path:
    """Return (and create) the output directory for a given batch."""
    batch_dir = _OUTPUTS_ROOT / batch_id
    batch_dir.mkdir(parents=True, exist_ok=True)
    return batch_dir


def _parse_number(value: Any) -> float | None:
    """Attempt to parse a numeric value from various formats."""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if value is None:
        return None
    text = str(value).strip()
    if not text or text in {"-", "—", "–", "N/A", "NA", "n/a"}:
        return None
    negative = text.startswith("(") and text.endswith(")")
    text = text.strip("()")
    text = text.replace(",", "").replace(" ", "").replace("*", "")
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    return -abs(number) if negative else number


def _find_canonical(label: str) -> tuple[str, str] | None:
    """Match a row label to (section, field)."""
    normalized = re.sub(r"\s+", " ", label.lower()).strip().rstrip(":")
    # Exact match first
    if normalized in _LABEL_MAP:
        return _LABEL_MAP[normalized]
    # Substring match
    for key, mapping in _LABEL_MAP.items():
        if key in normalized:
            return mapping
    return None


def _extract_year_columns(headers: list) -> dict[int, str]:
    """
    Determine which value-array indices correspond to which years.

    headers = ["Item", "2023", "2022"]  → {0: "2023", 1: "2022"}
    The first non-year column is skipped.
    """
    first_year_idx = None
    for i, h in enumerate(headers):
        if _YEAR_RE.search(str(h)):
            first_year_idx = i
            break
    if first_year_idx is None:
        return {}

    year_positions: dict[int, str] = {}
    for i in range(first_year_idx, len(headers)):
        m = _YEAR_RE.search(str(headers[i]))
        if m:
            value_idx = i - first_year_idx
            year_positions[value_idx] = m.group(1)
    return year_positions


def _process_section_rows(
    rows: list[dict],
    year_positions: dict[int, str],
    years_data: dict[str, dict[str, dict[str, float]]],
) -> None:
    """Process rows and populate years_data."""
    for row in rows:
        if not isinstance(row, dict):
            continue
        label = (row.get("item") or row.get("label") or "").strip()
        if not label:
            continue
        mapping = _find_canonical(label)
        if not mapping:
            continue
        section_name, field_name = mapping
        values = row.get("values", [])
        if not isinstance(values, list):
            continue
        for idx, year in year_positions.items():
            if idx < len(values):
                v = _parse_number(values[idx])
                if v is not None:
                    if year not in years_data:
                        years_data[year] = {
                            "income_statement": {},
                            "balance_sheet": {},
                            "cash_flow": {},
                        }
                    years_data[year][section_name][field_name] = v


def _process_new_format(
    rows: list[dict],
    section_name: str,
    years_data: dict[str, dict[str, dict[str, float]]]
) -> None:
    """Process the new format where years are encoded in keys like '2015 (Group)'."""
    for row in rows:
        if not isinstance(row, dict):
            continue
        label = (row.get("label") or row.get("item") or "").strip()
        if not label:
            continue
        mapping = _find_canonical(label)
        if not mapping:
            continue
        _, field_name = mapping
        
        year_vals = {}
        for key, value in row.items():
            if key.lower() in ["label", "item", "note"]:
                continue
            m = _YEAR_RE.search(key)
            if m:
                year = m.group(1)
                parsed_val = _parse_number(value)
                if parsed_val is not None:
                    if year not in year_vals:
                        year_vals[year] = {"Group": None, "Bank": None, "Other": None}
                    
                    if "group" in key.lower():
                        year_vals[year]["Group"] = parsed_val
                    elif "bank" in key.lower() or "company" in key.lower():
                        year_vals[year]["Bank"] = parsed_val
                    else:
                        year_vals[year]["Other"] = parsed_val
                        
        for year, vals in year_vals.items():
            # Priority: Group > Bank > Other
            final_val = vals["Group"] if vals["Group"] is not None else (vals["Bank"] if vals["Bank"] is not None else vals["Other"])
            if final_val is not None:
                if year not in years_data:
                    years_data[year] = {
                        "income_statement": {},
                        "balance_sheet": {},
                        "cash_flow": {},
                    }
                years_data[year][section_name][field_name] = final_val


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def convert_gemini_to_strict(gemini_result: dict, filename: str = "") -> dict[str, Any]:
    """
    Convert Gemini full-report extraction output into the strict extraction
    dataset format expected by build_strict_analysis_result / build_strict_report.
    """
    record = {
        "statements": gemini_result,
        "document_name": filename,
        "pdf_name": filename
    }
    return build_strict_extraction_dataset([record])


def _run_strict_pipeline(
    strict_extraction: dict[str, Any],
    progress_callback=None,
    normalized_result: list[dict[str, Any]] | dict[str, Any] | None = None,
    normalized_results_path: str | Path | None = None,
    batch_id: str | None = None,
) -> dict[str, Any]:
    """Run analysis and reporting for an already-built strict dataset."""
    stages: dict[str, dict[str, Any]] = {
        "extraction": {"status": "pending"},
        "analysis": {"status": "pending"},
        "report": {"status": "pending"},
    }
    # ── Batch isolation ──
    if batch_id is None:
        batch_id = generate_batch_id()
    batch_dir = get_batch_output_dir(batch_id)
    _log_init_msg = f"Pipeline batch {batch_id} → {batch_dir}"

    logs: list[str] = []
    logs.append(f"[{datetime.now().isoformat(timespec='seconds')}] {_log_init_msg}")
    logger.info(_log_init_msg)

    def _log(msg: str):
        ts = datetime.now().isoformat(timespec="seconds")
        logs.append(f"[{ts}] {msg}")
        logger.info(msg)

    def _emit(step: int, total: int, message: str, stage: str, status: str):
        if progress_callback:
            progress_callback(step, total, message, {
                "pipeline_stage": stage,
                "status": status,
            })

    year_count = len(strict_extraction.get("years", {}))
    stages["extraction"]["status"] = "completed"
    stages["extraction"]["start_time"] = datetime.now().isoformat()
    stages["extraction"]["end_time"] = datetime.now().isoformat()
    _log(f"Strict extraction built: {year_count} years detected")
    _emit(2, 5, f"Extraction structured ({year_count} years). Running analysis...", "extraction", "completed")

    if not PIPELINE_AVAILABLE:
        _log("WARN: Strict pipeline modules not available. Skipping analysis and report.")
        stages["analysis"]["status"] = "skipped"
        stages["report"]["status"] = "skipped"
        return {
            "extraction": strict_extraction,
            "analysis": {"status": "PIPELINE_UNAVAILABLE"},
            "report": {"status": "PIPELINE_UNAVAILABLE"},
            "stages": stages,
            "logs": logs,
        }

    # Stage 2: Analysis
    _emit(3, 5, "Running financial analysis...", "analysis", "running")
    _log("Running strict analysis")
    stages["analysis"]["status"] = "running"
    stages["analysis"]["start_time"] = datetime.now().isoformat()

    try:
        analysis_result = build_strict_analysis_result(analysis_input)
    except Exception as exc:
        _log(f"Analysis failed: {exc}")
        analysis_result = build_validation_failed_diagnostic(strict_extraction, [str(exc)])

    stages["analysis"]["status"] = "completed"
    stages["analysis"]["end_time"] = datetime.now().isoformat()
    valid_years = analysis_result.get("valid_years", [])
    _log(f"Analysis complete. Valid years: {valid_years}")
    _emit(4, 5, f"Analysis complete ({len(valid_years)} valid years). Generating report...", "analysis", "completed")

    # Stage 3: Report
    _emit(4, 5, "Generating final report...", "report", "running")
    _log("Generating strict report")
    stages["report"]["status"] = "running"
    stages["report"]["start_time"] = datetime.now().isoformat()

    try:
        report_result = build_strict_report(strict_extraction, analysis_result)
    except Exception as exc:
        _log(f"Report generation failed: {exc}")
        report_result = {"status": "REPORT_FAILED", "error": str(exc)}

    stages["report"]["status"] = "completed"
    stages["report"]["end_time"] = datetime.now().isoformat()
    _log("Report generation complete")

    pipeline_output = {
        "batch_id": batch_id,
        "batch_dir": str(batch_dir),
        "extraction": strict_extraction,
        "extraction_metadata": {
            "source": strict_extraction.get("source", "legacy_extraction_conversion"),
            "normalized_results_consumed": normalized_results is not None,
            "normalized_record_count": len(normalized_results or []),
        },
        "normalized_dataset_metadata": analysis_result.get("normalized_dataset_metadata", {}),
        "completeness_metrics": analysis_result.get("completeness_metrics", {}),
        "sector_classification": analysis_result.get("sector_classification", {}),
        "bank_analysis": analysis_result.get("bank_analysis", {}),
        "group_analysis": analysis_result.get("group_analysis", {}),
        "ratio_analysis": analysis_result.get("ratio_analysis", {}),
        "growth_analysis": analysis_result.get("growth_analysis", {}),
        "validation_results": analysis_result.get("validation_results", {}),
        "confidence_scores": analysis_result.get("confidence_scores", {}),
        "reliability_scores": analysis_result.get("reliability_scores", {}),
        "risk_scores": analysis_result.get("risk_scores", {}),
        "diagnostics": analysis_result.get("diagnostics", []),
        "analysis": analysis_result,
        "report": report_result,
        "stages": stages,
        "logs": logs,
    }

    # Persist full results into the batch directory
    try:
        results_path = batch_dir / "full_pipeline_test_results.json"
        results_path.write_text(
            json.dumps(pipeline_output, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )
        _log(f"Batch results saved to {results_path}")
    except Exception as err:
        _log(f"Warning: Could not write batch results: {err}")

    return pipeline_output


def run_pipeline_for_extraction_records(
    extraction_records: list[dict[str, Any]],
    progress_callback=None,
) -> dict[str, Any]:
    """
    Run the full strict pipeline for a batch of normalized/extracted records.

    Use this for multi-report runs so all years are analyzed together.
    """
    if progress_callback:
        progress_callback(1, 5, "Converting extraction batch to structured format...", {
            "pipeline_stage": "extraction",
            "status": "running",
        })
    strict_extraction = build_strict_extraction_dataset(extraction_records)
    return _run_strict_pipeline(strict_extraction, progress_callback)


def run_pipeline_stages(
    gemini_result: dict,
    filename: str = "",
    progress_callback=None,
) -> dict[str, Any]:
    """
    Run the full pipeline: convert → analyze → report.

    Returns a dict with {extraction, analysis, report, stages, logs}.
    If strict pipeline is unavailable, returns partial results.
    """
    # Stage 1: Convert extraction
    if progress_callback:
        progress_callback(1, 5, "Converting extraction to structured format...", {
            "pipeline_stage": "extraction",
            "status": "running",
        })
    logger.info("Converting Gemini output to strict extraction dataset")

    strict_extraction = convert_gemini_to_strict(gemini_result, filename)
    return _run_strict_pipeline(strict_extraction, progress_callback)


def save_pipeline_logs(job_id: str, pipeline_result: dict) -> str | None:
    """Save per-job pipeline logs to data/logs/{job_id}/."""
    try:
        log_dir = Path(__file__).parent / "data" / "logs" / job_id
        log_dir.mkdir(parents=True, exist_ok=True)

        def _write(name: str, payload: Any):
            path = log_dir / name
            path.write_text(
                json.dumps(payload, indent=2, ensure_ascii=False, default=str),
                encoding="utf-8",
            )

        _write("extraction.json", pipeline_result.get("extraction", {}))
        _write("analysis.json", pipeline_result.get("analysis", {}))
        _write("report.json", pipeline_result.get("report", {}))

        log_file = log_dir / "pipeline.log"
        log_file.write_text(
            "\n".join(pipeline_result.get("logs", [])),
            encoding="utf-8",
        )

        logger.info("Pipeline logs saved to %s", log_dir)
        return str(log_dir)
    except Exception as exc:
        logger.error("Failed to save pipeline logs: %s", exc)
        return None
