from fastapi import Depends
from redis import Redis

from core.database import get_redis
from core.config import get_settings
from repositories.report_repository import ReportRepository
from services.chunking_service import ChunkingService
from services.parsing_service import ParsingService


def get_repository(redis_client: Redis = Depends(get_redis)) -> ReportRepository:
    settings = get_settings()
    return ReportRepository(
        redis_client=redis_client,
        key_prefix=settings.redis_key_prefix,
        ttl_seconds=settings.redis_ttl_seconds,
    )


def get_repository(
    redis_client: Redis = Depends(get_redis_client),
    settings: Settings = Depends(get_settings_dependency),
) -> ReportRepository:
    return ReportRepository(
        redis_client=redis_client,
        key_prefix=settings.redis_key_prefix,
        key_suffix=settings.redis_document_chunks_suffix,
        ttl_seconds=settings.redis_ttl_seconds,
    )


def get_chunking_service(
    settings: Settings = Depends(get_settings_dependency),
) -> ChunkingService:
    return ChunkingService(max_pages_per_chunk=settings.max_pages_per_chunk)


def get_parsing_service(
    repository: ReportRepository = Depends(get_repository),
    chunking_service: ChunkingService = Depends(get_chunking_service),
) -> ParsingService:
    return ParsingService(repository=repository, chunking_service=chunking_service)
