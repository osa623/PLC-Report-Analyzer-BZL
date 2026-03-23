import unittest
from pathlib import Path
import sys


class TestStep06BalanceSheetConfidenceDetails(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repo_root = Path(__file__).resolve().parents[2]
        service_dir = repo_root / "balance_sheet_extractor"
        sys.path.insert(0, str(service_dir))
        sys.path.insert(1, str(repo_root))

        from services.confidence_service import ConfidenceScorer  # type: ignore

        cls.scorer = ConfidenceScorer()

    def test_analyze_records_returns_distribution_samples_sections(self):
        records = [
            {"section": "assets", "label": "Cash", "year": 2024, "value": 10.0},
            {"section": "assets", "label": "Receivables", "year": None, "value": None},
            {"section": "liabilities", "label": None, "year": 2024, "value": 7.0},
        ]

        result = self.scorer.analyze_records(records)

        self.assertIn("confidence_distribution", result)
        self.assertIn("confidence_samples", result)
        self.assertIn("confidence_section_summary", result)

        distribution = result["confidence_distribution"]
        self.assertEqual(sum(distribution.values()), 3)

        sections = result["confidence_section_summary"]
        section_names = {entry["section"] for entry in sections}
        self.assertIn("assets", section_names)
        self.assertIn("liabilities", section_names)

        samples = result["confidence_samples"]
        self.assertTrue(len(samples) >= 1)
        self.assertIn("row_index", samples[0])
        self.assertIn("band", samples[0])
        self.assertIn("score", samples[0])


if __name__ == "__main__":
    unittest.main()
