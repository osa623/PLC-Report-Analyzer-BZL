import json
import logging
import concurrent.futures
from typing import Any

from common import error_codes
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

    def _fetch_from_redis(self, key: str, default: Any = None) -> Any:
        try:
            raw = self.repository.redis_client.get(key)
            if not raw:
                return default
            return json.loads(raw)
        except Exception as e:
            logger.error("Redis fetch error %s: %s", key, e)
            return default

    def _filter_chunks(self, chunks: list[dict], structure: dict) -> list[dict]:
        relevant = []
        keywords = {"balance sheet", "statement of financial position", "assets", "liabilities", "equity"}
        for chunk in chunks:
            text = str(chunk.get("text_content", "")).lower()
            if any(k in text for k in keywords):
                relevant.append(chunk)
        return relevant

    def process(self, report_id: str, file_path: str = None) -> str:
        status = "completed"
        error_code = None
        validation_errors = []

        chunks_key = f"report:{report_id}:document_chunks"
        structure_key = f"report:{report_id}:structure"

        chunks_data = self._fetch_from_redis(chunks_key)
        structure_data = self._fetch_from_redis(structure_key, {})

        if isinstance(chunks_data, dict) and "chunks" in chunks_data:
            chunks = chunks_data["chunks"]
        elif isinstance(chunks_data, list):
            chunks = chunks_data
        else:
            chunks = []

        filtered_chunks = self._filter_chunks(chunks, structure_data)

        if not filtered_chunks:
            logger.warning("No relevant chunks found for report_id=%s", report_id)
            payload = {
                "report_id": report_id,
                "statement_type": "balance_sheet",
                "status": "failed",
                "normalized_rows": [],
                "metadata": {
                    "total_rows": 0,
                    "validation_errors": [error_codes.NO_RELEVANT_CHUNKS],
                    "processed_chunks": 0
                }
            }
            self.repository.persist_result(report_id, payload)
            return "failed"

        chunk_results = []
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                futures = {
                    executor.submit(self.gemini_client.extract_chunk, ch.get("text_content", "")): ch.get("chunk_id", str(i))
                    for i, ch in enumerate(filtered_chunks)
                }
                for future in concurrent.futures.as_completed(futures):
                    chunk_id = futures[future]
                    try:
                        res = future.result()
                        chunk_results.append((chunk_id, res))
                    except Exception as e:
                        logger.error("Chunk extraction failed for %s: %s", chunk_id, e)
        except Exception as e:
            logger.error("Extraction error %s", e)
            status = "failed"
            error_code = error_codes.EXTRACTION_ERROR

        normalized_records = []
        if status != "failed":
            try:
                normalized_records, is_partial, val_errors = self.transformation_service.merge_and_transform(report_id, chunk_results)
                if is_partial:
                    status = "partial"
                validation_errors.extend(val_errors)
            except Exception as exc:
                logger.error("Transformation failed: %s", exc)
                status = "failed"
                error_code = error_codes.TRANSFORMATION_ERROR

        payload = {
            "statement_type": "balance_sheet",
            "status": status,
            "normalized_rows": normalized_records,
            "metadata": {
                "total_rows": len(normalized_records),
                "validation_errors": validation_errors,
                "processed_chunks": len(chunk_results),
            }
        }
        if error_code:
            payload["metadata"]["error_code"] = error_code

        self.repository.persist_result(report_id=report_id, payload=payload)
        return status
