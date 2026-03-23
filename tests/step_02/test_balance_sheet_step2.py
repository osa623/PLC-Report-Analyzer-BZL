import json
import unittest
from pathlib import Path
import sys


class InMemoryRedis:
    def __init__(self):
        self.store = {}

    def set(self, key, value, ex=None):
        self.store[key] = value
        return True

    def get(self, key):
        return self.store.get(key)


class FakeExtractionService:
    def __init__(self, status_map):
        self.status_map = status_map

    def process(self, report_id, _file_path=None):
        return self.status_map.get(report_id, "failed")


class TestStep02BalanceSheet(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repo_root = Path(__file__).resolve().parents[2]
        service_dir = repo_root / "balance_sheet_extractor"
        sys.path.insert(0, str(service_dir))
        sys.path.insert(1, str(repo_root))

        from services.job_service import JobService  # type: ignore

        cls.JobService = JobService

    def test_submit_job_creates_parent_and_children(self):
        redis = InMemoryRedis()
        service = self.JobService(redis_client=redis, ttl_seconds=60)

        result = service.submit_job(["r1", "r2"])
        self.assertEqual(result["status"], "queued")
        self.assertEqual(result["total_children"], 2)
        self.assertEqual(len(result["children"]), 2)

        parent = service.get_parent_job(result["parent_job_id"])
        self.assertIsNotNone(parent)
        self.assertEqual(parent["status"], "queued")

    def test_process_parent_job_to_completed(self):
        redis = InMemoryRedis()
        service = self.JobService(redis_client=redis, ttl_seconds=60)

        result = service.submit_job(["r1", "r2"])
        extractor = FakeExtractionService({"r1": "completed", "r2": "completed"})

        service.process_parent_job(result["parent_job_id"], extractor)
        parent = service.get_parent_with_children(result["parent_job_id"])

        self.assertEqual(parent["status"], "completed")
        self.assertEqual(len(parent["children"]), 2)
        self.assertTrue(all(c["status"] == "completed" for c in parent["children"]))

    def test_process_parent_job_to_partial(self):
        redis = InMemoryRedis()
        service = self.JobService(redis_client=redis, ttl_seconds=60)

        result = service.submit_job(["r1", "r2"])
        extractor = FakeExtractionService({"r1": "completed", "r2": "failed"})

        service.process_parent_job(result["parent_job_id"], extractor)
        parent = service.get_parent_with_children(result["parent_job_id"])

        self.assertEqual(parent["status"], "partial")
        statuses = {c["status"] for c in parent["children"]}
        self.assertIn("completed", statuses)
        self.assertTrue("failed" in statuses or "dead_letter" in statuses)


if __name__ == "__main__":
    unittest.main()
