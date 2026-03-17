from fastapi import Depends
from redis import Redis

from core.config import get_settings
from core.redis_client import get_redis
from services.kpi_service import SectorKPIService


def get_kpi_service(redis_client: Redis = Depends(get_redis)) -> SectorKPIService:
    settings = get_settings()
    return SectorKPIService(
        redis_client=redis_client,
        input_prefix=settings.redis_key_prefix,
        ratios_suffix=settings.redis_ratios_suffix,
        output_suffix=settings.redis_sector_kpis_suffix,
        ttl_seconds=settings.redis_ttl_seconds,
        benchmarks_file_path=settings.benchmarks_file_path,
    )
