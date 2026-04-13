import os
import json
import urllib.error
import urllib.request
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from redis import Redis

from modules.inspection_api.service import read_inspection_bundle
from modules.notifications.service import send_webhook
from modules.observability.service import build_diagnostics
from modules.report_generation.service import (
    build_final_report_payload,
    generate_report_file,
    serialize_final_payload,
)
from modules.workflow_tracking.service import update_stage

SERVICE_NAME = "reporting_delivery_service"
TIMEOUT_SECONDS = float(os.getenv("CONSOLIDATED_HTTP_TIMEOUT_SECONDS", "300"))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_TTL_SECONDS = int(os.getenv("REDIS_TTL_SECONDS", "3600"))
REPORT_OUTPUT_DIR = os.getenv("REPORT_OUTPUT_DIR", "generated_reports")

app = FastAPI(title=SERVICE_NAME, version="1.0.0")
redis_client = Redis.from_url(REDIS_URL, decode_responses=True)


class ReportRequest(BaseModel):
    report_id: str
    file_path: str


class WebhookRequest(BaseModel):
    webhook_url: str
    payload: dict[str, Any]


@app.post("/run-report")
def run_report(req: ReportRequest) -> dict[str, Any]:
    try:
        update_stage(redis_client, req.report_id, "REPORT", "running", REDIS_TTL_SECONDS)
        inspection = read_inspection_bundle(redis_client, req.report_id)
        final_payload = build_final_report_payload(req.report_id, inspection)
        pdf_path = generate_report_file(req.report_id, final_payload, REPORT_OUTPUT_DIR)

        final_key = f"report:{req.report_id}:final_report"
        redis_client.setex(final_key, REDIS_TTL_SECONDS, serialize_final_payload(final_payload))

        diagnostics = build_diagnostics(inspection)
        update_stage(redis_client, req.report_id, "REPORT", "completed", REDIS_TTL_SECONDS, diagnostics)

        return {
            "status": "completed",
            "service": SERVICE_NAME,
            "report_id": req.report_id,
            "final_report_key": final_key,
            "pdf_path": pdf_path,
        }
    except Exception as exc:
        update_stage(redis_client, req.report_id, "REPORT", "failed", REDIS_TTL_SECONDS, {"error": str(exc)})
        raise HTTPException(status_code=500, detail={"error": str(exc)}) from exc


@app.get("/inspection/report/{report_id}")
def inspection_report(report_id: str) -> dict[str, Any]:
    return read_inspection_bundle(redis_client, report_id)


@app.get("/inspection/pipeline/{report_id}")
def inspection_pipeline(report_id: str) -> dict[str, Any]:
    payload = read_inspection_bundle(redis_client, report_id)
    return {
        "report_id": report_id,
        "pipeline_stages": payload.get("pipeline_stages") or {},
        "diagnostics": build_diagnostics(payload),
    }


@app.post("/notify/webhook")
def notify_webhook(req: WebhookRequest) -> dict[str, Any]:
    try:
        return send_webhook(req.webhook_url, req.payload)
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=502, detail={"error": details, "status_code": exc.code}) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"error": str(exc)}) from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": SERVICE_NAME}
