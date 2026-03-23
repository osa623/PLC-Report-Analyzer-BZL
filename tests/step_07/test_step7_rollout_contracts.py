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


class TestStep07RolloutContracts(unittest.TestCase):
    def test_config_files_expose_gemini_strategy_settings(self):
        required_snippets = [
            "gemini_model_alias",
            "gemini_fallback_models",
            "gemini_temperature",
            "gemini_max_retries",
        ]
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "core" / "config.py"
                self.assertTrue(path.exists(), f"Missing config file: {path}")
                content = path.read_text(encoding="utf-8-sig")
                for snippet in required_snippets:
                    self.assertIn(snippet, content)

    def test_dependencies_pass_strategy_settings_to_gemini_client(self):
        required_snippets = [
            "model_alias=settings.gemini_model_alias",
            "settings.gemini_fallback_models.split",
            "temperature=settings.gemini_temperature",
            "max_retries=settings.gemini_max_retries",
        ]
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "core" / "dependencies.py"
                self.assertTrue(path.exists(), f"Missing dependencies file: {path}")
                content = path.read_text(encoding="utf-8-sig")
                for snippet in required_snippets:
                    self.assertIn(snippet, content)

    def test_gemini_clients_include_strategy_methods(self):
        required_snippets = [
            "_default_models_for_alias",
            "_build_model_candidates",
            "_generate_with_strategy",
            "self.max_retries",
            "temperature=self.temperature",
        ]
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "services" / "gemini_client.py"
                self.assertTrue(path.exists(), f"Missing gemini client file: {path}")
                content = path.read_text(encoding="utf-8-sig")
                for snippet in required_snippets:
                    self.assertIn(snippet, content)


if __name__ == "__main__":
    unittest.main()
