from redis import Redis

from services.kpi_service import SectorKPIService


class ProcessingService:
    """Legacy compatibility adapter for older imports."""

    def __init__(self, kpi_service: SectorKPIService) -> None:
        self.kpi_service = kpi_service

    def process(self, report_id: str, sector: str) -> dict:
        status = self.kpi_service.process(report_id, sector)
        return {"report_id": report_id, "status": status}


class ProcessingServiceFactory:
    @staticmethod
    def create(
        redis_client: Redis,
        input_prefix: str,
        ratios_suffix: str,
        output_suffix: str,
        ttl_seconds: int,
        benchmarks_file_path: str,
    ) -> ProcessingService:
        return ProcessingService(
            SectorKPIService(
                redis_client=redis_client,
                input_prefix=input_prefix,
                ratios_suffix=ratios_suffix,
                output_suffix=output_suffix,
                ttl_seconds=ttl_seconds,
                benchmarks_file_path=benchmarks_file_path,
            )
        )
