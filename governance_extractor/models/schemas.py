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


class AsyncJobSubmitRequest(BaseModel):
    report_ids: list[str] = Field(min_length=1, max_length=10)


class ChildJobSummary(BaseModel):
    child_job_id: str
    report_id: str
    status: Literal["queued", "running", "completed", "partial", "failed"]


class AsyncJobSubmitResponse(BaseModel):
    parent_job_id: str
    status: Literal["queued", "running", "completed", "partial", "failed"]
    total_children: int
    children: list[ChildJobSummary] = Field(default_factory=list)


class ChildJobStatus(BaseModel):
    child_job_id: str
    parent_job_id: str
    report_id: str
    status: Literal["queued", "running", "completed", "partial", "failed"]
    created_at: str
    started_at: str | None = None
    completed_at: str | None = None
    error_code: str | None = None


class ParentJobStatusResponse(BaseModel):
    parent_job_id: str
    status: Literal["queued", "running", "completed", "partial", "failed"]
    created_at: str
    started_at: str | None = None
    completed_at: str | None = None
    total_children: int
    children: list[ChildJobStatus] = Field(default_factory=list)
