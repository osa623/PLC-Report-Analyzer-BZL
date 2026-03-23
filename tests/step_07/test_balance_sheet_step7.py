import unittest
from pathlib import Path
import sys


class TestStep07BalanceSheetConfig(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repo_root = Path(__file__).resolve().parents[2]
        service_dir = repo_root / "balance_sheet_extractor"
        sys.path.insert(0, str(service_dir))
        sys.path.insert(1, str(repo_root))

        from core.config import Settings  # type: ignore

        cls.Settings = Settings

    def test_gemini_strategy_defaults_present(self):
        settings = self.Settings()

        self.assertEqual(settings.gemini_model_name, "gemini-2.0-flash")
        self.assertEqual(settings.gemini_model_alias, "fast")
        self.assertIn("gemini-2.0-flash", settings.gemini_fallback_models)
        self.assertEqual(settings.gemini_temperature, 0.0)
        self.assertEqual(settings.gemini_max_retries, 2)


if __name__ == "__main__":
    unittest.main()
