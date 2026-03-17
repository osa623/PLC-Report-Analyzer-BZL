from typing import Any, Literal

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    report_id: str
    sector: str


class ProcessResponse(BaseModel):
    report_id: str
    status: Literal["completed", "not_found", "failed"]


class SectorKPIRecord(BaseModel):
    metric: str
    company_value: float
    sector_average: float
    deviation: float
    performance: Literal["above", "below", "inline"]


class SectorKPIPayload(BaseModel):
    sector: str
    kpis: list[SectorKPIRecord] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
