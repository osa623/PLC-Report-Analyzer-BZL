from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from config import get_config
from job_manager import mark_failed, mark_running, mark_success
from pipeline.chunker import chunk_pages
from pipeline.parallel_extraction_runner import run_parallel_extraction
from pipeline.pdf_loader import load_pdf_pages
from pipeline.structure_detector import detect_structure
from redis_client import get_redis
from storage.canonical_raw_repository import save_canonical_raw

app = FastAPI(title="extraction-service", version="1.0.0")
cfg = get_config()


class ExtractRequest(BaseModel):
    report_id: str
    file_path: str


@app.post("/extract")
def extract(request: ExtractRequest) -> dict[str, Any]:
    redis = get_redis()
    try:
        mark_running(redis, request.report_id)
        pages = load_pdf_pages(request.file_path)
        chunks = chunk_pages(pages)
        structure = detect_structure(chunks)
        extraction_output = run_parallel_extraction(chunks, structure, cfg)
        payload = save_canonical_raw(redis, request.report_id, extraction_output, cfg.redis_ttl_seconds)
        mark_success(redis, request.report_id)
        return {
            "status": "completed",
            "report_id": request.report_id,
            "artifact": f"report:{request.report_id}:canonical_raw",
            "chunk_count": len(chunks),
            "schema_version": payload.schema_version,
        }
    except Exception as exc:
        mark_failed(redis, request.report_id, str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "extraction-service"}
