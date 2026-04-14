from __future__ import annotations

from platform_core.contracts.canonical_dataset import (
    CanonicalRawReport,
    FinancialStatements,
    NarrativeSections,
)
from platform_core.shared_infra.redis_client import set_json


def save_canonical_raw(
    redis, report_id: str, extraction_output: dict, ttl_seconds: int
) -> CanonicalRawReport:
    payload = CanonicalRawReport(
        report_id=report_id,
        financial_statements=FinancialStatements(
            **extraction_output["financial_statements"]
        ),
        narrative_sections=NarrativeSections(**extraction_output["narrative_sections"]),
    )
    set_json(
        redis, f"report:{report_id}:canonical_raw", payload.model_dump(), ttl_seconds
    )
    return payload
