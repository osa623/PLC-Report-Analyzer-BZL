from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
import json
from typing import Any

from pydantic import BaseModel

from .config import get_config
from .redis_client import get_redis
from .report_builder.dashboard_dto_builder import build_dashboard_dto
from .report_builder.chart_data_builder import build_chart_data
from .report_builder.narrative_generator import generate_narrative
from .report_builder.section_composer import compose_sections
from .strict_pipeline import build_strict_report
from .storage.final_report_repository import save_final_report
from .workflow.job_status_tracker import mark_failed, mark_running, mark_success
from platform_core.contracts import AnalysisResultModel, FinancialStatementModel
from platform_core.shared_infra.redis_client import get_json, set_json
from platform_core.temp_financial_repository import delete_temporary_financial_statements

app = FastAPI()
cfg = get_config()

PROJECT_ROOT = Path(__file__).resolve().parents[2]
EVAL_DIR = PROJECT_ROOT / "data" / "eval"


class GenerateReportRequest(BaseModel):
    report_id: str
    dataset_id: str | None = None
    schema_version: str | None = None
    calculation_version: str | None = None
    timestamp: str | None = None


def _empty_chart_data() -> dict[str, Any]:
    return {
        "required_charts": [],
        "ratio_chart": [],
        "trend_chart": [],
    }


def _build_transparency(
    strict_analysis: dict[str, Any],
    analysis_coverage: dict[str, Any],
    confidence: dict[str, Any],
) -> dict[str, Any]:
    return {
        "valid_years": strict_analysis.get("valid_years", []),
        "rejected_years": strict_analysis.get("rejected_years", []),
        "validation_flags": strict_analysis.get("validation_flags", []),
        "metrics_coverage": analysis_coverage.get("metrics_coverage", {}) if isinstance(analysis_coverage, dict) else {},
        "confidence_band": confidence.get("band"),
        "confidence_score": confidence.get("score"),
    }


def _build_report_payload(
    report_id: str,
    strict_report: dict[str, Any],
    strict_analysis: dict[str, Any],
    validated: dict[str, Any],
    ratios: dict[str, Any],
    patterns: list[Any],
    confidence: dict[str, Any],
    sector: dict[str, Any],
    risk: dict[str, Any],
    analysis_coverage: dict[str, Any],
) -> dict[str, Any]:
    transparency = _build_transparency(strict_analysis, analysis_coverage, confidence)
    try:
        chart_data = build_chart_data(ratios)
    except Exception:
        chart_data = _empty_chart_data()

    narrative = generate_narrative(validated, ratios, patterns, confidence, sector, risk, transparency)
    sections = compose_sections(narrative, chart_data)

    payload = {
        "report_id": report_id,
        "status": "completed",
        "strict_report": strict_report,
        "validated": validated,
        "ratios": ratios,
        "patterns": patterns,
        "risk": risk,
        "confidence": confidence,
        "sector_comparison": sector,
        "analysis_coverage": analysis_coverage,
        "sections": sections,
        "transparency": transparency,
        "chart_data": chart_data,
    }

    pdf_path = _write_report_pdf(report_id, payload)
    if isinstance(pdf_path, str) and pdf_path:
        payload["pdf_report_path"] = pdf_path
    return payload


def _fmt_num(value: Any, digits: int = 2) -> str:
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if not isinstance(value, (int, float)):
        return "n/a"
    return f"{float(value):,.{digits}f}"


def _fmt_pct(value: Any, digits: int = 1) -> str:
    if not isinstance(value, (int, float)):
        return "n/a"
    return f"{float(value) * 100.0:.{digits}f}%"


def _extract_ratio_rows(ratios: dict[str, Any]) -> list[list[str]]:
    metrics = [
        ("Gross Profit Margin", ratios.get("gross_profit_margin"), True),
        ("Net Profit Margin", ratios.get("net_profit_margin"), True),
        ("ROE", ratios.get("return_on_equity"), True),
        ("ROA", ratios.get("return_on_assets"), True),
        ("Debt to Equity", ratios.get("debt_to_equity"), False),
        ("Debt Ratio", ratios.get("debt_ratio"), True),
        ("Current Ratio", ratios.get("current_ratio"), False),
        ("Cash Flow to Net Income", ratios.get("cash_flow_to_net_income"), False),
        ("Operating Cash Flow Margin", ratios.get("operating_cash_flow_margin"), True),
        ("Earnings Growth Rate", ratios.get("earnings_growth_rate"), True),
        ("Equity Ratio", ratios.get("equity_ratio"), True),
    ]
    rows: list[list[str]] = [["Metric", "Latest Value"]]
    for label, value, is_percent in metrics:
        rows.append([label, _fmt_pct(value) if is_percent else _fmt_num(value)])
    return rows


def _extract_trend_points(ratios: dict[str, Any], metric: str) -> tuple[list[str], list[float]]:
    by_year = ratios.get("by_year") if isinstance(ratios.get("by_year"), dict) else {}
    years = sorted([y for y in by_year.keys() if isinstance(y, str) and y.isdigit()])
    labels: list[str] = []
    values: list[float] = []
    for y in years:
        yr = by_year.get(y) if isinstance(by_year.get(y), dict) else {}
        v = yr.get(metric)
        if isinstance(v, (int, float)):
            labels.append(y)
            values.append(float(v))
    return labels, values


def _write_report_pdf(report_id: str, payload: dict) -> str | None:
    try:
        from reportlab.graphics.charts.linecharts import HorizontalLineChart
        from reportlab.graphics.charts.barcharts import VerticalBarChart
        from reportlab.graphics.shapes import Drawing
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except Exception:
        return None

    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    out_path = EVAL_DIR / f"{report_id}.report.pdf"
    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
    )
    styles = getSampleStyleSheet()
    primary_caption = ParagraphStyle(
        "PrimaryCaption",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=2,
        spaceBefore=6,
    )
    cover_title = ParagraphStyle(
        "CoverTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=22,
        textColor=colors.HexColor("#FFFFFF"),
        leading=26,
        spaceAfter=6,
    )
    cover_sub = ParagraphStyle(
        "CoverSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=colors.HexColor("#C7D2FE"),
        leading=12,
    )
    secondary_caption = ParagraphStyle(
        "SecondaryCaption",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        textColor=colors.HexColor("#475569"),
        leading=10,
        spaceAfter=4,
    )
    normal = ParagraphStyle(
        "Compact",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )

    ratios = payload.get("ratios") if isinstance(payload.get("ratios"), dict) else {}
    risk = payload.get("risk") if isinstance(payload.get("risk"), dict) else {}
    confidence = payload.get("confidence") if isinstance(payload.get("confidence"), dict) else {}
    transparency = payload.get("transparency") if isinstance(payload.get("transparency"), dict) else {}
    hard_validation = transparency.get("metrics_coverage", {}).get("hard_validation", {}) if isinstance(transparency.get("metrics_coverage"), dict) else {}
    gates = hard_validation.get("gates") if isinstance(hard_validation.get("gates"), dict) else {}

    story: list[Any] = []

    # Cover page with a logo-style block and title hierarchy.
    cover_logo = Table(
        [[Paragraph("<b>PRA</b>", ParagraphStyle("Logo", parent=styles["Title"], fontSize=34, textColor=colors.HexColor("#0F172A")))]],
        colWidths=[26 * mm],
        rowHeights=[26 * mm],
    )
    cover_logo.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FBBF24")),
                ("BOX", (0, 0), (-1, -1), 1.0, colors.HexColor("#F59E0B")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    cover_text = Table(
        [[
            Paragraph("PROFESSIONAL FINANCIAL ANALYSIS REPORT", cover_title),
            Paragraph(
                f"Primary Caption 0.0: Branded Executive Cover<br/>"
                f"Secondary Caption 0.1: Compact annual-report intelligence with charts, controls, and decision-ready tables.<br/>"
                f"Report ID: {report_id} | Status: {payload.get('status', 'n/a')}",
                cover_sub,
            ),
        ]],
        colWidths=[140 * mm],
    )
    cover_text.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    cover = Table([[cover_logo, cover_text]], colWidths=[32 * mm, 146 * mm], rowHeights=[40 * mm])
    cover.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1E1B4B")),
                ("BOX", (0, 0), (-1, -1), 1.2, colors.HexColor("#4F46E5")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(Spacer(1, 40 * mm))
    story.append(cover)
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("Secondary Caption 0.2: This report is designed for professional review and committee discussion.", cover_sub))
    story.append(PageBreak())

    cap_idx = 1
    def add_captions(primary: str, secondary: str) -> None:
        nonlocal cap_idx
        story.append(Paragraph(f"Primary Caption {cap_idx}.0: {primary}", primary_caption))
        story.append(Paragraph(f"Secondary Caption {cap_idx}.1: {secondary}", secondary_caption))
        cap_idx += 1

    summary = payload.get("sections", {}).get("executive_summary")
    if summary:
        add_captions("Executive Summary", "Compact statement of current analytical findings and caveats.")
        story.append(Paragraph(str(summary), normal))
        story.append(Spacer(1, 3 * mm))

    add_captions("Gate and Reliability Dashboard", "Hard validation status and confidence-oriented quality score.")
    gate_rows = [["Control", "Status"]]
    for label, key in [
        ("Gate 1 - Balance Sheet Identity", "gate_1_balance_sheet_identity"),
        ("Gate 2 - Cash Reconciliation", "gate_2_cash_reconciliation"),
        ("Gate 3 - Net Income Linkage", "gate_3_net_income_linkage"),
        ("Gate 4 - Multi-year Continuity", "gate_4_multi_year_continuity"),
        ("Gate 5 - Unit Consistency", "gate_5_unit_consistency"),
    ]:
        gate_rows.append([label, "Pass" if bool(gates.get(key)) else "Fail"])
    gate_rows.append(["Reliability Score", _fmt_num(ratios.get("data_reliability_report", {}).get("score"), 1)])
    gate_rows.append(["Reliability Band", str(ratios.get("data_reliability_report", {}).get("band", "n/a"))])
    gate_table = Table(gate_rows, colWidths=[86 * mm, 20 * mm])
    gate_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1D4ED8")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.HexColor("#EEF2FF")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    risk_rows = [
        ["Measure", "Value"],
        ["Risk Score", _fmt_num(risk.get("overall_risk_score"), 1)],
        ["Risk Level", str(risk.get("overall_risk_level", "n/a"))],
        ["Confidence", _fmt_num(confidence.get("score"), 2)],
        ["Band", str(confidence.get("band", "n/a"))],
    ]
    risk_table_compact = Table(risk_rows, colWidths=[54 * mm, 22 * mm])
    risk_table_compact.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7C3AED")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FAF5FF"), colors.HexColor("#F5F3FF")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    two_col = Table([[gate_table, risk_table_compact]], colWidths=[108 * mm, 76 * mm])
    two_col.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(two_col)
    story.append(Spacer(1, 4 * mm))

    add_captions("Ratio Table (Compact)", "Latest-period indicators selected for investment committee briefing.")
    ratio_table = Table(_extract_ratio_rows(ratios), colWidths=[120 * mm, 60 * mm])
    ratio_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F766E")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F0FDFA"), colors.HexColor("#ECFEFF")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(ratio_table)
    story.append(Spacer(1, 4 * mm))

    # Trend chart block
    years_nm, vals_nm = _extract_trend_points(ratios, "net_profit_margin")
    years_dr, vals_dr = _extract_trend_points(ratios, "debt_ratio")
    years_roe, vals_roe = _extract_trend_points(ratios, "return_on_equity")
    if len(vals_nm) >= 2 or len(vals_dr) >= 2 or len(vals_roe) >= 2:
        add_captions("Trend Graphs", "Multi-color combo view of margin, leverage, and returns by year.")

        drawing = Drawing(180 * mm, 70 * mm)

        # Bar chart for ROE trend.
        if len(vals_roe) >= 2:
            bar = VerticalBarChart()
            bar.x = 8 * mm
            bar.y = 35 * mm
            bar.height = 28 * mm
            bar.width = 160 * mm
            bar.data = [vals_roe]
            bar.categoryAxis.categoryNames = years_roe
            bar.bars[0].fillColor = colors.HexColor("#F59E0B")
            bar.valueAxis.labels.fontSize = 7
            bar.categoryAxis.labels.fontSize = 7
            drawing.add(bar)

        # Line chart for net profit margin and debt ratio.
        chart = HorizontalLineChart()
        chart.x = 8 * mm
        chart.y = 4 * mm
        chart.height = 26 * mm
        chart.width = 160 * mm

        data_series: list[list[float]] = []
        category_labels = years_nm if len(years_nm) >= len(years_dr) else years_dr
        if len(vals_nm) >= 2:
            data_series.append(vals_nm)
        if len(vals_dr) >= 2:
            data_series.append(vals_dr)

        chart.data = data_series
        chart.joinedLines = 1
        chart.lines[0].strokeColor = colors.HexColor("#2563EB")
        if len(data_series) > 1:
            chart.lines[1].strokeColor = colors.HexColor("#DC2626")
        chart.valueAxis.valueMin = min([min(s) for s in data_series]) if data_series else 0
        chart.valueAxis.valueMax = max([max(s) for s in data_series]) if data_series else 1
        chart.valueAxis.valueStep = max((chart.valueAxis.valueMax - chart.valueAxis.valueMin) / 4.0, 0.1)
        chart.categoryAxis.categoryNames = category_labels
        chart.categoryAxis.labels.boxAnchor = "n"
        chart.categoryAxis.labels.fontSize = 7
        chart.valueAxis.labels.fontSize = 7
        drawing.add(chart)
        story.append(drawing)
        story.append(Spacer(1, 3 * mm))

    add_captions("Risk and Confidence Signals", "Portfolio risk view with primary and secondary analytical confidence tags.")
    risk_rows = [
        ["Measure", "Value"],
        ["Overall Risk Score", _fmt_num(risk.get("overall_risk_score"), 1)],
        ["Overall Risk Level", str(risk.get("overall_risk_level", "n/a"))],
        ["Confidence Score", _fmt_num(confidence.get("score"), 2)],
        ["Confidence Band", str(confidence.get("band", "n/a"))],
        ["Detected Years", ", ".join([str(y) for y in ratios.get("detected_years", [])]) if isinstance(ratios.get("detected_years"), list) else "n/a"],
    ]
    risk_table = Table(risk_rows, colWidths=[90 * mm, 90 * mm])
    risk_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7C3AED")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FAF5FF"), colors.HexColor("#F5F3FF")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(risk_table)

    doc.build(story)
    return str(out_path)


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


@app.get("/report/{report_id}/pdf")
async def report_pdf(report_id: str):
    pdf_file = EVAL_DIR / f"{report_id}.report.pdf"
    if not pdf_file.exists():
        raise HTTPException(status_code=404, detail="report pdf not found")
    return FileResponse(path=str(pdf_file), media_type="application/pdf", filename=f"{report_id}.report.pdf")


@app.post("/generate-report")
async def generate_report(request: GenerateReportRequest):
    redis = get_redis()
    report_id = request.report_id

    try:
        mark_running(redis, report_id)

        strict_extraction = get_json(redis, f"report:{report_id}:strict_extraction", default={})
        strict_analysis = get_json(redis, f"report:{report_id}:strict_analysis", default={})
        if not isinstance(strict_extraction, dict) or not isinstance(strict_extraction.get("years"), dict):
            raise HTTPException(status_code=404, detail="strict_extraction not found")
        if not isinstance(strict_analysis, dict):
            raise HTTPException(status_code=404, detail="strict_analysis not found")
        if strict_analysis.get("status") == "VALIDATION_FAILED":
            raise HTTPException(
                status_code=409,
                detail="Report generation requires at least one validated year after analysis",
            )

        strict_report = build_strict_report(strict_extraction, strict_analysis)
        validated = get_json(redis, f"report:{report_id}:canonical_validated", default={})
        ratios = get_json(redis, f"report:{report_id}:ratios", default={})
        patterns = get_json(redis, f"report:{report_id}:patterns", default=[])
        confidence = get_json(redis, f"report:{report_id}:confidence", default={})
        sector = get_json(redis, f"report:{report_id}:sector_comparison", default={})
        risk = get_json(redis, f"report:{report_id}:risk", default={})
        analysis_coverage = get_json(redis, f"report:{report_id}:analysis_coverage", default={})

        report_payload = _build_report_payload(
            report_id,
            strict_report,
            strict_analysis,
            validated if isinstance(validated, dict) else {},
            ratios if isinstance(ratios, dict) else {},
            patterns if isinstance(patterns, list) else [],
            confidence if isinstance(confidence, dict) else {},
            sector if isinstance(sector, dict) else {},
            risk if isinstance(risk, dict) else {},
            analysis_coverage if isinstance(analysis_coverage, dict) else {},
        )
        set_json(redis, f"report:{report_id}:strict_report", report_payload, cfg.redis_ttl_seconds)

        deleted_count = delete_temporary_financial_statements(report_id)
        lifecycle_log = {
            "report_id": report_id,
            "temporary_storage_collection": "temporary_financial_statements",
            "deleted_documents": deleted_count,
            "status": "deleted_after_report_generation",
        }
        set_json(redis, f"report:{report_id}:temporary_storage_lifecycle", lifecycle_log, cfg.redis_ttl_seconds)

        save_final_report(redis, report_id, report_payload, cfg.redis_ttl_seconds)
        mark_success(redis, report_id)
        return report_payload
    except HTTPException as exc:
        mark_failed(redis, report_id, exc.detail)
        raise
    except Exception as exc:
        mark_failed(redis, report_id, str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc
