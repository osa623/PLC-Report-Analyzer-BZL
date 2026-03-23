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


class TestStep08RolloutContracts(unittest.TestCase):
    def test_config_files_expose_fallback_settings(self):
        required_snippets = [
            "fallback_provider",
            "fallback_enabled",
            "fallback_kill_switch",
            "fallback_on_low_confidence",
        ]
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "core" / "config.py"
                self.assertTrue(path.exists(), f"Missing config file: {path}")
                content = path.read_text(encoding="utf-8-sig")
                for snippet in required_snippets:
                    self.assertIn(snippet, content)

    def test_fallback_adapter_exists_in_each_extractor(self):
        required_snippets = [
            "class FallbackAdapter",
            "def apply",
            "fallback_attempted",
            "fallback_applied",
            "fallback_reason",
        ]
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "services" / "fallback_adapter.py"
                self.assertTrue(path.exists(), f"Missing fallback adapter: {path}")
                content = path.read_text(encoding="utf-8-sig")
                for snippet in required_snippets:
                    self.assertIn(snippet, content)

    def test_extraction_services_emit_fallback_metadata(self):
        required_snippets = [
            "from services.fallback_adapter import FallbackAdapter",
            "self.fallback_adapter = FallbackAdapter(",
            '"fallback_provider"',
            '"fallback_attempted"',
            '"fallback_applied"',
            '"fallback_reason"',
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
