from typing import Any, Literal

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    report_id: str
    file_path: str


class ProcessResponse(BaseModel):
    report_id: str
    status: Literal["completed", "partial", "failed"]


class ESGRecord(BaseModel):
    report_id: str
    category: Literal["environmental", "social", "governance", "other"]
    label: str
    type: Literal["metric", "narrative"]

    year: int | None = None
    value: float | None = None
    unit: str | None = None

    text: str | None = None


class ESGStorePayload(BaseModel):
    report_id: str
    statement_type: Literal["esg"] = "esg"
    status: Literal["completed", "partial", "failed"]
    records: list[ESGRecord] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
