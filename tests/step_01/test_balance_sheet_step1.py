import json
import sys
import unittest
from pathlib import Path


class TestStep01BalanceSheet(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        service_dir = repo_root / "balance_sheet_extractor"

        # Ensure local service imports resolve first (not root-level common package).
        sys.path.insert(0, str(service_dir))
        sys.path.insert(1, str(repo_root))

        from common.logging_utils import JsonFormatter, configure_logging  # type: ignore
        from common import error_codes  # type: ignore
        cls.JsonFormatter = JsonFormatter
        cls.configure_logging = staticmethod(configure_logging)
        cls.error_codes = error_codes

    def test_json_formatter_has_required_fields(self) -> None:
        import logging

        formatter = self.JsonFormatter(service_name="balance_sheet_extractor")
        record = logging.LogRecord(
            name="test.logger",
            level=logging.INFO,
            pathname=__file__,
            lineno=1,
            msg="hello world",
            args=(),
            exc_info=None,
        )
        record.report_id = "rpt-123"
        rendered = formatter.format(record)
        payload = json.loads(rendered)

        self.assertIn("timestamp", payload)
        self.assertEqual(payload["level"], "INFO")
        self.assertEqual(payload["service"], "balance_sheet_extractor")
        self.assertEqual(payload["logger"], "test.logger")
        self.assertEqual(payload["message"], "hello world")
        self.assertEqual(payload["report_id"], "rpt-123")

    def test_configure_logging_installs_formatter(self) -> None:
        import logging

        self.configure_logging("balance_sheet_extractor", "INFO")
        root = logging.getLogger()
        self.assertGreaterEqual(len(root.handlers), 1)
        self.assertIsInstance(root.handlers[0].formatter, self.JsonFormatter)

    def test_extraction_service_references_canonical_error_code_constant(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        source_path = repo_root / "balance_sheet_extractor" / "services" / "extraction_service.py"
        source = source_path.read_text(encoding="utf-8")

        self.assertIn("from common import error_codes", source)
        self.assertIn("error_codes.NO_RELEVANT_CHUNKS", source)
        self.assertIn("error_codes.EXTRACTION_ERROR", source)
        self.assertIn("error_codes.TRANSFORMATION_ERROR", source)


if __name__ == "__main__":
    unittest.main()
