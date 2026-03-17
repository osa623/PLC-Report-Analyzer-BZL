from typing import Any, Literal

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    report_id: str


class ProcessResponse(BaseModel):
    report_id: str
    status: Literal["completed", "not_found", "failed"]


class PatternRecord(BaseModel):
    pattern_type: str
    year: int
    entity_type: str
    confidence: float
    description: str
    supporting_metrics: list[str] = Field(default_factory=list)


class PatternPayload(BaseModel):
    report_id: str
    patterns: list[PatternRecord] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
