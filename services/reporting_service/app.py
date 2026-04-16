from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import json

app = FastAPI()

PROJECT_ROOT = Path(__file__).resolve().parents[2]
EVAL_DIR = PROJECT_ROOT / "data" / "eval"


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/report/latest")
async def report_latest():
    report_file = EVAL_DIR / "final_report.json"
    if not report_file.exists():
        raise HTTPException(status_code=404, detail="final_report.json not found")
    data = json.loads(report_file.read_text(encoding="utf-8"))
    return JSONResponse(content=data)


@app.get("/report/{name}")
async def report_by_name(name: str):
    candidate = EVAL_DIR / f"{name}"
    if candidate.exists() and candidate.suffix == ".json":
        data = json.loads(candidate.read_text(encoding="utf-8"))
        return JSONResponse(content=data)
    # try with .json appended
    candidate2 = EVAL_DIR / f"{name}.json"
    if candidate2.exists():
        data = json.loads(candidate2.read_text(encoding="utf-8"))
        return JSONResponse(content=data)
    raise HTTPException(status_code=404, detail="report not found")
