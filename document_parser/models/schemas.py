from typing import Literal

from pydantic import BaseModel


class ProcessRequest(BaseModel):
    report_id: str
    file_path: str


class ProcessResponse(BaseModel):
    report_id: str
    status: Literal["parsed", "failed"]


class ParsedPage(BaseModel):
    page_number: int
    content: str
    text_density: Literal["low", "medium", "high"]
    line_count: int
    possible_section: str | None
    table_score: float


class ChunkMetadata(BaseModel):
    text_density: Literal["low", "medium", "high"]
    line_count: int
    possible_section: str | None


class DocumentChunk(BaseModel):
    chunk_id: str
    page_start: int
    page_end: int
    content: str
    chunk_type: Literal["text", "table", "mixed"]
    metadata: ChunkMetadata


class StoredChunksPayload(BaseModel):
    report_id: str
    chunks: list[DocumentChunk]
