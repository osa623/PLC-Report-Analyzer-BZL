from redis import Redis

from services.report_service import ReportService


class ProcessingService:
    """Legacy compatibility adapter for older imports."""

    def __init__(self, report_service: ReportService) -> None:
        self.report_service = report_service

    def process(self, report_id: str, file_path: str | None = None) -> dict:
        _ = file_path
        status = self.report_service.process(report_id)
        return {"report_id": report_id, "status": status}


class ProcessingServiceFactory:
    @staticmethod
    def create(
        redis_client: Redis,
        input_prefix: str,
        ratios_suffix: str,
        patterns_suffix: str,
        final_report_suffix: str,
        ttl_seconds: int,
    ) -> ProcessingService:
        return ProcessingService(
            ReportService(
                redis_client=redis_client,
                input_prefix=input_prefix,
                ratios_suffix=ratios_suffix,
                patterns_suffix=patterns_suffix,
                final_report_suffix=final_report_suffix,
                ttl_seconds=ttl_seconds,
            )
        )
