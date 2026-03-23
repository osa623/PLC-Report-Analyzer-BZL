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


class TestStep04RolloutContracts(unittest.TestCase):
    def test_validation_service_exists_for_all_target_services(self):
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "services" / "validation_service.py"
                self.assertTrue(path.exists(), f"Missing validation service: {path}")
                content = path.read_text(encoding="utf-8-sig")
                self.assertIn("class ExtractionValidator", content)
                self.assertIn("def validate_records", content)

    def test_extraction_services_use_validation_and_emit_metadata(self):
        required_snippets = [
            "ExtractionValidator",
            "self.validator.validate_records",
            '"validation_errors"',
            '"validation_warnings"',
            '"validation_error_count"',
            '"validation_warning_count"',
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
