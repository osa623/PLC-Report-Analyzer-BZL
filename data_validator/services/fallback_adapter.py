import json
from typing import Any

from repositories.report_repository import ReportRepository


class FallbackAdapter:
    def __init__(
        self,
        repository: ReportRepository,
        provider: str = "none",
        enabled: bool = False,
        kill_switch: bool = False,
        run_on_low_confidence: bool = True,
    ) -> None:
        self.repository = repository
        self.provider = provider
        self.enabled = enabled
        self.kill_switch = kill_switch
        self.run_on_low_confidence = run_on_low_confidence

    @staticmethod
    def _dedupe_records(primary: list[dict[str, Any]], fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: set[str] = set()
        merged: list[dict[str, Any]] = []

        for record in primary + fallback:
            key = json.dumps(record, sort_keys=True, default=str)
            if key in seen:
                continue
            seen.add(key)
            merged.append(record)

        return merged

    def _extract_records_from_payload(self, payload: Any) -> list[dict[str, Any]]:
        if not isinstance(payload, dict):
            return []

        for key in ("normalized_rows", "records", "rows"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        return []

    def apply(
        self,
        report_id: str,
        statement_type: str,
        primary_records: list[dict[str, Any]],
        confidence_band: str,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        metadata = {
            "fallback_provider": self.provider,
            "fallback_attempted": False,
            "fallback_applied": False,
            "fallback_reason": "disabled",
        }

        if not self.enabled:
            return primary_records, metadata
        if self.kill_switch:
            metadata["fallback_reason"] = "kill_switch_enabled"
            return primary_records, metadata
        if not self.run_on_low_confidence:
            metadata["fallback_reason"] = "policy_disabled"
            return primary_records, metadata
        if confidence_band != "low":
            metadata["fallback_reason"] = "confidence_not_low"
            return primary_records, metadata

        metadata["fallback_attempted"] = True

        key = f"report:{report_id}:fallback:{statement_type}"
        raw = self.repository.redis_client.get(key)
        if not raw:
            metadata["fallback_reason"] = "no_provider_payload"
            return primary_records, metadata

        try:
            payload = json.loads(raw)
        except Exception:
            metadata["fallback_reason"] = "provider_payload_invalid_json"
            return primary_records, metadata

        fallback_records = self._extract_records_from_payload(payload)
        if not fallback_records:
            metadata["fallback_reason"] = "provider_payload_empty"
            return primary_records, metadata

        merged_records = self._dedupe_records(primary_records, fallback_records)
        metadata["fallback_applied"] = True
        metadata["fallback_reason"] = "applied"
        return merged_records, metadata
