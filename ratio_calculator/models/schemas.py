from typing import Any, Literal

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    report_id: str


class ProcessResponse(BaseModel):
    report_id: str
    status: Literal["completed", "not_found", "failed"]


class RatioRecord(BaseModel):
    name: str
    year: int
    entity_type: str
    value: float


class RatiosPayload(BaseModel):
    report_id: str
    ratios: list[RatioRecord] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
