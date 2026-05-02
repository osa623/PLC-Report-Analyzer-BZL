import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .config import get_config
from .job_manager import mark_failed, mark_running, mark_success
from .pipeline.pdf_loader import load_pdf_pages
from .pipeline.gemini_statement_extractor import extract_financial_statements_from_text
from .pipeline.financial_structure_engine import FinancialStructureEngine
from .pipeline.column_alignment_engine import ColumnAlignmentEngine
from .pipeline.reconciliation_engine import ReconciliationEngine
from .redis_client import get_redis
from platform_core.shared_infra.redis_client import set_json

app = FastAPI(title="extraction-service", version="1.0.0")
cfg = get_config()


class ExtractRequest(BaseModel):
    report_id: str
    file_path: str | None = None
    file_paths: list[str] | None = None


def _resolve_input_paths(request: ExtractRequest) -> list[str]:
    if isinstance(request.file_paths, list) and request.file_paths:
        return [p for p in request.file_paths if isinstance(p, str) and p.strip()]
    if isinstance(request.file_path, str) and request.file_path.strip():
        return [request.file_path]
    return []


def _document_status_key(report_id: str) -> str:
    return f"report:{report_id}:document_statuses"


def _set_document_status(redis, report_id: str, file_path: str, ttl_seconds: int, status: str, **extra: Any) -> None:
    payload = {
        "file_path": file_path,
        "status": status,
        **extra,
    }
    redis.hset(_document_status_key(report_id), file_path, json.dumps(payload, ensure_ascii=True, default=str))
    redis.expire(_document_status_key(report_id), ttl_seconds)


def _extract_single_file(redis, report_id: str, file_path: str, ttl_seconds: int) -> tuple[dict[str, Any], int]:
    start = time.perf_counter()
    _set_document_status(redis, report_id, file_path, ttl_seconds, "running")
    pages = load_pdf_pages(file_path)
    full_text = "\n\n".join(pages)

    # L1 - Extraction Layer
    l1_output = extract_financial_statements_from_text(full_text, file_path, report_id)
    if l1_output.get("status") == "failed":
        _set_document_status(redis, report_id, file_path, ttl_seconds, "failed", error=l1_output.get("failure_reason"))
        raise RuntimeError(l1_output.get("failure_reason"))
        
    extracted_tables = l1_output.get("extracted_tables", [])
    
    # L2 & L3 - Financial Structure & Column Alignment
    structure_engine = FinancialStructureEngine()
    alignment_engine = ColumnAlignmentEngine()
    
    graph_payload = structure_engine.build(extracted_tables, alignment_engine)
    
    # L4 - Reconciliation Engine
    recon_engine = ReconciliationEngine()
    validation_results = recon_engine.validate_graph(graph_payload["financial_graph"])
    
    graph_payload["metadata"]["reconciliation_errors"] = validation_results["errors"]
    graph_payload["metadata"]["is_valid"] = validation_results["is_valid"]
    
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    
    _set_document_status(
        redis,
        report_id,
        file_path,
        ttl_seconds,
        "completed",
        page_count=len(pages),
        duration_ms=elapsed_ms,
        is_valid=validation_results["is_valid"],
        detected_years=graph_payload["metadata"]["detected_years"]
    )
    
    return graph_payload, len(pages)


@app.post("/extract")
def extract(request: ExtractRequest) -> dict[str, Any]:
    redis = get_redis()
    try:
        mark_running(redis, request.report_id)

        input_paths = _resolve_input_paths(request)
        if not input_paths:
            raise ValueError("file_path or file_paths is required")

        for file_path in input_paths:
            _set_document_status(redis, request.report_id, file_path, cfg.redis_ttl_seconds, "queued")

        graphs: list[dict[str, Any]] = []
        total_pages = 0
        file_errors: list[dict[str, str]] = []

        max_workers = min(len(input_paths), max(1, os.cpu_count() or 1), 8)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_path = {
                executor.submit(_extract_single_file, redis, request.report_id, file_path, cfg.redis_ttl_seconds): file_path
                for file_path in input_paths
            }

            for future in as_completed(future_to_path):
                file_path = future_to_path[future]
                try:
                    graph_payload, page_count = future.result()
                    graphs.append(graph_payload)
                    total_pages += page_count
                except Exception as exc:
                    file_errors.append({
                        "file_path": file_path,
                        "error": str(exc)
                    })

        if not graphs:
            failure_report = {
                "status": "extraction_failed",
                "report_id": request.report_id,
                "pdfs_processed": len(input_paths),
                "document_errors": file_errors,
            }
            set_json(redis, f"report:{request.report_id}:extraction_failure", failure_report, cfg.redis_ttl_seconds)
            raise HTTPException(status_code=422, detail=failure_report)

        # Merge graphs (simple merge for now, assuming 1 graph per file and distinct years)
        final_graph = {}
        final_year_metadata = {}
        all_detected_years = set()
        
        for g in graphs:
            final_graph.update(g.get("financial_graph", {}))
            final_year_metadata.update(g.get("year_metadata", {}))
            for y in g.get("metadata", {}).get("detected_years", []):
                all_detected_years.add(y)
                
        final_payload = {
            "financial_graph": final_graph,
            "year_metadata": final_year_metadata,
            "metadata": {
                "unit_scale": "LKR", # Or fetch from graph if implemented
                "detected_years": sorted(list(all_detected_years), reverse=True),
                "confidence": {
                    "extraction": 1.0,
                    "mapping": 1.0,
                    "reconciliation": 1.0
                }
            }
        }
        
        # Save output for Analysis layer
        set_json(redis, f"report:{request.report_id}:financial_graph", final_payload, cfg.redis_ttl_seconds)
        
        # Compatibility wrapper for strict_extraction
        set_json(redis, f"report:{request.report_id}:strict_extraction", final_payload, cfg.redis_ttl_seconds)
        
        mark_success(redis, request.report_id)
        
        return {
            "status": "completed",
            "report_id": request.report_id,
            "artifact": f"report:{request.report_id}:financial_graph",
            "page_count": total_pages,
            "document_count": len(graphs),
            "document_errors": file_errors,
            "years_detected": final_payload["metadata"]["detected_years"],
        }
    except Exception as exc:
        mark_failed(redis, request.report_id, str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "extraction-service"}
