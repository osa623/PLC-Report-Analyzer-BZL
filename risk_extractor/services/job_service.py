import json
import logging
from datetime import datetime, timezone
from uuid import uuid4

from redis import Redis

logger = logging.getLogger(__name__)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class JobService:
    def __init__(self, redis_client: Redis, ttl_seconds: int) -> None:
        self.redis_client = redis_client
        self.ttl_seconds = ttl_seconds

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
                "created_at": now,
                "started_at": None,
                "completed_at": None,
                "error_code": None,
            }
            self.redis_client.set(self._child_key(child_job_id), json.dumps(child_payload), ex=self.ttl_seconds)
            children.append(child_payload)

        parent_payload = {
            "parent_job_id": parent_job_id,
            "status": "queued",
            "created_at": now,
            "started_at": None,
            "completed_at": None,
            "total_children": len(children),
            "children": [{"child_job_id": c["child_job_id"], "report_id": c["report_id"]} for c in children],
        }
        self.redis_client.set(self._parent_key(parent_job_id), json.dumps(parent_payload), ex=self.ttl_seconds)

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
                child_results.append("failed")
                continue

            child["status"] = "running"
            child["started_at"] = _utc_now()
            self.update_child(child_job_id, child)

            try:
                status = extraction_service.process(child["report_id"], None)
                child["status"] = status
                child["completed_at"] = _utc_now()
                child["error_code"] = None if status in {"completed", "partial"} else "child_processing_failed"
                child_results.append(status)
            except Exception:
                child["status"] = "failed"
                child["completed_at"] = _utc_now()
                child["error_code"] = "child_processing_exception"
                child_results.append("failed")
            finally:
                self.update_child(child_job_id, child)

        if child_results and all(status == "completed" for status in child_results):
            final_status = "completed"
        elif child_results and any(status in {"completed", "partial"} for status in child_results):
            final_status = "partial"
        else:
            final_status = "failed"

        parent["status"] = final_status
        parent["completed_at"] = _utc_now()
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
        return parent
