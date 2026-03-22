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


class NormalizedCashflowRecord(BaseModel):
    report_id: str
    statement_type: Literal["cashflow"]

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

    # Fields kept for internal processing
    section: Literal["Operating Activities", "Investing Activities", "Financing Activities"] | None = None
    subsection: str | None = None
    order_index: int = 0
    currency: str | None = None
    scale: str | None = None
    is_negative: bool = False
    note_reference: str | None = None


class ExtractionStorePayload(BaseModel):
    report_id: str
    statement_type: Literal["cashflow_statement"]
    status: Literal["completed", "partial", "failed"]
    normalized_rows: list[NormalizedCashflowRecord] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
