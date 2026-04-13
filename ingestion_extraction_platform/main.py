import os
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from redis import Redis

from modules.pipeline.service import run_extraction_pipeline

SERVICE_NAME = "ingestion_extraction_platform"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_TTL_SECONDS = int(os.getenv("REDIS_TTL_SECONDS", "3600"))
EXTRACTION_MAX_WORKERS = int(os.getenv("EXTRACTION_MAX_WORKERS", "6"))

app = FastAPI(title=SERVICE_NAME, version="1.0.0")
redis_client = Redis.from_url(REDIS_URL, decode_responses=True)


class PipelineRequest(BaseModel):
    report_id: str
    file_path: str
    strict_mode: bool = False


@app.post("/run-ingestion-extraction")
def run_ingestion_extraction(req: PipelineRequest) -> dict[str, Any]:
    try:
        result = run_extraction_pipeline(
            report_id=req.report_id,
            file_path=req.file_path,
            redis_client=redis_client,
            ttl_seconds=REDIS_TTL_SECONDS,
            max_workers=EXTRACTION_MAX_WORKERS,
        )
        return {"service": SERVICE_NAME, **result}
    except Exception as exc:
        if req.strict_mode:
            raise HTTPException(status_code=502, detail={"stage": "EXTRACTION", "error": str(exc)}) from exc
        return {
            "status": "failed",
            "service": SERVICE_NAME,
            "report_id": req.report_id,
            "error": str(exc),
        }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": SERVICE_NAME}
