from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List
import os
import uuid
import asyncio
import json
from pydantic import BaseModel

from platform_core.job_framework import RedisQueue
from . import storage
from .full_pipeline import run_full_pipeline

app = FastAPI(title="pipeline_orchestrator", version="0.1")

# Use Redis queue name 'pipeline:jobs'
queue = RedisQueue("pipeline:jobs", url=os.environ.get("REDIS_URL", "redis://localhost:6379/0"))


class RunFullPipelineRequest(BaseModel):
    pdf_paths: List[str]
    report_id: str | None = None


@app.post("/submit")
async def submit(file: UploadFile = File(...)):
    # Accept PDF upload and enqueue a job pointing to a temp path
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

    job_id = str(uuid.uuid4())
    tmp_dir = os.environ.get("PIPELINE_TMP", "/tmp/pipeline_orchestrator")
    os.makedirs(tmp_dir, exist_ok=True)
    out_path = os.path.join(tmp_dir, f"{job_id}.pdf")

    with open(out_path, "wb") as f:
        f.write(await file.read())

    job = {"job_id": job_id, "pdf_path": out_path}
    await queue.push(job)
    # persist job status
    await storage.set_job_status(job_id, "QUEUED", {"pdf_path": out_path})

    return JSONResponse({"job_id": job_id, "status": "queued"})


@app.get("/status/{job_id}")
async def status(job_id: str):
    s = await storage.get_job_status(job_id)
    if not s:
        raise HTTPException(status_code=404, detail="job not found")
    return JSONResponse(s)


@app.get("/result/{job_id}")
async def result(job_id: str):
    s = await storage.get_job_status(job_id)
    if not s:
        raise HTTPException(status_code=404, detail="job not found")
    out = s.get("output_path")
    if not out or not os.path.exists(out):
        raise HTTPException(status_code=404, detail="result not available yet")
    # return the JSON content
    with open(out, "r", encoding="utf-8") as f:
        data = f.read()
    return JSONResponse(json.loads(data))


@app.get("/healthz")
async def healthz():
    return JSONResponse({"status": "ok"})


@app.post("/run-full-pipeline")
async def run_full_pipeline_endpoint(request: RunFullPipelineRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_full_pipeline, request.pdf_paths, request.report_id)
    return JSONResponse({"status": "started", "report_id": request.report_id})


@app.post("/upload-batch")
async def upload_batch(background_tasks: BackgroundTasks, pdf_files: List[UploadFile] = File(...)):
    """Accept up to 5 PDF files, save to temp folder, and run the full pipeline."""
    pdf_files = [f for f in pdf_files if f.filename and f.filename.lower().endswith(".pdf")]
    if not pdf_files:
        raise HTTPException(status_code=400, detail="No PDF files provided")
    if len(pdf_files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 PDFs per batch")

    report_id = str(uuid.uuid4())
    tmp_dir = os.environ.get("PIPELINE_TMP", "./tmp/pipeline_orchestrator")
    batch_dir = os.path.join(tmp_dir, report_id)
    os.makedirs(batch_dir, exist_ok=True)

    for pdf_file in pdf_files:
        out_path = os.path.join(batch_dir, pdf_file.filename)
        with open(out_path, "wb") as f:
            f.write(await pdf_file.read())

    # Run the full pipeline in background thread
    background_tasks.add_task(run_full_pipeline, batch_dir, report_id)
    return JSONResponse({"status": "started", "report_id": report_id})


def start():
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8100)))
