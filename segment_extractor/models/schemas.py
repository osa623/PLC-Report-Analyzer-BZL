from typing import Any, Literal

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    report_id: str
    file_path: str


class ProcessResponse(BaseModel):
    report_id: str
    status: Literal["completed", "partial", "failed"]


class NormalizedSegmentRecord(BaseModel):
    report_id: str
    statement_type: Literal["segment"]

    segment_name: str
    segment_type: Literal["business", "geographical", "other"]

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
    statement_type: Literal["segment"]
    status: Literal["completed", "partial", "failed"]
    normalized_rows: list[NormalizedSegmentRecord] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
