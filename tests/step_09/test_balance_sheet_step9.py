import sys
import unittest
from pathlib import Path


class TestStep09BalanceSheetRoutingPolicy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repo_root = Path(__file__).resolve().parents[2]
        service_dir = repo_root / "balance_sheet_extractor"
        sys.path.insert(0, str(service_dir))
        sys.path.insert(1, str(repo_root))

        from core.config import Settings  # type: ignore
        from services.routing_policy import ConfidenceRoutingPolicy  # type: ignore

        cls.Settings = Settings
        cls.ConfidenceRoutingPolicy = ConfidenceRoutingPolicy

    def test_routing_config_defaults_present(self):
        settings = self.Settings()

        self.assertTrue(settings.confidence_routing_enabled)
        self.assertFalse(settings.confidence_routing_fallback_on_medium)
        self.assertTrue(settings.confidence_routing_fail_on_low)

    def test_route_before_fallback_for_low_confidence(self):
        policy = self.ConfidenceRoutingPolicy(enabled=True, fallback_on_medium=False, fail_on_low=True)

        decision = policy.route_before_fallback(status="completed", confidence_band="low")

        self.assertEqual(decision["decision"], "fallback")
        self.assertTrue(decision["should_attempt_fallback"])
        self.assertEqual(decision["reason"], "low_confidence")

    def test_resolve_after_extraction_for_low_confidence_with_fallback_attempt(self):
        policy = self.ConfidenceRoutingPolicy(enabled=True, fallback_on_medium=False, fail_on_low=True)

        status, error_code = policy.resolve_after_extraction(
            status="completed",
            confidence_band="low",
            fallback_attempted=True,
        )

        self.assertEqual(status, "failed")
        self.assertEqual(error_code, "low_confidence_after_fallback")


if __name__ == "__main__":
    unittest.main()
