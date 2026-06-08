from __future__ import annotations

import logging
from datetime import datetime, timezone

from platform_core.contracts.canonical_dataset import CanonicalRawReport, CanonicalValidatedReport, DeterministicChecks
from platform_core.shared_infra.redis_client import set_json

logger = logging.getLogger(__name__)


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

    # Persist finalized normalized statements to MongoDB Atlas
    try:
        from platform_core.mongo_client import get_mongo_db

        db = get_mongo_db()
        collection = db["normalized_financial_statements"]
        mongo_payload = validated.model_dump()
        mongo_payload["_report_id"] = report_id
        mongo_payload["_saved_at"] = datetime.now(timezone.utc).isoformat()

        collection.update_one(
            {"_report_id": report_id},
            {"$set": mongo_payload},
            upsert=True,
        )
        logger.info("Saved normalized financial statements to MongoDB for report_id=%s", report_id)
    except Exception as exc:
        logger.warning("Failed to persist normalized statements to MongoDB for report_id=%s: %s", report_id, exc)

    return validated
