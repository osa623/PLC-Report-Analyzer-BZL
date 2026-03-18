from redis import Redis

from common.report_repository import ReportRepositoryContract


class ReportRepository(ReportRepositoryContract):
    """Compatibility repository aligned to unified Redis contract."""

    def __init__(self, redis_client: Redis, key_prefix: str, ttl_seconds: int) -> None:
        super().__init__(
            redis_client=redis_client,
            key_prefix=key_prefix,
            ttl_seconds=ttl_seconds,
            default_mode="set",
            default_identifier="sector_kpis",
        )
