from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from threading import RLock
from typing import Any, Iterator


@dataclass
class SchemaVersion:
    version: str = "v1"


class BaseRepository:
    def __init__(self) -> None:
        self._lock = RLock()
        self._schema = SchemaVersion()

    @contextmanager
    def transaction(self) -> Iterator[None]:
        with self._lock:
            yield

    @property
    def schema_version(self) -> str:
        return self._schema.version


class ReportRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__()
        self._reports: dict[str, dict[str, Any]] = {}

    def upsert(self, report_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        with self.transaction():
            self._reports[report_id] = payload
            return payload

    def get(self, report_id: str) -> dict[str, Any] | None:
        with self.transaction():
            return self._reports.get(report_id)


class JobRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__()
        self._jobs: dict[str, dict[str, Any]] = {}

    def upsert(self, job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        with self.transaction():
            self._jobs[job_id] = payload
            return payload

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self.transaction():
            return self._jobs.get(job_id)


class PipelineRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__()
        self._pipelines: dict[str, dict[str, Any]] = {}

    def upsert(self, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        with self.transaction():
            self._pipelines[run_id] = payload
            return payload

    def get(self, run_id: str) -> dict[str, Any] | None:
        with self.transaction():
            return self._pipelines.get(run_id)
