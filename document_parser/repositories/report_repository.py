from redis import Redis

from common.report_repository import ReportRepositoryContract


class ReportRepository(ReportRepositoryContract):
    def __init__(self, redis_client: Redis, key_prefix: str, ttl_seconds: int) -> None:
        super().__init__(
            redis_client=redis_client,
            key_prefix=key_prefix,
            ttl_seconds=ttl_seconds,
            default_mode="merge",
            default_identifier="document_chunks",
        )

    def persist_result(self, report_id: str, payload: dict) -> bool:
        # Compatibility write: extractors read the dedicated section key,
        # while downstream aggregators often read from the merged base key.
        merged_ok = self.merge_section(report_id, "document_chunks", payload)
        section_ok = self.set_section(report_id, "document_chunks", payload)
        return merged_ok and section_ok
