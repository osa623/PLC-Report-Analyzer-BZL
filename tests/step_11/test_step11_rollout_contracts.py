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


class TestStep11RolloutContracts(unittest.TestCase):
    def test_config_files_expose_observability_settings(self):
        required_snippets = [
            "observability_enabled",
            "observability_tracing_enabled",
            "observability_latency_alert_ms",
            "observability_queue_depth_alert_threshold",
            "observability_failure_rate_alert_threshold",
            "observability_low_confidence_alert_enabled",
        ]
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "core" / "config.py"
                self.assertTrue(path.exists(), f"Missing config file: {path}")
                content = path.read_text(encoding="utf-8-sig")
                for snippet in required_snippets:
                    self.assertIn(snippet, content)

    def test_observability_service_exists_in_each_extractor(self):
        required_snippets = [
            "class ObservabilityService",
            "def trace_context",
            "def capture",
            "latency_threshold_exceeded",
            "failure_rate_threshold_exceeded",
        ]
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "services" / "observability_service.py"
                self.assertTrue(path.exists(), f"Missing observability service: {path}")
                content = path.read_text(encoding="utf-8-sig")
                for snippet in required_snippets:
                    self.assertIn(snippet, content)

    def test_extraction_services_emit_observability_metadata(self):
        required_snippets = [
            "from services.observability_service import ObservabilityService",
            "self.observability = ObservabilityService(",
            "trace_context(",
            "capture(",
            "observability_trace",
            "observability_metadata",
        ]
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "services" / "extraction_service.py"
                self.assertTrue(path.exists(), f"Missing extraction service: {path}")
                content = path.read_text(encoding="utf-8-sig")
                for snippet in required_snippets:
                    self.assertIn(snippet, content)

    def test_docs_deliverables_exist(self):
        runbook = REPO_ROOT / "docs" / "RUNBOOK.md"
        dashboards = REPO_ROOT / "docs" / "OBSERVABILITY_DASHBOARDS.md"

        self.assertTrue(runbook.exists(), f"Missing runbook: {runbook}")
        self.assertTrue(dashboards.exists(), f"Missing dashboards doc: {dashboards}")

        runbook_text = runbook.read_text(encoding="utf-8-sig")
        dashboards_text = dashboards.read_text(encoding="utf-8-sig")

        self.assertIn("Top Incidents", runbook_text)
        self.assertIn("Dashboard Definitions", dashboards_text)
        self.assertIn("Alert Rules", dashboards_text)


if __name__ == "__main__":
    unittest.main()
