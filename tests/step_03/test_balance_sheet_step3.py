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


class SequenceExtractionService:
    def __init__(self, outcomes_by_report):
        self.outcomes_by_report = {k: list(v) for k, v in outcomes_by_report.items()}

    def process(self, report_id, _file_path=None):
        queue = self.outcomes_by_report.get(report_id, ["failed"])
        if not queue:
            return "failed"
        outcome = queue.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class TestStep03BalanceSheet(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repo_root = Path(__file__).resolve().parents[2]
        service_dir = repo_root / "balance_sheet_extractor"
        sys.path.insert(0, str(service_dir))
        sys.path.insert(1, str(repo_root))

        from services.job_service import DEAD_LETTER_STATUS, JobService  # type: ignore

        cls.JobService = JobService
        cls.DEAD_LETTER_STATUS = DEAD_LETTER_STATUS

    def test_retries_then_succeeds_within_max_attempts(self):
        redis = InMemoryRedis()
        service = self.JobService(redis_client=redis, ttl_seconds=60, max_attempts=3)
        result = service.submit_job(["r1"])

        extractor = SequenceExtractionService({"r1": ["failed", RuntimeError("tmp"), "completed"]})
        service.process_parent_job(result["parent_job_id"], extractor)

        parent = service.get_parent_with_children(result["parent_job_id"])
        child = parent["children"][0]

        self.assertEqual(parent["status"], "completed")
        self.assertEqual(parent["dead_letter_count"], 0)
        self.assertEqual(child["status"], "completed")
        self.assertEqual(child["attempts"], 3)
        self.assertIsNone(child["dead_lettered_at"])

    def test_exhausted_retries_moves_child_to_dead_letter(self):
        redis = InMemoryRedis()
        service = self.JobService(redis_client=redis, ttl_seconds=60, max_attempts=3)
        result = service.submit_job(["r1"])

        extractor = SequenceExtractionService({"r1": [RuntimeError("x"), "failed", "failed"]})
        service.process_parent_job(result["parent_job_id"], extractor)

        parent = service.get_parent_with_children(result["parent_job_id"])
        child = parent["children"][0]

        self.assertEqual(parent["status"], "failed")
        self.assertEqual(parent["dead_letter_count"], 1)
        self.assertEqual(child["status"], self.DEAD_LETTER_STATUS)
        self.assertEqual(child["attempts"], 3)
        self.assertIsNotNone(child["dead_lettered_at"])
        self.assertIn(child["error_code"], {"child_processing_exception", "child_processing_failed"})

    def test_mixed_results_produce_partial_with_dead_letter_count(self):
        redis = InMemoryRedis()
        service = self.JobService(redis_client=redis, ttl_seconds=60, max_attempts=2)
        result = service.submit_job(["ok", "bad"])

        extractor = SequenceExtractionService({"ok": ["completed"], "bad": ["failed", "failed"]})
        service.process_parent_job(result["parent_job_id"], extractor)

        parent = service.get_parent_with_children(result["parent_job_id"])
        statuses = {child["report_id"]: child["status"] for child in parent["children"]}

        self.assertEqual(parent["status"], "partial")
        self.assertEqual(parent["dead_letter_count"], 1)
        self.assertEqual(statuses["ok"], "completed")
        self.assertEqual(statuses["bad"], self.DEAD_LETTER_STATUS)


if __name__ == "__main__":
    unittest.main()
