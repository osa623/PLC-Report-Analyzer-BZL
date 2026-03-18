from typing import Any

from redis import Redis

from common.redis_client import json_dumps, json_loads


class ReportRepositoryContract:
    def __init__(
        self,
        redis_client: Redis,
        key_prefix: str,
        ttl_seconds: int,
        default_mode: str | None = None,
        default_identifier: str | None = None,
    ) -> None:
        self.redis_client = redis_client
        self.key_prefix = key_prefix
        self.ttl_seconds = ttl_seconds
        self.default_mode = default_mode
        self.default_identifier = default_identifier

    def _base_key(self, report_id: str) -> str:
        return f"{self.key_prefix}:{report_id}"

    def _section_key(self, report_id: str, suffix: str) -> str:
        return f"{self.key_prefix}:{report_id}:{suffix}"

    def _set_json(self, key: str, payload: Any) -> bool:
        try:
            self.redis_client.set(name=key, value=json_dumps(payload), ex=self.ttl_seconds)
            return True
        except Exception:
            return False

    def _get_json(self, key: str, default: Any) -> Any:
        try:
            raw = self.redis_client.get(key)
        except Exception:
            return default
        return json_loads(raw, default)

    def get_base_report(self, report_id: str) -> dict[str, Any]:
        payload = self._get_json(self._base_key(report_id), {})
        if isinstance(payload, dict):
            return payload
        return {}

    def merge_section(self, report_id: str, section_name: str, payload: dict[str, Any]) -> bool:
        base = self.get_base_report(report_id)
        base["report_id"] = report_id
        base[section_name] = payload
        return self._set_json(self._base_key(report_id), base)

    def get_section(self, report_id: str, suffix: str) -> dict[str, Any]:
        payload = self._get_json(self._section_key(report_id, suffix), {})
        if isinstance(payload, dict):
            return payload
        return {}

    def set_section(self, report_id: str, suffix: str, payload: dict[str, Any]) -> bool:
        return self._set_json(self._section_key(report_id, suffix), payload)

    def persist_result(self, report_id: str, payload: dict[str, Any]) -> bool:
        if self.default_mode == "merge" and self.default_identifier:
            return self.merge_section(report_id, self.default_identifier, payload)
        if self.default_mode == "set" and self.default_identifier:
            return self.set_section(report_id, self.default_identifier, payload)
        return False
