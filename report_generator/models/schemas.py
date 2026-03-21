from typing import Any, Literal

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    report_id: str


class ProcessResponse(BaseModel):
    report_id: str
    status: Literal["completed", "not_found", "failed"]
    pdf_path: str | None = None


class FinalPattern(BaseModel):
    pattern_type: str
    description: str
    confidence: float


class FinalReport(BaseModel):
    report_id: str
    summary: dict[str, float | None] = Field(default_factory=dict)
    ratios: dict[str, dict[str, Any]] = Field(default_factory=dict)
    patterns: list[FinalPattern] = Field(default_factory=list)
    segment_analysis: list[dict[str, Any]] = Field(default_factory=list)
    risk_flags: list[dict[str, Any]] = Field(default_factory=list)
    narrative_consistency: list[dict[str, Any]] = Field(default_factory=list)
