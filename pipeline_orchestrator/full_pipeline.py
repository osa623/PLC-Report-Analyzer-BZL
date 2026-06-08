from __future__ import annotations

import json
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from platform_core.shared_infra.job_status import init_pipeline_stages, update_pipeline_stage
from platform_core.shared_infra.redis_client import get_json, get_redis_client, set_json

from services.analysis_service.normalized_results_adapter import load_canonical_analysis_dataset
from services.analysis_service.strict_pipeline import build_strict_analysis_result
from services.extraction_service.canonical_results import (
    CANONICAL_MISSING_ERROR,
    persist_normalized_results,
)
from services.extraction_service.src.pipeline.pdf_image_orchestrator import process_annual_reports
from services.reporting_service.strict_pipeline import build_report_from_analytics

from pipeline_orchestrator.redis_artifacts import (
    save_extraction_artifacts,
    save_analysis_artifacts,
    save_report_artifacts,
    save_pipeline_metadata,
    update_document_status,
)


PIPELINE_TTL_SECONDS = int(os.environ.get("PIPELINE_TTL_SECONDS", "86400"))


def _workspace_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _logs_root() -> Path:
    return _workspace_root() / "logs"


def _collect_pdf_paths(pdf_folder_path: str) -> list[Path]:
    root = Path(pdf_folder_path).expanduser().resolve()
    if root.is_file() and root.suffix.lower() == ".pdf":
        return [root]
    if root.is_dir():
        return sorted(path.resolve() for path in root.rglob("*.pdf"))
    return []


def _slugify(value: str) -> str:
    value = value.strip()
    if not value:
        return "unknown-company"
    safe = []
    for char in value:
        if char.isalnum():
            safe.append(char.lower())
        elif char in {" ", "_", "-", "."}:
            safe.append("-")
    slug = "".join(safe).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug or "unknown-company"


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False, default=str), encoding="utf-8")


def _normalized_results_path() -> Path:
    return _workspace_root() / "services" / "extraction_service" / "normalized_results.json"


def _load_normalized_results() -> list[dict[str, Any]] | None:
    path = _normalized_results_path()
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else [data]


def _append_log(log_file: Path, message: str) -> None:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().isoformat(timespec="seconds")
    with log_file.open("a", encoding="utf-8") as handle:
        handle.write(f"[{timestamp}] {message}\n")


def _prepare_log_dir(company_name: str, pdf_path: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    company_slug = _slugify(company_name or pdf_path.stem)
    return _logs_root() / f"{company_slug}_{stamp}"


def _process_pdf(pdf_path: Path, report_id: str, redis_client) -> dict[str, Any]:
    """Process a single PDF through the full pipeline and save all artifacts to Redis."""
    _append_log(Path.cwd() / "logs" / "pipeline-bootstrap.log", f"Starting {pdf_path.name}")

    # Track document status
    update_document_status(redis_client, report_id, pdf_path.name, "running", "EXTRACTION", PIPELINE_TTL_SECONDS)

    # ── STAGE 1: EXTRACTION ──────────────────────────────────────────────
    update_pipeline_stage(
        redis_client, report_id, "EXTRACTION", "running", PIPELINE_TTL_SECONDS,
        {"pdf_name": pdf_path.name, "stage": "Locating statement pages"},
    )

    raw_results = process_annual_reports([pdf_path.read_bytes()])
    raw_result = raw_results[0] if raw_results else {"pdf_name": pdf_path.name, "error": "No extraction result returned"}
    normalized_records = persist_normalized_results([raw_result], [pdf_path.name])

    analysis_dataset = load_canonical_analysis_dataset()
    company_name = str(analysis_dataset.get("company_name") or pdf_path.stem)
    log_dir = _prepare_log_dir(company_name, pdf_path)
    log_file = log_dir / "pipeline.log"

    _append_log(log_file, f"Upload received: {pdf_path.name}")
    _append_log(log_file, "Locating statement pages")
    _append_log(log_file, "Extracting financial statements")
    _write_json(log_dir / "normalized_results.json", normalized_records)

    # ── Save extraction artifacts to Redis ──
    save_extraction_artifacts(redis_client, report_id, analysis_dataset, PIPELINE_TTL_SECONDS)

    # ── Persist to MongoDB for long-term storage ──
    try:
        from platform_core.company_repository import upsert_company_financials
        years_data = analysis_dataset.get("years") or analysis_dataset.get("financial_graph") or {}
        if years_data:
            upsert_company_financials(company_name, "General", years_data)
    except Exception as mongo_err:
        import logging
        logging.getLogger(__name__).warning("MongoDB persistence failed (non-fatal): %s", mongo_err)

    extraction_status = "completed" if analysis_dataset.get("years") else "failed"
    update_pipeline_stage(
        redis_client, report_id, "EXTRACTION", extraction_status, PIPELINE_TTL_SECONDS,
        {"pdf_name": pdf_path.name, "company_name": company_name, "artifacts": ["normalized_results.json"]},
    )
    _append_log(log_file, f"Extraction {extraction_status}")

    if extraction_status == "failed":
        # Save extraction failure diagnostic to Redis
        failure_info = {
            "pdfs_processed": 1,
            "years_detected": [],
            "error": "No financial years extracted from document",
        }
        set_json(redis_client, f"report:{report_id}:extraction_failure", failure_info, PIPELINE_TTL_SECONDS)
        raise RuntimeError(CANONICAL_MISSING_ERROR)

    # ── STAGE 2: ANALYSIS ────────────────────────────────────────────────
    update_document_status(redis_client, report_id, pdf_path.name, "running", "ANALYSIS", PIPELINE_TTL_SECONDS)
    
    analysis_start_time = datetime.now().isoformat()
    
    update_pipeline_stage(
        redis_client, report_id, "ANALYSIS", "running", PIPELINE_TTL_SECONDS,
        {
            "pdf_name": pdf_path.name, 
            "company_name": company_name, 
            "stage": "Running financial analysis",
            "analysis_start_time": analysis_start_time,
            "calculation_progress": "started",
            "score_ready": False
        },
    )
    _append_log(log_file, "Running financial analysis")

    analysis_result = build_strict_analysis_result(analysis_dataset)
    _write_json(log_dir / "analytics.json", analysis_result)

    # ── Save analysis artifacts to Redis ──
    save_analysis_artifacts(redis_client, report_id, analysis_dataset, analysis_result, PIPELINE_TTL_SECONDS)

    # ── Persist analysis to MongoDB ──
    try:
        from platform_core.company_repository import save_analysis_result, save_analysis_history_entry, _slugify
        company_slug = _slugify(company_name)
        save_analysis_result(company_slug, report_id, analysis_result)
        scores = analysis_result.get("scores", {})
        save_analysis_history_entry(company_slug, report_id, scores)
    except Exception as mongo_err:
        import logging
        logging.getLogger(__name__).warning("MongoDB analysis persistence failed (non-fatal): %s", mongo_err)

    analysis_status = "completed" if analysis_result.get("status") == "COMPLETED" else "failed"
    update_pipeline_stage(
        redis_client, report_id, "ANALYSIS", analysis_status, PIPELINE_TTL_SECONDS,
        {
            "pdf_name": pdf_path.name, 
            "company_name": company_name, 
            "artifacts": ["analytics.json"],
            "analysis_start_time": analysis_start_time,
            "analysis_end_time": datetime.now().isoformat(),
            "calculation_progress": "completed",
            "score_ready": True
        },
    )
    _append_log(log_file, f"Analysis {analysis_status}")

    # ── STAGE 3: REPORTING ───────────────────────────────────────────────
    update_document_status(redis_client, report_id, pdf_path.name, "running", "REPORTING", PIPELINE_TTL_SECONDS)
    update_pipeline_stage(
        redis_client, report_id, "REPORTING", "running", PIPELINE_TTL_SECONDS,
        {"pdf_name": pdf_path.name, "company_name": company_name, "stage": "Generating final report"},
    )
    _append_log(log_file, "Generating final report")

    analytics_payload = get_json(redis_client, f"report:{report_id}:analytics", default={})
    if not isinstance(analytics_payload, dict) or not analytics_payload:
        raise RuntimeError("analytics.json not found")
    report_result = build_report_from_analytics(analytics_payload)
    _write_json(log_dir / "final_report.json", report_result)

    # ── Save report artifacts to Redis ──
    save_report_artifacts(redis_client, report_id, report_result, PIPELINE_TTL_SECONDS)

    reporting_status = "completed" if isinstance(report_result, dict) else "failed"
    update_pipeline_stage(
        redis_client, report_id, "REPORTING", reporting_status, PIPELINE_TTL_SECONDS,
        {"pdf_name": pdf_path.name, "company_name": company_name, "artifacts": ["final_report.json"]},
    )
    _append_log(log_file, "Completed")

    # Track document as completed
    update_document_status(redis_client, report_id, pdf_path.name, "completed", "DONE", PIPELINE_TTL_SECONDS)

    return {
        "pdf_name": pdf_path.name,
        "company_name": company_name,
        "log_dir": str(log_dir),
        "normalized_results": "normalized_results.json",
        "analysis": analysis_result,
        "report": report_result,
    }


def _process_pdf_batch(pdf_paths: list[Path], report_id: str, redis_client) -> dict[str, Any]:
    """Process multiple annual reports as one multi-year financial dataset."""
    pdf_names = [path.name for path in pdf_paths]
    batch_label = ", ".join(pdf_names)
    _append_log(Path.cwd() / "logs" / "pipeline-bootstrap.log", f"Starting batch: {batch_label}")

    for pdf_path in pdf_paths:
        update_document_status(redis_client, report_id, pdf_path.name, "running", "EXTRACTION", PIPELINE_TTL_SECONDS)

    update_pipeline_stage(
        redis_client, report_id, "EXTRACTION", "running", PIPELINE_TTL_SECONDS,
        {"pdf_names": pdf_names, "stage": "Locating statement pages"},
    )

    raw_results = process_annual_reports([pdf_path.read_bytes() for pdf_path in pdf_paths])
    normalized_records = persist_normalized_results(raw_results, pdf_names)
    analysis_dataset = load_canonical_analysis_dataset()

    company_name = str(analysis_dataset.get("company_name") or pdf_paths[-1].stem)
    log_dir = _prepare_log_dir(company_name, pdf_paths[-1])
    log_file = log_dir / "pipeline.log"
    _append_log(log_file, f"Batch upload received: {batch_label}")
    _append_log(log_file, "Extracting and normalizing financial statements")
    _write_json(log_dir / "normalized_results.json", normalized_records)

    save_extraction_artifacts(redis_client, report_id, analysis_dataset, PIPELINE_TTL_SECONDS)

    detected_years = sorted(
        [year for year in (analysis_dataset.get("years") or {}) if isinstance(year, str) and year.isdigit()],
        key=int,
    )
    extraction_status = "completed" if detected_years else "failed"
    update_pipeline_stage(
        redis_client, report_id, "EXTRACTION", extraction_status, PIPELINE_TTL_SECONDS,
        {
            "pdf_names": pdf_names,
            "company_name": company_name,
            "detected_years": detected_years,
            "artifacts": ["normalized_results.json"],
        },
    )
    for pdf_path in pdf_paths:
        update_document_status(redis_client, report_id, pdf_path.name, extraction_status, "EXTRACTION", PIPELINE_TTL_SECONDS)
    _append_log(log_file, f"Extraction {extraction_status}; detected years: {detected_years}")

    if extraction_status == "failed":
        set_json(redis_client, f"report:{report_id}:extraction_failure", {
            "pdfs_processed": len(pdf_paths),
            "years_detected": [],
            "error": "No financial years extracted from batch",
        }, PIPELINE_TTL_SECONDS)
        raise RuntimeError(CANONICAL_MISSING_ERROR)

    try:
        from platform_core.company_repository import upsert_company_financials
        years_data = analysis_dataset.get("years") or analysis_dataset.get("financial_graph") or {}
        if years_data:
            upsert_company_financials(company_name, "General", years_data)
    except Exception as mongo_err:
        import logging
        logging.getLogger(__name__).warning("MongoDB persistence failed (non-fatal): %s", mongo_err)

    for pdf_path in pdf_paths:
        update_document_status(redis_client, report_id, pdf_path.name, "running", "ANALYSIS", PIPELINE_TTL_SECONDS)

    analysis_start_time = datetime.now().isoformat()
    update_pipeline_stage(
        redis_client, report_id, "ANALYSIS", "running", PIPELINE_TTL_SECONDS,
        {
            "pdf_names": pdf_names,
            "company_name": company_name,
            "stage": "Running financial analysis",
            "analysis_start_time": analysis_start_time,
            "calculation_progress": "started",
            "score_ready": False,
        },
    )
    _append_log(log_file, "Running combined financial analysis")

    analysis_result = build_strict_analysis_result(analysis_dataset)
    _write_json(log_dir / "analytics.json", analysis_result)
    save_analysis_artifacts(redis_client, report_id, analysis_dataset, analysis_result, PIPELINE_TTL_SECONDS)

    try:
        from platform_core.company_repository import save_analysis_result, save_analysis_history_entry, _slugify
        company_slug = _slugify(company_name)
        save_analysis_result(company_slug, report_id, analysis_result)
        save_analysis_history_entry(company_slug, report_id, analysis_result.get("scores", {}))
    except Exception as mongo_err:
        import logging
        logging.getLogger(__name__).warning("MongoDB analysis persistence failed (non-fatal): %s", mongo_err)

    analysis_status = "completed" if analysis_result.get("status") == "COMPLETED" else "failed"
    update_pipeline_stage(
        redis_client, report_id, "ANALYSIS", analysis_status, PIPELINE_TTL_SECONDS,
        {
            "pdf_names": pdf_names,
            "company_name": company_name,
            "valid_years": analysis_result.get("valid_years", []),
            "artifacts": ["analytics.json"],
            "analysis_start_time": analysis_start_time,
            "analysis_end_time": datetime.now().isoformat(),
            "calculation_progress": "completed",
            "score_ready": True,
        },
    )
    for pdf_path in pdf_paths:
        update_document_status(redis_client, report_id, pdf_path.name, analysis_status, "ANALYSIS", PIPELINE_TTL_SECONDS)
    _append_log(log_file, f"Analysis {analysis_status}")

    for pdf_path in pdf_paths:
        update_document_status(redis_client, report_id, pdf_path.name, "running", "REPORTING", PIPELINE_TTL_SECONDS)
    update_pipeline_stage(
        redis_client, report_id, "REPORTING", "running", PIPELINE_TTL_SECONDS,
        {"pdf_names": pdf_names, "company_name": company_name, "stage": "Generating final report"},
    )
    _append_log(log_file, "Generating final report")

    analytics_payload = get_json(redis_client, f"report:{report_id}:analytics", default={})
    if not isinstance(analytics_payload, dict) or not analytics_payload:
        analytics_payload = analysis_result
    report_result = build_report_from_analytics(analytics_payload)
    _write_json(log_dir / "final_report.json", report_result)
    save_report_artifacts(redis_client, report_id, report_result, PIPELINE_TTL_SECONDS)

    reporting_status = "completed" if isinstance(report_result, dict) else "failed"
    update_pipeline_stage(
        redis_client, report_id, "REPORTING", reporting_status, PIPELINE_TTL_SECONDS,
        {"pdf_names": pdf_names, "company_name": company_name, "artifacts": ["final_report.json"]},
    )
    for pdf_path in pdf_paths:
        update_document_status(redis_client, report_id, pdf_path.name, "completed", "DONE", PIPELINE_TTL_SECONDS)
    _append_log(log_file, "Completed")

    return {
        "pdf_names": pdf_names,
        "company_name": company_name,
        "log_dir": str(log_dir),
        "normalized_results": "normalized_results.json",
        "detected_years": detected_years,
        "analysis": analysis_result,
        "report": report_result,
    }


def run_full_pipeline(pdf_paths_or_folder: list[str] | str, report_id: str | None = None) -> dict[str, Any]:
    """Orchestrate the full pipeline for up to 5 PDFs as one dataset."""
    if isinstance(pdf_paths_or_folder, list):
        pdf_paths = [Path(p).expanduser().resolve() for p in pdf_paths_or_folder]
    else:
        pdf_paths = _collect_pdf_paths(pdf_paths_or_folder)
        
    if not pdf_paths:
        raise FileNotFoundError(f"No PDF files found at {pdf_paths_or_folder}")

    pdf_paths = pdf_paths[:5]
    report_id = report_id or str(uuid.uuid4())

    redis_client = get_redis_client(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    init_pipeline_stages(redis_client, report_id, PIPELINE_TTL_SECONDS)

    # ── Save pipeline metadata so the frontend recognises the upload ──
    save_pipeline_metadata(redis_client, report_id, pdf_paths, PIPELINE_TTL_SECONDS)

    results: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []

    try:
        results.append(_process_pdf_batch(pdf_paths, report_id, redis_client))
    except Exception as exc:
        pdf_names = [path.name for path in pdf_paths]
        failures.append({"pdf_names": pdf_names, "error": str(exc)})
        for pdf_path in pdf_paths:
            update_document_status(redis_client, report_id, pdf_path.name, "failed", "EXTRACTION", PIPELINE_TTL_SECONDS)

        failure_log_dir = _prepare_log_dir(pdf_paths[0].stem, pdf_paths[0])
        _append_log(failure_log_dir / "pipeline.log", f"FAILED: {exc}")
        _write_json(failure_log_dir / "normalized_results.json", {"pdf_names": pdf_names, "error": str(exc)})
        _write_json(failure_log_dir / "analytics.json", {"pdf_names": pdf_names, "error": str(exc)})
        _write_json(failure_log_dir / "final_report.json", {"pdf_names": pdf_names, "error": str(exc)})
        update_pipeline_stage(
            redis_client, report_id, "EXTRACTION", "failed", PIPELINE_TTL_SECONDS,
            {"pdf_names": pdf_names, "error": str(exc)},
        )
        update_pipeline_stage(
            redis_client, report_id, "ANALYSIS", "skipped", PIPELINE_TTL_SECONDS,
            {"pdf_names": pdf_names, "error": str(exc)},
        )
        update_pipeline_stage(
            redis_client, report_id, "REPORTING", "skipped", PIPELINE_TTL_SECONDS,
            {"pdf_names": pdf_names, "error": str(exc)},
        )

    overall_status = "completed" if results and not failures else "failed"
    if results:
        final_report_payload = {
            "report_id": report_id,
            "status": overall_status,
            "processed_count": len(pdf_paths),
            "failed_count": len(failures),
            "results": results,
            "failures": failures,
        }
        set_json(redis_client, f"report:{report_id}:final_pipeline_result", final_report_payload, PIPELINE_TTL_SECONDS)
    else:
        final_report_payload = {
            "report_id": report_id,
            "status": "failed",
            "processed_count": 0,
            "failed_count": len(failures),
            "results": [],
            "failures": failures,
        }

    return final_report_payload
