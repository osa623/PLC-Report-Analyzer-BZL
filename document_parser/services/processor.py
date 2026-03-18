from repositories.report_repository import ReportRepository
from services.chunking_service import ChunkingService
from services.parsing_service import ParsingService


class ProcessingService:
    """Compatibility wrapper for callers still importing ProcessingService."""

    def __init__(self, repository: ReportRepository) -> None:
        self.delegate = ParsingService(repository=repository, chunking_service=ChunkingService())

    def process(self, report_id: str, file_path: str) -> str:
        return self.delegate.process(report_id, file_path)


class ProcessingServiceFactory:
    @staticmethod
    def create(repository: ReportRepository) -> ProcessingService:
        return ProcessingService(repository)
