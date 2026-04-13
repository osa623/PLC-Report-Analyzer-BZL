from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4


class JobLifecycleStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    VALIDATING = "VALIDATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


@dataclass
class JobRecord:
    job_id: str
    payload: dict[str, Any]
    status: JobLifecycleStatus
    retries: int = 0
    max_retries: int = 2
    error: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class JobManager:
    """Unified in-memory job lifecycle manager with retry and dead-letter support."""

    def __init__(self) -> None:
        self._jobs: dict[str, JobRecord] = {}
        self._dead_letter: dict[str, JobRecord] = {}

    def submit_job(self, payload: dict[str, Any], max_retries: int = 2) -> JobRecord:
        job_id = str(uuid4())
        record = JobRecord(
            job_id=job_id,
            payload=payload,
            status=JobLifecycleStatus.QUEUED,
            max_retries=max_retries,
        )
        self._jobs[job_id] = record
        return record

    def start_job(self, job_id: str) -> JobRecord:
        return self._update(job_id, JobLifecycleStatus.RUNNING)

    def mark_validating(self, job_id: str) -> JobRecord:
        return self._update(job_id, JobLifecycleStatus.VALIDATING)

    def complete_job(self, job_id: str) -> JobRecord:
        return self._update(job_id, JobLifecycleStatus.COMPLETED, error=None)

    def fail_job(self, job_id: str, error: str) -> JobRecord:
        record = self._update(job_id, JobLifecycleStatus.FAILED, error=error)
        if record.retries >= record.max_retries:
            self._dead_letter[job_id] = record
        return record

    def retry_job(self, job_id: str) -> JobRecord:
        record = self.get_job(job_id)
        if record.retries >= record.max_retries:
            raise RuntimeError("max_retries_reached")

        record.retries += 1
        record.status = JobLifecycleStatus.QUEUED
        record.error = None
        record.updated_at = datetime.now(timezone.utc).isoformat()
        return record

    def get_job(self, job_id: str) -> JobRecord:
        if job_id not in self._jobs:
            raise KeyError(f"job_not_found:{job_id}")
        return self._jobs[job_id]

    def get_dead_letter(self) -> list[JobRecord]:
        return list(self._dead_letter.values())

    def _update(
        self,
        job_id: str,
        status: JobLifecycleStatus,
        error: str | None = None,
    ) -> JobRecord:
        record = self.get_job(job_id)
        record.status = status
        record.error = error
        record.updated_at = datetime.now(timezone.utc).isoformat()
        return record
