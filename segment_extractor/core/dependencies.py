from fastapi import Depends
from redis import Redis

from core.config import get_settings
from core.database import get_redis
from repositories.report_repository import ReportRepository
from services.extraction_service import ExtractionService
from services.gemini_client import GeminiExtractor
from services.transformation_service import TransformationService
from workers.extraction_worker import ExtractionWorker


def get_repository(redis_client: Redis = Depends(get_redis)) -> ReportRepository:
    settings = get_settings()
    return ReportRepository(
        redis_client=redis_client,
        key_prefix=settings.redis_key_prefix,
        ttl_seconds=settings.redis_ttl_seconds,
    )


def get_extraction_service(
    repository: ReportRepository = Depends(get_repository),
) -> ExtractionService:
    settings = get_settings()
    return ExtractionService(
        repository=repository,
        gemini_client=GeminiExtractor(
            api_key=settings.gemini_api_key,
            model_name=settings.gemini_model_name,
        ),
        transformation_service=TransformationService(),
    )


def get_worker(
    extraction_service: ExtractionService = Depends(get_extraction_service),
) -> ExtractionWorker:
    return ExtractionWorker(service=extraction_service)
