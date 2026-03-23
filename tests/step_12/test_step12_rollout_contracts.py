import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


class TestStep12RolloutContracts(unittest.TestCase):
    def test_golden_dataset_metadata_exists(self):
        metadata = REPO_ROOT / "data" / "eval" / "golden_set_metadata.json"
        thresholds = REPO_ROOT / "data" / "eval" / "thresholds.json"

        self.assertTrue(metadata.exists(), f"Missing golden metadata: {metadata}")
        self.assertTrue(thresholds.exists(), f"Missing thresholds file: {thresholds}")

        metadata_text = metadata.read_text(encoding="utf-8-sig")
        thresholds_text = thresholds.read_text(encoding="utf-8-sig")

        self.assertIn("dataset_name", metadata_text)
        self.assertIn("cases", metadata_text)
        self.assertIn("numeric_exact_match", thresholds_text)

    def test_benchmark_script_defines_required_metrics(self):
        script = REPO_ROOT / "scripts" / "run_golden_benchmark.py"
        self.assertTrue(script.exists(), f"Missing benchmark script: {script}")
        content = script.read_text(encoding="utf-8-sig")

        required_snippets = [
            "evaluate_case_payloads",
            "field_precision",
            "field_recall",
            "numeric_exact_match",
            "table_structure_correctness",
            "check_regression_gate",
            "--fail-on-regression",
        ]
        for snippet in required_snippets:
            with self.subTest(snippet=snippet):
                self.assertIn(snippet, content)

    def test_test_readme_documents_benchmark_command(self):
        test_readme = REPO_ROOT / "tests" / "README.md"
        self.assertTrue(test_readme.exists(), f"Missing tests guide: {test_readme}")
        readme_text = test_readme.read_text(encoding="utf-8-sig")

        self.assertIn("run_golden_benchmark.py", readme_text)
        self.assertIn("--fail-on-regression", readme_text)


if __name__ == "__main__":
    unittest.main()
