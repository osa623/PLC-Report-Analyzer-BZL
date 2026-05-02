from __future__ import annotations

from platform_core.shared_infra.job_status import (
    init_pipeline_stages,
    update_extraction_substage,
    update_pipeline_stage,
)


def mark_running(redis, report_id: str) -> None:
    # Initialize all pipeline stages on first extraction run so the
    # frontend always has a well-formed stage state to read.
    init_pipeline_stages(redis, report_id, 86400)
    update_pipeline_stage(redis, report_id, "EXTRACTION", "running", 86400)


def mark_success(redis, report_id: str) -> None:
    update_pipeline_stage(redis, report_id, "EXTRACTION", "completed", 86400)


def mark_failed(redis, report_id: str, error: str) -> None:
    update_pipeline_stage(
        redis, report_id, "EXTRACTION", "failed", 86400, {"error": error}
    )


def mark_substage(redis, report_id: str, substage: str, status: str, diagnostics: dict | None = None) -> None:
    """Update an extraction sub-stage (text_extraction, table_detection, field_mapping, normalization, validation)."""
    update_extraction_substage(redis, report_id, substage, status, 86400, diagnostics)
