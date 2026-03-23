from typing import Any, Literal

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    report_id: str
    file_path: str | None = None  # deprecated, but kept for compatibility


class ProcessResponse(BaseModel):
    report_id: str
    status: Literal["completed", "partial", "failed"]


class DocumentChunk(BaseModel):
    chunk_id: str
    text_content: str
    page_number: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class DocumentStructure(BaseModel):
    sections: list[dict[str, Any]] = Field(default_factory=list)


class NormalizedBalanceRecord(BaseModel):
    report_id: str
    statement_type: Literal["balance"]

    label: str
    value: float | None
    year: int
    entity_type: str
    semantic_type: str | None = None
    depth: int = 0
    parent: str | None = None
    confidence_score: float = 1.0
    source_chunk_id: str | None = None
    page_number: int | None = None

    # Fields kept for internal processing, but not strictly required by step 9
    section: Literal["Assets", "Liabilities", "Equity"] | None = None
    subsection: str | None = None
    order_index: int = 0
    currency: str | None = None
    scale: str | None = None
    is_negative: bool = False
    note_reference: str | None = None


class ExtractionStorePayload(BaseModel):
    report_id: str
    statement_type: Literal["balance_sheet"]
    status: Literal["completed", "partial", "failed"]
    normalized_rows: list[NormalizedBalanceRecord] = Field(default_factory=list)
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
