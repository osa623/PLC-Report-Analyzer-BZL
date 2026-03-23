import json
import sys
import unittest
from pathlib import Path


class _FakeRedis:
    def __init__(self, payload: str | None = None) -> None:
        self.payload = payload

    def get(self, key: str):
        return self.payload


class _FakeRepository:
    def __init__(self, payload: str | None = None) -> None:
        self.redis_client = _FakeRedis(payload=payload)


class TestStep08BalanceSheetFallbackAdapter(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repo_root = Path(__file__).resolve().parents[2]
        service_dir = repo_root / "balance_sheet_extractor"
        sys.path.insert(0, str(service_dir))
        sys.path.insert(1, str(repo_root))

        from core.config import Settings  # type: ignore
        from services.fallback_adapter import FallbackAdapter  # type: ignore

        cls.Settings = Settings
        cls.FallbackAdapter = FallbackAdapter

    def test_fallback_config_defaults_present(self):
        settings = self.Settings()

        self.assertEqual(settings.fallback_provider, "none")
        self.assertFalse(settings.fallback_enabled)
        self.assertFalse(settings.fallback_kill_switch)
        self.assertTrue(settings.fallback_on_low_confidence)

    def test_apply_merges_provider_records_for_low_confidence(self):
        provider_payload = json.dumps(
            {
                "records": [
                    {"label": "Cash", "year": 2024, "value": 100.0},
                    {"label": "Debt", "year": 2024, "value": 50.0},
                ]
            }
        )
        repository = _FakeRepository(payload=provider_payload)
        adapter = self.FallbackAdapter(
            repository=repository,
            provider="document_ai",
            enabled=True,
            kill_switch=False,
            run_on_low_confidence=True,
        )

        primary = [{"label": "Cash", "year": 2024, "value": 100.0}]
        merged, metadata = adapter.apply(
            report_id="r1",
            statement_type="balance_sheet",
            primary_records=primary,
            confidence_band="low",
        )

        self.assertTrue(metadata["fallback_attempted"])
        self.assertTrue(metadata["fallback_applied"])
        self.assertEqual(metadata["fallback_reason"], "applied")
        self.assertEqual(metadata["fallback_provider"], "document_ai")
        self.assertEqual(len(merged), 2)

    def test_apply_skips_when_confidence_not_low(self):
        repository = _FakeRepository(payload=json.dumps({"records": [{"label": "A"}]}))
        adapter = self.FallbackAdapter(
            repository=repository,
            provider="azure_di",
            enabled=True,
            kill_switch=False,
            run_on_low_confidence=True,
        )

        primary = [{"label": "Primary"}]
        merged, metadata = adapter.apply(
            report_id="r2",
            statement_type="balance_sheet",
            primary_records=primary,
            confidence_band="medium",
        )

        self.assertEqual(merged, primary)
        self.assertFalse(metadata["fallback_attempted"])
        self.assertFalse(metadata["fallback_applied"])
        self.assertEqual(metadata["fallback_reason"], "confidence_not_low")


if __name__ == "__main__":
    unittest.main()
