from __future__ import annotations

from platform_core.shared_infra.job_status import update_pipeline_stage


def mark_running(redis, report_id: str) -> None:
    update_pipeline_stage(redis, report_id, "EXTRACTION", "running", 86400)


def mark_success(redis, report_id: str) -> None:
    update_pipeline_stage(redis, report_id, "EXTRACTION", "completed", 86400)


def mark_failed(redis, report_id: str, error: str) -> None:
    update_pipeline_stage(redis, report_id, "EXTRACTION", "failed", 86400, {"error": error})
