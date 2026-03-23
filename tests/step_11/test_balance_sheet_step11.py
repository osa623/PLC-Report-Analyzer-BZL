import sys
import time
import unittest
from pathlib import Path


class _FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.counters: dict[str, int] = {}

    def get(self, key: str):
        if key in self.counters:
            return str(self.counters[key])
        return self.store.get(key)

    def set(self, key: str, value: str, ex: int | None = None):
        self.store[key] = value
        return True

    def incr(self, key: str):
        self.counters[key] = self.counters.get(key, 0) + 1
        return self.counters[key]

    def expire(self, key: str, seconds: int):
        return True


class _FakeRepository:
    def __init__(self) -> None:
        self.redis_client = _FakeRedis()


class TestStep11BalanceSheetObservability(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repo_root = Path(__file__).resolve().parents[2]
        service_dir = repo_root / "balance_sheet_extractor"
        sys.path.insert(0, str(service_dir))
        sys.path.insert(1, str(repo_root))

        from core.config import Settings  # type: ignore
        from services.observability_service import ObservabilityService  # type: ignore

        cls.Settings = Settings
        cls.ObservabilityService = ObservabilityService

    def test_observability_config_defaults_present(self):
        settings = self.Settings()

        self.assertTrue(settings.observability_enabled)
        self.assertTrue(settings.observability_tracing_enabled)
        self.assertEqual(settings.observability_latency_alert_ms, 60000)
        self.assertEqual(settings.observability_queue_depth_alert_threshold, 100)
        self.assertEqual(settings.observability_failure_rate_alert_threshold, 20.0)

    def test_capture_emits_latency_queue_and_alerts(self):
        repo = _FakeRepository()
        repo.redis_client.counters["jobs:queue_depth"] = 150
        service = self.ObservabilityService(
            repository=repo,
            enabled=True,
            tracing_enabled=True,
            latency_alert_ms=1,
            queue_depth_alert_threshold=100,
            failure_rate_alert_threshold=1.0,
            low_confidence_alert_enabled=True,
        )

        started_at = time.monotonic() - 0.01
        metadata = service.capture(
            report_id="r-obs",
            statement_type="balance_sheet",
            status="failed",
            processed_chunks=5,
            output_rows=3,
            confidence_band="low",
            fallback_attempted=True,
            started_at=started_at,
        )

        self.assertTrue(metadata["observability_enabled"])
        self.assertIn("latency_threshold_exceeded", metadata["observability_alerts"])
        self.assertIn("queue_depth_threshold_exceeded", metadata["observability_alerts"])
        self.assertIn("failure_rate_threshold_exceeded", metadata["observability_alerts"])
        self.assertIn("low_confidence_output", metadata["observability_alerts"])


if __name__ == "__main__":
    unittest.main()
