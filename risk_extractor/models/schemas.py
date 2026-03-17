from typing import Any, Literal

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    report_id: str
    file_path: str


class ProcessResponse(BaseModel):
    report_id: str
    status: Literal["completed", "partial", "failed"]


class RiskRecord(BaseModel):
    report_id: str
    risk_category: Literal["financial", "operational", "market", "regulatory", "other"]
    title: str
    description: str
    severity: str | None = None


class RiskStorePayload(BaseModel):
    report_id: str
    statement_type: Literal["risk"] = "risk"
    status: Literal["completed", "partial", "failed"]
    records: list[RiskRecord] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
