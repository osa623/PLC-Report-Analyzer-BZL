import logging
from importlib import import_module
from pathlib import Path

from models.schemas import StoredChunksPayload
from repositories.report_repository import ReportRepository
from services.chunking_service import ChunkingService

logger = logging.getLogger(__name__)


class ParsingService:
    def __init__(self, repository: ReportRepository, chunking_service: ChunkingService) -> None:
        self.repository = repository
        self.chunking_service = chunking_service

    def process(self, report_id: str, file_path: str) -> str:
        pdf_path = Path(file_path)
        if not pdf_path.is_file():
            logger.warning("File not found for report_id=%s", report_id)
            return "failed"

        try:
            fitz = import_module("fitz")
        except Exception:
            logger.error("PyMuPDF import failed for report_id=%s", report_id)
            return "failed"

        pages = []
        has_any_page = False

        try:
            with fitz.open(pdf_path) as doc:
                for page_index in range(len(doc)):
                    has_any_page = True
                    try:
                        page = doc.load_page(page_index)
                        text = page.get_text("text")
                        parsed_page = self.chunking_service.build_page(page_number=page_index + 1, page_text=text or "")
                        pages.append(parsed_page)
                    except Exception as page_exc:
                        logger.warning(
                            "Page extraction failed for report_id=%s page=%s error=%s",
                            report_id,
                            page_index + 1,
                            page_exc.__class__.__name__,
                        )
                        continue
        except Exception as exc:
            logger.error("PDF unreadable for report_id=%s error=%s", report_id, exc.__class__.__name__)
            return "failed"

        if not has_any_page:
            logger.warning("PDF has no pages for report_id=%s", report_id)
            return "failed"

        chunks = self.chunking_service.build_chunks(pages)
        payload = StoredChunksPayload(report_id=report_id, chunks=chunks)
        self.repository.persist_result(report_id=report_id, payload=payload.model_dump())

        return "parsed" if chunks else "failed"
