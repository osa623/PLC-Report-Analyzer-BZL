import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
TARGET_SERVICES = [
    "balance_sheet_extractor",
    "cashflow_statement_extractor",
    "income_statement_extractor",
    "income_notes_extractor",
    "esg_extractor",
    "governance_extractor",
    "risk_extractor",
    "segment_extractor",
]


class TestStep09RolloutContracts(unittest.TestCase):
    def test_config_files_expose_confidence_routing_settings(self):
        required_snippets = [
            "confidence_routing_enabled",
            "confidence_routing_fallback_on_medium",
            "confidence_routing_fail_on_low",
        ]
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "core" / "config.py"
                self.assertTrue(path.exists(), f"Missing config file: {path}")
                content = path.read_text(encoding="utf-8-sig")
                for snippet in required_snippets:
                    self.assertIn(snippet, content)

    def test_routing_policy_exists_in_each_extractor(self):
        required_snippets = [
            "class ConfidenceRoutingPolicy",
            "def route_before_fallback",
            "def resolve_after_extraction",
            "should_attempt_fallback",
        ]
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "services" / "routing_policy.py"
                self.assertTrue(path.exists(), f"Missing routing policy: {path}")
                content = path.read_text(encoding="utf-8-sig")
                for snippet in required_snippets:
                    self.assertIn(snippet, content)

    def test_extraction_services_emit_routing_metadata(self):
        required_snippets = [
            "from services.routing_policy import ConfidenceRoutingPolicy",
            "self.routing_policy = ConfidenceRoutingPolicy(",
            "route_before_fallback(",
            "resolve_after_extraction(",
            '"confidence_routing_decision"',
            '"confidence_routing_reason"',
        ]
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "services" / "extraction_service.py"
                self.assertTrue(path.exists(), f"Missing extraction service: {path}")
                content = path.read_text(encoding="utf-8-sig")
                for snippet in required_snippets:
                    self.assertIn(snippet, content)


if __name__ == "__main__":
    unittest.main()
