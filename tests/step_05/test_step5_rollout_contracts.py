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


class TestStep05RolloutContracts(unittest.TestCase):
    def test_confidence_service_exists_for_all_target_services(self):
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "services" / "confidence_service.py"
                self.assertTrue(path.exists(), f"Missing confidence service: {path}")
                content = path.read_text(encoding="utf-8-sig")
                self.assertIn("class ConfidenceScorer", content)
                self.assertIn("def score", content)

    def test_extraction_services_emit_confidence_metadata_and_band_logic(self):
        required_snippets = [
            "ConfidenceScorer",
            "self.confidence.score",
            '"confidence_score"',
            '"confidence_band"',
            '"confidence_reasons"',
            '"low_confidence_output"',
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
