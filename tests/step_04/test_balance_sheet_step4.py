import unittest
from pathlib import Path
import sys


class TestStep04BalanceSheetValidation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repo_root = Path(__file__).resolve().parents[2]
        service_dir = repo_root / "balance_sheet_extractor"
        sys.path.insert(0, str(service_dir))
        sys.path.insert(1, str(repo_root))

        from services.validation_service import ExtractionValidator  # type: ignore

        cls.validator = ExtractionValidator()

    def test_invalid_year_and_numeric_field_are_flagged(self):
        result = self.validator.validate_records(
            "balance_sheet",
            [
                {"label": "Total Assets", "year": 1800, "value": "not-a-number"},
                {"label": "Total Liabilities", "year": "2024", "value": 123.0},
            ],
        )

        self.assertIn("invalid_year_out_of_range", result["errors"])
        self.assertIn("invalid_year_type", result["errors"])
        self.assertIn("invalid_numeric_field:value", result["errors"])
        self.assertGreaterEqual(result["error_count"], 3)

    def test_duplicate_and_missing_year_generate_warnings(self):
        row = {"label": "Revenue", "value": 42.0}
        result = self.validator.validate_records("income_statement", [row, row])

        self.assertIn("duplicate_records_detected", result["warnings"])
        self.assertIn("missing_year_dimension", result["warnings"])
        self.assertGreaterEqual(result["warning_count"], 2)


if __name__ == "__main__":
    unittest.main()
