from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import os
import uuid
import asyncio

from platform_core.job_framework import RedisQueue
from . import storage

app = FastAPI(title="pipeline_orchestrator", version="0.1")

# Use Redis queue name 'pipeline:jobs'
queue = RedisQueue("pipeline:jobs", url=os.environ.get("REDIS_URL", "redis://localhost:6379/0"))


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


def start():
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8100)))
