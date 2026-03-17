from repositories.report_repository import ReportRepository
from services.extraction_service import ExtractionService
from services.gemini_client import GeminiExtractor
from services.transformation_service import TransformationService
from core.config import get_settings


class ProcessingService:
  def __init__(self, extraction_service: ExtractionService) -> None:
    self.extraction_service = extraction_service

  def process(self, report_id: str, file_path: str) -> str:
    return self.extraction_service.process(report_id, file_path)


class ProcessingServiceFactory:
    @staticmethod
    def create(repository: ReportRepository) -> ProcessingService:
    settings = get_settings()
    extraction_service = ExtractionService(
      repository=repository,
      gemini_client=GeminiExtractor(
        api_key=settings.gemini_api_key,
        model_name=settings.gemini_model_name,
      ),
      transformation_service=TransformationService(),
    )
    return ProcessingService(extraction_service)
