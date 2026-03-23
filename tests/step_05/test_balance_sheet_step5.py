import unittest
from pathlib import Path
import sys


class TestStep05BalanceSheetConfidence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repo_root = Path(__file__).resolve().parents[2]
        service_dir = repo_root / "balance_sheet_extractor"
        sys.path.insert(0, str(service_dir))
        sys.path.insert(1, str(repo_root))

        from services.confidence_service import ConfidenceScorer  # type: ignore

        cls.scorer = ConfidenceScorer()

    def test_high_confidence_for_clean_dense_records(self):
        records = [
            {"year": 2024, "value": 100.0},
            {"year": 2023, "value": 90.0},
            {"year": 2022, "value": 80.0},
            {"year": 2021, "value": 70.0},
        ]
        validation_result = {"error_count": 0, "warning_count": 0}

        result = self.scorer.score("balance_sheet", records, validation_result)

        self.assertEqual(result["confidence_band"], "high")
        self.assertGreaterEqual(result["confidence_score"], 80.0)

    def test_medium_confidence_when_warnings_present(self):
        records = [
            {"year": 2024, "value": 100.0},
            {"year": 2023, "value": 90.0},
        ]
        validation_result = {"error_count": 0, "warning_count": 2}

        result = self.scorer.score("balance_sheet", records, validation_result)

        self.assertEqual(result["confidence_band"], "medium")
        self.assertGreaterEqual(result["confidence_score"], 50.0)
        self.assertLess(result["confidence_score"], 80.0)

    def test_low_confidence_when_errors_exist(self):
        records = [{"year": 2024, "value": 100.0}]
        validation_result = {"error_count": 3, "warning_count": 1}

        result = self.scorer.score("balance_sheet", records, validation_result)

        self.assertEqual(result["confidence_band"], "low")
        self.assertLess(result["confidence_score"], 50.0)


if __name__ == "__main__":
    unittest.main()
