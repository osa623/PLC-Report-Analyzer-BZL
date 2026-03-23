from typing import Any, Literal

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    report_id: str
    file_path: str


class ProcessResponse(BaseModel):
    report_id: str
    status: Literal["completed", "partial", "failed"]


class NormalizedIncomeNoteRecord(BaseModel):
    report_id: str
    statement_type: Literal["income_notes"]

    note_number: str
    note_title: str

    entity_type: Literal["company", "group", "bank"]
    year: int

    label: str
    value: float | None

    section: str | None = None
    subsection: str | None = None

    parent_label: str | None = None
    depth_level: int = 0
    order_index: int

    currency: str | None = None
    scale: str | None = None
    is_negative: bool = False

    note_reference: str | None = None
    page_number: int | None = None

    semantic_type: str | None = None


class ExtractionStorePayload(BaseModel):
    report_id: str
    statement_type: Literal["income_notes"]
    status: Literal["completed", "partial", "failed"]
    normalized_rows: list[NormalizedIncomeNoteRecord] = Field(default_factory=list)
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
