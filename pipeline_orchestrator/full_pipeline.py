from __future__ import annotations

import json
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

from platform_core.shared_infra.job_status import init_pipeline_stages, update_pipeline_stage
from platform_core.shared_infra.redis_client import get_json, get_redis_client, set_json

from services.analysis_service.normalized_results_adapter import load_canonical_analysis_dataset
from services.analysis_service.strict_pipeline import build_strict_analysis_result
from services.extraction_service.canonical_results import (
    CANONICAL_MISSING_ERROR,
    persist_normalized_results,
)
from services.extraction_service.src.pipeline.pdf_image_orchestrator import (
    _get_poppler_path,
    _render_page_png,
    process_annual_reports,
)
from services.reporting_service.strict_pipeline import build_report_from_analytics

from pipeline_orchestrator.redis_artifacts import (
    save_extraction_artifacts,
    save_analysis_artifacts,
    save_report_artifacts,
    save_pipeline_metadata,
    update_document_status,
)


PIPELINE_TTL_SECONDS = int(os.environ.get("PIPELINE_TTL_SECONDS", "86400"))
REQUIRED_STATEMENTS = (
    "income_statement",
    "balance_sheet",
    "cash_flow",
    "equity",
    "comprehensive_income",
)


def _workspace_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _logs_root() -> Path:
    return _workspace_root() / "logs"


def _artifacts_root() -> Path:
    return _workspace_root() / "pipeline_artifacts"


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


def _append_log(log_file: Path, message: str) -> None:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().isoformat(timespec="seconds")
    with log_file.open("a", encoding="utf-8") as handle:
        handle.write(f"[{timestamp}] {message}\n")


def _document_progress_callback(redis_client, report_id: str, pdf_name: str):
    def _callback(name: str, stage: str, status: str, message: str, details: dict[str, Any] | None = None) -> None:
        update_document_status(
            redis_client,
            report_id,
            name or pdf_name,
            status,
            stage,
            PIPELINE_TTL_SECONDS,
            message=message,
            details=_public_document_details(details or {}),
        )

    return _callback


def _public_document_details(details: dict[str, Any]) -> dict[str, Any]:
    public: dict[str, Any] = {}
    for key in (
        "toc_pages",
        "statement_refs",
        "statement_pages",
        "statement_statuses",
        "statement_images",
        "printed_page",
        "toc_anchor_page",
    ):
        if key in details:
            public[key] = details[key]
    if "toc_text" in details:
        public["toc_lines"] = [
            line.strip()
            for line in str(details["toc_text"]).splitlines()
            if line.strip()
        ][:120]
    return public


def _raw_result_is_success(raw_result: dict[str, Any]) -> bool:
    if not isinstance(raw_result, dict) or raw_result.get("error"):
        return False
    statements = raw_result.get("statements")
    if not isinstance(statements, dict):
        return False
    return all(statements.get(statement) for statement in REQUIRED_STATEMENTS)


def _statement_statuses(raw_result: dict[str, Any]) -> dict[str, dict[str, Any]]:
    statements = raw_result.get("statements") if isinstance(raw_result, dict) else {}
    statement_pages = raw_result.get("statement_pages") if isinstance(raw_result, dict) else {}
    statuses: dict[str, dict[str, Any]] = {}
    for statement in REQUIRED_STATEMENTS:
        pages = statement_pages.get(statement, []) if isinstance(statement_pages, dict) else []
        payload = statements.get(statement) if isinstance(statements, dict) else None
        statuses[statement] = {
            "status": "completed" if payload else "failed",
            "pages": pages if isinstance(pages, list) else [],
            "has_data": bool(payload),
        }
    return statuses


def _missing_statement_error(raw_result: dict[str, Any]) -> str:
    statuses = _statement_statuses(raw_result)
    missing = [
        statement.replace("_", " ")
        for statement, payload in statuses.items()
        if payload.get("status") != "completed"
    ]
    if missing:
        return f"Missing required statements: {', '.join(missing)}"
    return str(raw_result.get("error") or "No financial statements were extracted")


def _image_artifact_dir(report_id: str, pdf_name: str) -> Path:
    return _artifacts_root() / report_id / _slugify(Path(pdf_name).stem)


def _save_statement_images(redis_client, report_id: str, pdf_path: Path, raw_result: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    statement_pages = raw_result.get("statement_pages") if isinstance(raw_result, dict) else {}
    if not isinstance(statement_pages, dict):
        return {}

    output_dir = _image_artifact_dir(report_id, pdf_path.name)
    output_dir.mkdir(parents=True, exist_ok=True)
    poppler_path = _get_poppler_path()
    pdf_bytes = pdf_path.read_bytes()
    image_map: dict[str, list[dict[str, Any]]] = {}

    for statement, pages in statement_pages.items():
        if not isinstance(pages, list):
            continue
        for page in pages:
            try:
                page_num = int(page)
                image_bytes = _render_page_png(pdf_bytes, page_num, poppler_path)
            except Exception as exc:
                update_document_status(
                    redis_client,
                    report_id,
                    pdf_path.name,
                    "running",
                    "EXTRACTION",
                    PIPELINE_TTL_SECONDS,
                    message=f"Screenshot failed for {statement} page {page}: {exc}",
                )
                continue
            filename = f"{_slugify(statement)}_page_{page_num}.png"
            image_path = output_dir / filename
            image_path.write_bytes(image_bytes)
            image_map.setdefault(statement, []).append({
                "page": page_num,
                "filename": filename,
                "url": f"/api/pipeline/{report_id}/documents/{quote(pdf_path.name, safe='')}/images/{filename}",
            })

    return image_map


def _document_result_details(raw_result: dict[str, Any], statement_images: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    return {
        **_public_document_details(raw_result),
        "statement_statuses": _statement_statuses(raw_result),
        "statement_images": statement_images,
    }


def _save_raw_extraction_result(redis_client, report_id: str, pdf_name: str, raw_result: dict[str, Any]) -> None:
    set_json(redis_client, f"report:{report_id}:document_result:{pdf_name}", raw_result, PIPELINE_TTL_SECONDS)


def _load_raw_extraction_results(redis_client, report_id: str, pdf_names: list[str]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for pdf_name in pdf_names:
        record = get_json(redis_client, f"report:{report_id}:document_result:{pdf_name}", default=None)
        if isinstance(record, dict) and _raw_result_is_success(record):
            records.append(record)
    return records


def _document_status_counts(redis_client, report_id: str) -> dict[str, int]:
    raw_statuses = redis_client.hgetall(f"report:{report_id}:document_statuses") or {}
    counts = {"total": 0, "completed": 0, "failed": 0, "running": 0, "pending": 0}
    for raw in raw_statuses.values():
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        try:
            doc = json.loads(raw)
        except Exception:
            continue
        status = str(doc.get("status") or "pending").lower()
        counts["total"] += 1
        counts[status if status in counts else "pending"] += 1
    return counts


def _set_partial_extraction_failure(redis_client, report_id: str, failures: list[dict[str, Any]], pdf_count: int) -> None:
    if failures:
        set_json(redis_client, f"report:{report_id}:extraction_failure", {
            "pdfs_processed": pdf_count,
            "failed_documents": failures,
            "error": "One or more annual reports failed extraction and require manual mapping",
        }, PIPELINE_TTL_SECONDS)
    else:
        redis_client.delete(f"report:{report_id}:extraction_failure")


def _run_analysis_and_reporting_for_completed_batch(
    redis_client,
    report_id: str,
    pdf_names: list[str],
    log_dir: Path,
    company_name_hint: str,
) -> dict[str, Any]:
    raw_results = _load_raw_extraction_results(redis_client, report_id, pdf_names)
    if len(raw_results) != len(pdf_names):
        raise RuntimeError("Cannot run analysis until every annual report has completed extraction")

    normalized_records = persist_normalized_results(raw_results, pdf_names)
    analysis_dataset = load_canonical_analysis_dataset()
    company_name = str(analysis_dataset.get("company_name") or company_name_hint)
    log_file = log_dir / "pipeline.log"
    _write_json(log_dir / "normalized_results.json", normalized_records)

    save_extraction_artifacts(redis_client, report_id, analysis_dataset, PIPELINE_TTL_SECONDS)
    update_pipeline_stage(
        redis_client,
        report_id,
        "EXTRACTION",
        "completed",
        PIPELINE_TTL_SECONDS,
        {"pdf_names": pdf_names, "company_name": company_name, "artifacts": ["normalized_results.json"]},
    )
    _append_log(log_file, "All annual reports extracted successfully")

    try:
        from platform_core.company_repository import upsert_company_financials
        years_data = analysis_dataset.get("years") or analysis_dataset.get("financial_graph") or {}
        if years_data:
            upsert_company_financials(company_name, "General", years_data)
    except Exception as mongo_err:
        import logging
        logging.getLogger(__name__).warning("MongoDB persistence failed (non-fatal): %s", mongo_err)

    analysis_start_time = datetime.now().isoformat()
    update_pipeline_stage(
        redis_client,
        report_id,
        "ANALYSIS",
        "running",
        PIPELINE_TTL_SECONDS,
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

    analysis_status = "completed" if analysis_result.get("status") == "COMPLETED" else "failed"
    update_pipeline_stage(
        redis_client,
        report_id,
        "ANALYSIS",
        analysis_status,
        PIPELINE_TTL_SECONDS,
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
    _append_log(log_file, f"Analysis {analysis_status}")

    update_pipeline_stage(
        redis_client,
        report_id,
        "REPORTING",
        "running",
        PIPELINE_TTL_SECONDS,
        {"pdf_names": pdf_names, "company_name": company_name, "stage": "Generating final report"},
    )
    analytics_payload = get_json(redis_client, f"report:{report_id}:analytics", default={}) or analysis_result
    report_result = build_report_from_analytics(analytics_payload)
    _write_json(log_dir / "final_report.json", report_result)
    save_report_artifacts(redis_client, report_id, report_result, PIPELINE_TTL_SECONDS)
    update_pipeline_stage(
        redis_client,
        report_id,
        "REPORTING",
        "completed" if isinstance(report_result, dict) else "failed",
        PIPELINE_TTL_SECONDS,
        {"pdf_names": pdf_names, "company_name": company_name, "artifacts": ["final_report.json"]},
    )
    _append_log(log_file, "Completed")
    return {
        "pdf_names": pdf_names,
        "company_name": company_name,
        "log_dir": str(log_dir),
        "normalized_results": "normalized_results.json",
        "analysis": analysis_result,
        "report": report_result,
    }


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
        update_document_status(
            redis_client,
            report_id,
            pdf_path.name,
            "running",
            "UPLOAD",
            PIPELINE_TTL_SECONDS,
            message="Upload received",
            details={"file_path": str(pdf_path)},
        )

    update_pipeline_stage(
        redis_client, report_id, "EXTRACTION", "running", PIPELINE_TTL_SECONDS,
        {"pdf_names": pdf_names, "stage": "Extracting annual reports independently"},
    )

    company_name = pdf_paths[-1].stem
    log_dir = _prepare_log_dir(company_name, pdf_paths[-1])
    log_file = log_dir / "pipeline.log"
    _append_log(log_file, f"Batch upload received: {batch_label}")
    failures: list[dict[str, Any]] = []

    for pdf_path in pdf_paths:
        update_document_status(
            redis_client,
            report_id,
            pdf_path.name,
            "running",
            "EXTRACTION",
            PIPELINE_TTL_SECONDS,
            message="Starting extraction for this annual report",
        )
        _append_log(log_file, f"Extracting {pdf_path.name}")
        raw_results = process_annual_reports(
            [pdf_path.read_bytes()],
            [pdf_path.name],
            progress_callback=_document_progress_callback(redis_client, report_id, pdf_path.name),
        )
        raw_result = raw_results[0] if raw_results else {"pdf_name": pdf_path.name, "error": "No extraction result returned"}
        statement_images = _save_statement_images(redis_client, report_id, pdf_path, raw_result)
        _save_raw_extraction_result(redis_client, report_id, pdf_path.name, raw_result)
        if _raw_result_is_success(raw_result):
            update_document_status(
                redis_client,
                report_id,
                pdf_path.name,
                "completed",
                "EXTRACTION",
                PIPELINE_TTL_SECONDS,
                message="Extraction completed successfully",
                details=_document_result_details(raw_result, statement_images),
            )
        else:
            error = _missing_statement_error(raw_result)
            failures.append({"pdf_name": pdf_path.name, "error": error})
            update_document_status(
                redis_client,
                report_id,
                pdf_path.name,
                "failed",
                "EXTRACTION",
                PIPELINE_TTL_SECONDS,
                error=error,
                details=_document_result_details(raw_result, statement_images),
            )

    _set_partial_extraction_failure(redis_client, report_id, failures, len(pdf_paths))
    if failures:
        update_pipeline_stage(
            redis_client,
            report_id,
            "EXTRACTION",
            "failed",
            PIPELINE_TTL_SECONDS,
            {"pdf_names": pdf_names, "failed_documents": failures},
        )
        update_pipeline_stage(
            redis_client,
            report_id,
            "ANALYSIS",
            "pending",
            PIPELINE_TTL_SECONDS,
            {"reason": "Waiting for failed annual reports to be corrected"},
        )
        update_pipeline_stage(
            redis_client,
            report_id,
            "REPORTING",
            "pending",
            PIPELINE_TTL_SECONDS,
            {"reason": "Waiting for extraction completion"},
        )
        _append_log(log_file, f"Extraction paused for manual mapping: {failures}")
        return {
            "pdf_names": pdf_names,
            "company_name": company_name,
            "log_dir": str(log_dir),
            "status": "extraction_incomplete",
            "failures": failures,
        }

    return _run_analysis_and_reporting_for_completed_batch(redis_client, report_id, pdf_names, log_dir, company_name)


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

    extraction_incomplete = any(result.get("status") == "extraction_incomplete" for result in results)
    overall_status = "completed" if results and not failures and not extraction_incomplete else "extraction_incomplete" if extraction_incomplete else "failed"
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


def retry_document_extraction(report_id: str, pdf_name: str, selected_pages: dict[str, list[int]]) -> dict[str, Any]:
    """Re-extract one failed annual report and run analysis only after the whole batch is complete."""
    redis_client = get_redis_client(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    uploaded_files = get_json(redis_client, f"report:{report_id}:uploaded_files", default=[])
    if not isinstance(uploaded_files, list):
        uploaded_files = []
    if not uploaded_files:
        single_file = redis_client.get(f"report:{report_id}:uploaded_file")
        if single_file:
            uploaded_files = [single_file.decode("utf-8") if isinstance(single_file, bytes) else str(single_file)]
    pdf_paths = [Path(p).expanduser().resolve() for p in uploaded_files]
    target_path = next((path for path in pdf_paths if path.name == pdf_name), None)
    if target_path is None or not target_path.exists():
        raise FileNotFoundError(f"Uploaded PDF not found for retry: {pdf_name}")

    update_document_status(
        redis_client,
        report_id,
        pdf_name,
        "running",
        "EXTRACTION",
        PIPELINE_TTL_SECONDS,
        message="Manual page mappings saved. Restarting extraction for this report only.",
        details={"manual_page_mapping": selected_pages},
    )
    update_pipeline_stage(
        redis_client,
        report_id,
        "EXTRACTION",
        "running",
        PIPELINE_TTL_SECONDS,
        {"pdf_name": pdf_name, "stage": "Retrying failed annual report"},
    )

    raw_results = process_annual_reports(
        [target_path.read_bytes()],
        [pdf_name],
        progress_callback=_document_progress_callback(redis_client, report_id, pdf_name),
        manual_page_mappings={pdf_name: selected_pages},
    )
    raw_result = raw_results[0] if raw_results else {"pdf_name": pdf_name, "error": "No extraction result returned"}
    statement_images = _save_statement_images(redis_client, report_id, target_path, raw_result)
    _save_raw_extraction_result(redis_client, report_id, pdf_name, raw_result)
    if not _raw_result_is_success(raw_result):
        error = _missing_statement_error(raw_result)
        update_document_status(
            redis_client,
            report_id,
            pdf_name,
            "failed",
            "EXTRACTION",
            PIPELINE_TTL_SECONDS,
            error=error,
            details=_document_result_details(raw_result, statement_images),
        )
        _set_partial_extraction_failure(redis_client, report_id, [{"pdf_name": pdf_name, "error": error}], len(pdf_paths))
        update_pipeline_stage(
            redis_client,
            report_id,
            "EXTRACTION",
            "failed",
            PIPELINE_TTL_SECONDS,
            {"pdf_name": pdf_name, "error": error},
        )
        return {"status": "failed", "report_id": report_id, "pdf_name": pdf_name, "error": error}

    update_document_status(
        redis_client,
        report_id,
        pdf_name,
        "completed",
        "EXTRACTION",
        PIPELINE_TTL_SECONDS,
        message="Manual retry extraction completed successfully",
        details=_document_result_details(raw_result, statement_images),
    )

    counts = _document_status_counts(redis_client, report_id)
    remaining_failures = []
    raw_statuses = redis_client.hgetall(f"report:{report_id}:document_statuses") or {}
    for raw in raw_statuses.values():
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        try:
            doc = json.loads(raw)
        except Exception:
            continue
        if str(doc.get("status") or "").lower() == "failed":
            remaining_failures.append({"pdf_name": doc.get("pdf_name"), "error": doc.get("error") or "Extraction failed"})
    _set_partial_extraction_failure(redis_client, report_id, remaining_failures, len(pdf_paths))

    if counts["completed"] == counts["total"] and counts["total"] > 0 and not remaining_failures:
        company_hint = target_path.stem
        log_dir = _prepare_log_dir(company_hint, target_path)
        result = _run_analysis_and_reporting_for_completed_batch(
            redis_client,
            report_id,
            [path.name for path in pdf_paths],
            log_dir,
            company_hint,
        )
        return {"status": "completed", "report_id": report_id, "pdf_name": pdf_name, "pipeline": result}

    update_pipeline_stage(
        redis_client,
        report_id,
        "EXTRACTION",
        "failed" if remaining_failures else "running",
        PIPELINE_TTL_SECONDS,
        {"remaining_failures": remaining_failures, "completed": counts["completed"], "total": counts["total"]},
    )
    return {"status": "retry_completed", "report_id": report_id, "pdf_name": pdf_name, "remaining_failures": remaining_failures}
