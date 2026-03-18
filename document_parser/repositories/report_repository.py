import json

from redis import Redis


class ReportRepository:
    def __init__(
        self,
        redis_client: Redis,
        key_prefix: str,
        key_suffix: str,
        ttl_seconds: int,
    ) -> None:
        self.redis_client = redis_client
        self.key_prefix = key_prefix
        self.key_suffix = key_suffix
        self.ttl_seconds = ttl_seconds

    def build_key(self, report_id: str) -> str:
        return f"{self.key_prefix}:{report_id}:{self.key_suffix}"

    def persist_result(self, report_id: str, payload: dict) -> None:
        self.redis_client.set(
            name=self.build_key(report_id),
            value=json.dumps(payload, ensure_ascii=True),
            ex=self.ttl_seconds,
        )
