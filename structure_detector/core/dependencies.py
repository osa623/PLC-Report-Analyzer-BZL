from fastapi import Depends
from redis import Redis

from core.database import get_redis
from core.config import get_settings
from repositories.report_repository import ReportRepository
from services.processor import ProcessingServiceFactory


def get_repository(redis_client: Redis = Depends(get_redis)) -> ReportRepository:
    settings = get_settings()
    return ReportRepository(
        redis_client=redis_client,
        key_prefix=settings.redis_key_prefix,
        ttl_seconds=settings.redis_ttl_seconds,
    )


def get_processor_service(
    repository: ReportRepository = Depends(get_repository),
):
    return ProcessingServiceFactory.create(repository)
