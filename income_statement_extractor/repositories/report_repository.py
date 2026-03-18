from redis import Redis

from common.report_repository import ReportRepositoryContract


class ReportRepository(ReportRepositoryContract):
    def __init__(self, redis_client: Redis, key_prefix: str, ttl_seconds: int) -> None:
        super().__init__(
            redis_client=redis_client,
            key_prefix=key_prefix,
            ttl_seconds=ttl_seconds,
            default_mode="merge",
            default_identifier="income_statement",
        )
