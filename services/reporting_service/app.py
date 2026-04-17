from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import json

from pydantic import BaseModel

from .config import get_config
from .redis_client import get_redis
from .report_builder.chart_data_builder import build_chart_data
from .report_builder.narrative_generator import generate_narrative
from .report_builder.section_composer import compose_sections
from .storage.final_report_repository import save_final_report
from .workflow.job_status_tracker import mark_failed, mark_running, mark_success
from platform_core.shared_infra.redis_client import get_json

app = FastAPI()
cfg = get_config()

PROJECT_ROOT = Path(__file__).resolve().parents[2]
EVAL_DIR = PROJECT_ROOT / "data" / "eval"


class GenerateReportRequest(BaseModel):
    report_id: str


def _trend_limitations(year_count: int) -> list[str]:
    if year_count >= 3:
        return []
    if year_count <= 1:
        return [
            "Trend analysis limited due to single reporting year",
            "Multi-year pattern detection not available for current dataset",
            "Structural financial snapshot generated from available data",
        ]
    return [
        "Long-horizon trend detection is limited because fewer than three reporting years were detected",
        "Structural financial snapshot generated from available data",
    ]


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


@app.post("/generate-report")
async def generate_report(request: GenerateReportRequest):
    redis = get_redis()
    report_id = request.report_id

    try:
        mark_running(redis, report_id)

        validated = get_json(redis, f"report:{report_id}:canonical_validated", default={})
        ratios = get_json(redis, f"report:{report_id}:ratios", default={})
        patterns = get_json(redis, f"report:{report_id}:patterns", default=[])
        confidence = get_json(redis, f"report:{report_id}:confidence", default={})
        sector = get_json(redis, f"report:{report_id}:sector_comparison", default={})
        risk = get_json(redis, f"report:{report_id}:risk", default={})
        meta = get_json(redis, f"report:{report_id}:meta", default={})

        if not validated:
            raise HTTPException(status_code=404, detail="canonical_validated not found")

        years = ratios.get("detected_years") if isinstance(ratios.get("detected_years"), list) else []
        numeric_years = [y for y in years if isinstance(y, str) and y.isdigit()]
        transparency = {
            "documents_uploaded": int(meta.get("document_count", 1) or 1),
            "detected_reporting_years": numeric_years,
            "analysis_executed": [
                "extraction",
                "normalization",
                "validation",
                "ratio_engine",
                "risk_analysis",
                "pattern_logic",
                "report_generation",
            ],
            "analysis_limited": _trend_limitations(len(numeric_years)),
        }

        narrative = generate_narrative(validated, ratios, patterns, confidence, sector, risk, transparency)
        chart_data = build_chart_data(ratios)
        sections = compose_sections(narrative, chart_data)

        report_payload = {
            "report_id": report_id,
            "status": "completed",
            "sections": sections,
            "ratios": ratios,
            "risk": risk,
            "patterns": patterns,
            "confidence": confidence,
            "sector_comparison": sector,
            "transparency": transparency,
        }

        save_final_report(redis, report_id, report_payload, cfg.redis_ttl_seconds)
        mark_success(redis, report_id)
        return report_payload
    except HTTPException as exc:
        mark_failed(redis, report_id, exc.detail)
        raise
    except Exception as exc:
        mark_failed(redis, report_id, str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc
