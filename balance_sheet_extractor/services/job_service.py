import json
import logging
from datetime import datetime, timezone
from uuid import uuid4

from redis import Redis

logger = logging.getLogger(__name__)

DEFAULT_MAX_ATTEMPTS = 3
DEAD_LETTER_STATUS = "dead_letter"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class JobService:
    def __init__(self, redis_client: Redis, ttl_seconds: int, max_attempts: int = DEFAULT_MAX_ATTEMPTS) -> None:
        self.redis_client = redis_client
        self.ttl_seconds = ttl_seconds
        self.max_attempts = max(1, max_attempts)

    def _parent_key(self, parent_job_id: str) -> str:
        return f"job:{parent_job_id}"

    def _child_key(self, child_job_id: str) -> str:
        return f"job:child:{child_job_id}"

    def submit_job(self, report_ids: list[str]) -> dict:
        parent_job_id = str(uuid4())
        now = _utc_now()

        children = []
        for report_id in report_ids:
            child_job_id = str(uuid4())
            child_payload = {
                "child_job_id": child_job_id,
                "parent_job_id": parent_job_id,
                "report_id": report_id,
                "status": "queued",
                "attempts": 0,
                "max_attempts": self.max_attempts,
                "created_at": now,
                "started_at": None,
                "completed_at": None,
                "dead_lettered_at": None,
                "error_code": None,
            }
            self.redis_client.set(
                self._child_key(child_job_id),
                json.dumps(child_payload),
                ex=self.ttl_seconds,
            )
            children.append(child_payload)

        parent_payload = {
            "parent_job_id": parent_job_id,
            "status": "queued",
            "created_at": now,
            "started_at": None,
            "completed_at": None,
            "total_children": len(children),
            "dead_letter_count": 0,
            "children": [{"child_job_id": c["child_job_id"], "report_id": c["report_id"]} for c in children],
        }
        self.redis_client.set(
            self._parent_key(parent_job_id),
            json.dumps(parent_payload),
            ex=self.ttl_seconds,
        )

        return {
            "parent_job_id": parent_job_id,
            "status": "queued",
            "total_children": len(children),
            "children": [{"child_job_id": c["child_job_id"], "report_id": c["report_id"], "status": c["status"]} for c in children],
        }

    def get_parent_job(self, parent_job_id: str) -> dict | None:
        raw = self.redis_client.get(self._parent_key(parent_job_id))
        if not raw:
            return None
        return json.loads(raw)

    def get_child_job(self, child_job_id: str) -> dict | None:
        raw = self.redis_client.get(self._child_key(child_job_id))
        if not raw:
            return None
        return json.loads(raw)

    def update_parent(self, parent_job_id: str, payload: dict) -> None:
        self.redis_client.set(self._parent_key(parent_job_id), json.dumps(payload), ex=self.ttl_seconds)

    def update_child(self, child_job_id: str, payload: dict) -> None:
        self.redis_client.set(self._child_key(child_job_id), json.dumps(payload), ex=self.ttl_seconds)

    def _mark_child_dead_letter(self, child: dict, error_code: str) -> None:
        child["status"] = DEAD_LETTER_STATUS
        child["completed_at"] = _utc_now()
        child["dead_lettered_at"] = _utc_now()
        child["error_code"] = error_code

    def process_parent_job(self, parent_job_id: str, extraction_service) -> None:
        parent = self.get_parent_job(parent_job_id)
        if not parent:
            logger.error("Parent job not found: %s", parent_job_id)
            return

        parent["status"] = "running"
        parent["started_at"] = _utc_now()
        self.update_parent(parent_job_id, parent)

        child_results: list[str] = []

        for child_ref in parent.get("children", []):
            child_job_id = child_ref["child_job_id"]
            child = self.get_child_job(child_job_id)
            if not child:
                child_results.append(DEAD_LETTER_STATUS)
                continue

            child["status"] = "running"
            child["started_at"] = child.get("started_at") or _utc_now()
            child["error_code"] = None
            child["dead_lettered_at"] = None
            self.update_child(child_job_id, child)

            final_child_status = "failed"
            for _ in range(child.get("attempts", 0), child.get("max_attempts", self.max_attempts)):
                child["attempts"] = child.get("attempts", 0) + 1
                self.update_child(child_job_id, child)
                try:
                    status = extraction_service.process(child["report_id"], None)
                    if status in {"completed", "partial"}:
                        child["status"] = status
                        child["completed_at"] = _utc_now()
                        child["error_code"] = None
                        final_child_status = status
                        break

                    child["status"] = "failed"
                    child["error_code"] = "child_processing_failed"
                    final_child_status = "failed"
                except Exception:
                    child["status"] = "failed"
                    child["error_code"] = "child_processing_exception"
                    final_child_status = "failed"

            if final_child_status == "failed":
                self._mark_child_dead_letter(child, child.get("error_code") or "child_processing_failed")
                final_child_status = DEAD_LETTER_STATUS

            self.update_child(child_job_id, child)
            child_results.append(final_child_status)

        if child_results and all(status == "completed" for status in child_results):
            final_status = "completed"
        elif child_results and any(status in {"completed", "partial"} for status in child_results):
            final_status = "partial"
        else:
            final_status = "failed"

        parent["status"] = final_status
        parent["completed_at"] = _utc_now()
        parent["dead_letter_count"] = sum(1 for status in child_results if status == DEAD_LETTER_STATUS)
        self.update_parent(parent_job_id, parent)

    def get_parent_with_children(self, parent_job_id: str) -> dict | None:
        parent = self.get_parent_job(parent_job_id)
        if not parent:
            return None

        children = []
        for child_ref in parent.get("children", []):
            child = self.get_child_job(child_ref["child_job_id"])
            if child:
                children.append(child)

        parent["children"] = children
        parent["dead_letter_count"] = sum(1 for child in children if child.get("status") == DEAD_LETTER_STATUS)
        return parent
