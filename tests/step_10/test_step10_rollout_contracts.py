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


class TestStep10RolloutContracts(unittest.TestCase):
    def test_config_files_expose_guardrails_settings(self):
        required_snippets = [
            "guardrails_enabled",
            "guardrails_max_chunks_per_report",
            "guardrails_max_total_input_chars",
            "guardrails_processing_timeout_seconds",
            "guardrails_fallback_max_attempts_per_report",
            "guardrails_usage_metering_enabled",
            "guardrails_per_user_reports_per_hour",
            "guardrails_per_ip_reports_per_hour",
        ]
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "core" / "config.py"
                self.assertTrue(path.exists(), f"Missing config file: {path}")
                content = path.read_text(encoding="utf-8-sig")
                for snippet in required_snippets:
                    self.assertIn(snippet, content)

    def test_guardrails_service_exists_in_each_extractor(self):
        required_snippets = [
            "class ProcessingGuardrails",
            "def check_input_limits",
            "def allow_fallback_attempt",
            "def usage_metadata",
        ]
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "services" / "guardrails_service.py"
                self.assertTrue(path.exists(), f"Missing guardrails service: {path}")
                content = path.read_text(encoding="utf-8-sig")
                for snippet in required_snippets:
                    self.assertIn(snippet, content)

    def test_extraction_services_integrate_guardrails(self):
        required_snippets = [
            "from services.guardrails_service import ProcessingGuardrails",
            "self.guardrails = ProcessingGuardrails(",
            "check_input_limits(",
            "allow_fallback_attempt(",
            "usage_metadata(",
            "processing_timeout_exceeded",
            '"guardrails_enabled"',
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
