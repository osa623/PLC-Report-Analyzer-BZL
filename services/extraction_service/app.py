from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .config import get_config
from .job_manager import mark_failed, mark_running, mark_success
from .pipeline.chunker import chunk_pages
from .pipeline.parallel_extraction_runner import run_parallel_extraction
from .pipeline.pdf_loader import load_pdf_pages
from .pipeline.structure_detector import detect_structure
from .redis_client import get_redis
from .storage.canonical_raw_repository import save_canonical_raw

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


def _merge_extractions(extractions: list[dict[str, Any]]) -> dict[str, Any]:
    merged_financial = {
        "income_statement": [],
        "balance_sheet": [],
        "cashflow": [],
        "equity": [],
    }
    merged_narrative = {
        "notes": [],
        "risk": [],
        "governance": [],
        "esg": [],
        "segment": [],
    }
    structures: list[dict[str, Any]] = []

    for extraction in extractions:
        financial = extraction.get("financial_statements") or {}
        narrative = extraction.get("narrative_sections") or {}
        for key in merged_financial:
            values = financial.get(key)
            if isinstance(values, list):
                merged_financial[key].extend(values)
        for key in merged_narrative:
            values = narrative.get(key)
            if isinstance(values, list):
                merged_narrative[key].extend(values)
        structure = extraction.get("structure")
        if isinstance(structure, dict):
            structures.append(structure)

    return {
        "financial_statements": merged_financial,
        "narrative_sections": merged_narrative,
        "structure": {"documents": structures},
    }


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
    chunks = chunk_pages(pages)
    structure = detect_structure(chunks)
    output = run_parallel_extraction(chunks, structure, cfg)
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    _set_document_status(
        redis,
        report_id,
        file_path,
        ttl_seconds,
        "completed",
        chunk_count=len(chunks),
        duration_ms=elapsed_ms,
    )
    return output, len(chunks)


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

        extraction_outputs_by_path: dict[str, dict[str, Any]] = {}
        total_chunks = 0
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
                    output, chunk_count = future.result()
                    extraction_outputs_by_path[file_path] = output
                    total_chunks += chunk_count
                except Exception as exc:
                    _set_document_status(
                        redis,
                        request.report_id,
                        file_path,
                        cfg.redis_ttl_seconds,
                        "failed",
                        error=str(exc),
                    )
                    file_errors.append({"file_path": file_path, "error": str(exc)})

        extraction_outputs = [
            extraction_outputs_by_path[p]
            for p in input_paths
            if p in extraction_outputs_by_path
        ]

        if not extraction_outputs:
            raise RuntimeError("Extraction failed for all uploaded documents")

        extraction_output = _merge_extractions(extraction_outputs)
        payload = save_canonical_raw(
            redis, request.report_id, extraction_output, cfg.redis_ttl_seconds
        )
        mark_success(redis, request.report_id)
        return {
            "status": "completed",
            "report_id": request.report_id,
            "artifact": f"report:{request.report_id}:canonical_raw",
            "chunk_count": total_chunks,
            "document_count": len(extraction_outputs),
            "document_errors": file_errors,
            "schema_version": payload.schema_version,
        }
    except Exception as exc:
        mark_failed(redis, request.report_id, str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "extraction-service"}
