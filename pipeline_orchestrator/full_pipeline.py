from __future__ import annotations

import json
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from platform_core.shared_infra.job_status import init_pipeline_stages, update_pipeline_stage
from platform_core.shared_infra.redis_client import get_redis_client, set_json

from services.analysis_service.strict_pipeline import build_strict_analysis_result
from services.extraction_service.src.pipeline.pdf_image_orchestrator import process_annual_reports
from services.extraction_service.strict_pipeline import build_strict_extraction_dataset
from services.reporting_service.strict_pipeline import build_strict_report

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

    strict_extraction = build_strict_extraction_dataset([raw_result])
    company_name = str(strict_extraction.get("company_name") or pdf_path.stem)
    log_dir = _prepare_log_dir(company_name, pdf_path)
    log_file = log_dir / "pipeline.log"

    _append_log(log_file, f"Upload received: {pdf_path.name}")
    _append_log(log_file, "Locating statement pages")
    _append_log(log_file, "Extracting financial statements")
    _write_json(log_dir / "extraction.json", strict_extraction)

    # ── Save extraction artifacts to Redis ──
    save_extraction_artifacts(redis_client, report_id, strict_extraction, PIPELINE_TTL_SECONDS)

    # ── Persist to MongoDB for long-term storage ──
    try:
        from platform_core.company_repository import upsert_company_financials
        years_data = strict_extraction.get("years") or strict_extraction.get("financial_graph") or {}
        if years_data:
            upsert_company_financials(company_name, "General", years_data)
    except Exception as mongo_err:
        import logging
        logging.getLogger(__name__).warning("MongoDB persistence failed (non-fatal): %s", mongo_err)

    extraction_status = "completed" if strict_extraction.get("years") else "failed"
    update_pipeline_stage(
        redis_client, report_id, "EXTRACTION", extraction_status, PIPELINE_TTL_SECONDS,
        {"pdf_name": pdf_path.name, "company_name": company_name, "artifacts": ["extraction.json"]},
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

    def convert_strict_to_normalized_results(strict_ext: dict[str, Any]) -> list[dict[str, Any]]:
        financials = {}
        for y, y_data in strict_ext.get("years", {}).items():
            financials[y] = {
                "group": y_data,
                "bank": y_data,
                "company": y_data,
                "entity": y_data,
                "parent": y_data,
                "standalone": y_data,
            }
        return [
            {
                "company": strict_ext.get("company_name", "Unknown"),
                "company_name": strict_ext.get("company_name", "Unknown"),
                "financials": financials,
                "source_pdf": strict_ext.get("document_name", pdf_path.name),
            }
        ]

    normalized_results = convert_strict_to_normalized_results(strict_extraction)
    
    # Save the fresh normalized_results.json specific to the batch
    batch_out_dir = _workspace_root() / "outputs" / report_id
    batch_out_dir.mkdir(parents=True, exist_ok=True)
    _write_json(batch_out_dir / "normalized_results.json", normalized_results)
    _write_json(log_dir / "normalized_results.json", normalized_results)
    
    # Write to global path as well to keep legacy test suites happy
    global_norm_path = _workspace_root() / "services" / "extraction_service" / "normalized_results.json"
    _write_json(global_norm_path, normalized_results)

    analysis_input = {"normalized_results": normalized_results}
    analysis_result = build_strict_analysis_result(analysis_input)
    _write_json(log_dir / "analysis.json", analysis_result)

    # ── Save analysis artifacts to Redis ──
    save_analysis_artifacts(redis_client, report_id, strict_extraction, analysis_result, PIPELINE_TTL_SECONDS)

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
            "artifacts": ["analysis.json"],
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

    report_result = build_strict_report(strict_extraction, analysis_result)
    _write_json(log_dir / "report.json", report_result)

    # ── Save report artifacts to Redis ──
    save_report_artifacts(redis_client, report_id, report_result, PIPELINE_TTL_SECONDS)

    reporting_status = "completed" if isinstance(report_result, dict) else "failed"
    update_pipeline_stage(
        redis_client, report_id, "REPORTING", reporting_status, PIPELINE_TTL_SECONDS,
        {"pdf_name": pdf_path.name, "company_name": company_name, "artifacts": ["report.json"]},
    )
    _append_log(log_file, "Completed")

    # Track document as completed
    update_document_status(redis_client, report_id, pdf_path.name, "completed", "DONE", PIPELINE_TTL_SECONDS)

    return {
        "pdf_name": pdf_path.name,
        "company_name": company_name,
        "log_dir": str(log_dir),
        "extraction": strict_extraction,
        "extraction_metadata": {
            "normalized_results_consumed": normalized_results is not None,
            "normalized_results_path": str(_normalized_results_path()),
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
    }


def run_full_pipeline(pdf_paths_or_folder: list[str] | str, report_id: str | None = None) -> dict[str, Any]:
    """Orchestrate the full pipeline for up to 5 PDFs sequentially."""
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

    for pdf_path in pdf_paths:
        try:
            result = _process_pdf(pdf_path, report_id, redis_client)
            results.append(result)
        except Exception as exc:


def run_full_pipeline(pdf_paths_or_folder: list[str] | str, report_id: str | None = None) -> dict[str, Any]:
    """Orchestrate the full pipeline for up to 5 PDFs sequentially."""
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

    for pdf_path in pdf_paths:
        try:
            result = _process_pdf(pdf_path, report_id, redis_client)
            results.append(result)
        except Exception as exc:
            failures.append({"pdf_name": pdf_path.name, "error": str(exc)})

            # Track failed document
            update_document_status(redis_client, report_id, pdf_path.name, "failed", "EXTRACTION", PIPELINE_TTL_SECONDS)

            failure_log_dir = _prepare_log_dir(pdf_path.stem, pdf_path)
            _append_log(failure_log_dir / "pipeline.log", f"FAILED: {exc}")
            _write_json(failure_log_dir / "extraction.json", {"pdf_name": pdf_path.name, "error": str(exc)})
            _write_json(failure_log_dir / "analysis.json", {"pdf_name": pdf_path.name, "error": str(exc)})
            _write_json(failure_log_dir / "report.json", {"pdf_name": pdf_path.name, "error": str(exc)})
            update_pipeline_stage(
                redis_client, report_id, "EXTRACTION", "failed", PIPELINE_TTL_SECONDS,
                {"pdf_name": pdf_path.name, "error": str(exc)},
            )
            update_pipeline_stage(
                redis_client, report_id, "ANALYSIS", "skipped", PIPELINE_TTL_SECONDS,
                {"pdf_name": pdf_path.name, "error": str(exc)},
            )
            update_pipeline_stage(
                redis_client, report_id, "REPORTING", "skipped", PIPELINE_TTL_SECONDS,
                {"pdf_name": pdf_path.name, "error": str(exc)},
            )
            continue

    overall_status = "completed" if not failures else "completed_with_failures"
    if results:
        final_report_payload = {
            "report_id": report_id,
            "status": overall_status,
            "processed_count": len(results),
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

    # Save to the batch outputs directory
    batch_out_dir = _workspace_root() / "outputs" / report_id
    batch_out_dir.mkdir(parents=True, exist_ok=True)
    _write_json(batch_out_dir / "full_pipeline_test_results.json", final_report_payload)
    
    # Copy/write to global full_pipeline_test_results.json for test suite compatibility
    global_results_path = _workspace_root() / "full_pipeline_test_results.json"
    _write_json(global_results_path, final_report_payload)

    return final_report_payload
