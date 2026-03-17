from redis import Redis

from services.ratio_service import RatioService


class ProcessingService:
    """Legacy compatibility adapter for older imports."""

    def __init__(self, ratio_service: RatioService) -> None:
        self.ratio_service = ratio_service

    def process(self, report_id: str, file_path: str | None = None) -> dict:
        _ = file_path
        status = self.ratio_service.process(report_id)
        return {"report_id": report_id, "status": status}


class ProcessingServiceFactory:
    @staticmethod
    def create(redis_client: Redis, input_prefix: str, output_suffix: str, ttl_seconds: int) -> ProcessingService:
        return ProcessingService(
            RatioService(
                redis_client=redis_client,
                input_prefix=input_prefix,
                output_suffix=output_suffix,
                ttl_seconds=ttl_seconds,
            )
        )
