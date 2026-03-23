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


class TestStep06RolloutContracts(unittest.TestCase):
    def test_confidence_service_supports_detailed_analysis(self):
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "services" / "confidence_service.py"
                self.assertTrue(path.exists(), f"Missing confidence service: {path}")
                content = path.read_text(encoding="utf-8-sig")
                self.assertIn("def analyze_records", content)
                self.assertIn('"confidence_distribution"', content)
                self.assertIn('"confidence_section_summary"', content)

    def test_extraction_services_emit_step6_confidence_metadata(self):
        required_snippets = [
            "confidence_details = self.confidence.analyze_records",
            '"confidence_distribution"',
            '"confidence_samples"',
            '"confidence_section_summary"',
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
