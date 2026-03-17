from redis import Redis

from services.pattern_service import PatternService


class ProcessingService:
    """Legacy compatibility adapter for older imports."""

    def __init__(self, pattern_service: PatternService) -> None:
        self.pattern_service = pattern_service

    def process(self, report_id: str, file_path: str | None = None) -> dict:
        _ = file_path
        status = self.pattern_service.process(report_id)
        return {"report_id": report_id, "status": status}


class ProcessingServiceFactory:
    @staticmethod
    def create(
        redis_client: Redis,
        input_prefix: str,
        ratios_suffix: str,
        patterns_suffix: str,
        risk_suffix: str,
        strategy_suffix: str,
        ttl_seconds: int,
    ) -> ProcessingService:
        return ProcessingService(
            PatternService(
                redis_client=redis_client,
                input_prefix=input_prefix,
                ratios_suffix=ratios_suffix,
                patterns_suffix=patterns_suffix,
                risk_suffix=risk_suffix,
                strategy_suffix=strategy_suffix,
                ttl_seconds=ttl_seconds,
            )
        )
