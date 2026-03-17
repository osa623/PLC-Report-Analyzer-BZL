import json

from redis import Redis


class ReportRepository:
    def __init__(self, redis_client: Redis, key_prefix: str, ttl_seconds: int) -> None:
        self.redis_client = redis_client
        self.key_prefix = key_prefix
        self.ttl_seconds = ttl_seconds

    def build_key(self, report_id: str) -> str:
        return f"{self.key_prefix}:{report_id}"

    def persist_result(self, report_id: str, payload: dict) -> None:
        key = self.build_key(report_id)
        value = json.dumps(payload, ensure_ascii=True)
        self.redis_client.set(name=key, value=value, ex=self.ttl_seconds)
