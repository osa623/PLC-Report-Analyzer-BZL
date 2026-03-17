import logging
from pathlib import Path

from repositories.report_repository import ReportRepository
from services.gemini_client import GeminiExtractor
from services.transformation_service import TransformationService

logger = logging.getLogger(__name__)


class ExtractionService:
    def __init__(
        self,
        repository: ReportRepository,
        gemini_client: GeminiExtractor,
        transformation_service: TransformationService,
    ) -> None:
        self.repository = repository
        self.gemini_client = gemini_client
        self.transformation_service = transformation_service

    def process(self, report_id: str, file_path: str) -> str:
        status = "completed"
        records: list[dict] = []
        error_code: str | None = None
        governance_sections_count = 0

        if not Path(file_path).is_file():
            status = "failed"
            error_code = "file_not_found"
        else:
            raw_payload: dict = {}
            try:
                raw_payload = self.gemini_client.extract_governance(file_path)
                governance_sections_count = sum(
                    len(raw_payload.get(key, []))
                    for key in ("board_members", "committees", "executive_leadership", "governance_policies")
                    if isinstance(raw_payload.get(key), list)
                )
                records, is_partial = self.transformation_service.transform(report_id, raw_payload)
                if is_partial:
                    status = "partial"
            except Exception as exc:
                logger.error(
                    "Governance extraction failed for report_id=%s: %s",
                    report_id,
                    exc.__class__.__name__,
                )
                status = "failed"
                error_code = "gemini_or_transform_error"

        payload = {
            "report_id": report_id,
            "statement_type": "governance",
            "status": status,
            "records": records,
            "metadata": {
                "source_file": file_path,
                "record_count": len(records),
                "governance_sections_count": governance_sections_count,
                "error_code": error_code,
            },
        }

        self.repository.persist_result(report_id=report_id, payload=payload)
        return status
