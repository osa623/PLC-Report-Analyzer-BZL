from __future__ import annotations

from platform_core.contracts.canonical_dataset import CanonicalRawReport, CanonicalValidatedReport, DeterministicChecks
from platform_core.shared_infra.redis_client import set_json


def save_canonical_validated(redis, report_id: str, canonical_raw: CanonicalRawReport, checks: DeterministicChecks, issues: list, ttl_seconds: int) -> CanonicalValidatedReport:
    validated = CanonicalValidatedReport(
        report_id=report_id,
        financial_statements=canonical_raw.financial_statements,
        narrative_sections=canonical_raw.narrative_sections,
        deterministic_checks=checks,
        validation_issues=issues,
        reextraction_required=len(issues) > 0,
    )
    set_json(redis, f"report:{report_id}:canonical_validated", validated.model_dump(), ttl_seconds)
    return validated
