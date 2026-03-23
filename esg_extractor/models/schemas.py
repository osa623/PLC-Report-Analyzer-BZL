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


class AsyncJobSubmitRequest(BaseModel):
    report_ids: list[str] = Field(min_length=1, max_length=10)


class ChildJobSummary(BaseModel):
    child_job_id: str
    report_id: str
    status: Literal["queued", "running", "completed", "partial", "failed", "dead_letter"]


class AsyncJobSubmitResponse(BaseModel):
    parent_job_id: str
    status: Literal["queued", "running", "completed", "partial", "failed", "dead_letter"]
    total_children: int
    children: list[ChildJobSummary] = Field(default_factory=list)


class ChildJobStatus(BaseModel):
    child_job_id: str
    parent_job_id: str
    report_id: str
    status: Literal["queued", "running", "completed", "partial", "failed", "dead_letter"]
    created_at: str
    started_at: str | None = None
    completed_at: str | None = None
    error_code: str | None = None


class ParentJobStatusResponse(BaseModel):
    parent_job_id: str
    status: Literal["queued", "running", "completed", "partial", "failed", "dead_letter"]
    created_at: str
    started_at: str | None = None
    completed_at: str | None = None
    total_children: int
    children: list[ChildJobStatus] = Field(default_factory=list)

