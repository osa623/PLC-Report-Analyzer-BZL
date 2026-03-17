from typing import Any, Literal

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    report_id: str
    file_path: str


class ProcessResponse(BaseModel):
    report_id: str
    status: Literal["completed", "partial", "failed"]


class StrategyRecord(BaseModel):
    report_id: str
    strategy_type: Literal["growth", "expansion", "cost_optimization", "market_positioning", "other"]
    text: str
    confidence: float | None = None


class StrategyStorePayload(BaseModel):
    report_id: str
    statement_type: Literal["strategy"] = "strategy"
    status: Literal["completed", "partial", "failed"]
    records: list[StrategyRecord] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
