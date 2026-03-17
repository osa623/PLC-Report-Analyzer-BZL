from typing import Any, Literal

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    report_id: str
    file_path: str


class ProcessResponse(BaseModel):
    report_id: str
    status: Literal["completed", "partial", "failed"]


class GovernanceRecord(BaseModel):
    report_id: str
    type: Literal["board_member", "committee", "executive_leader", "governance_policy"]

    name: str
    role: str | None = None
    classification: str | None = None
    members: list[str] | None = None
    text: str | None = None


class GovernanceStorePayload(BaseModel):
    report_id: str
    statement_type: Literal["governance"] = "governance"
    status: Literal["completed", "partial", "failed"]
    records: list[GovernanceRecord] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
