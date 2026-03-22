import concurrent.futures
import json
import logging
from typing import Any

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
        except Exception as exc:
            logger.error("Redis fetch error for key=%s: %s", key, exc)
            return default

    def _filter_chunks(self, chunks: list[dict]) -> list[dict]:
        keywords = {
            "note",
            "revenue",
            "cost of sales",
            "operating expense",
            "other income",
            "income",
        }
        relevant: list[dict] = []
        for chunk in chunks:
            text = str(chunk.get("text_content", "")).lower()
            if any(keyword in text for keyword in keywords):
                relevant.append(chunk)
        return relevant

    @staticmethod
    def _merge_chunk_payloads(chunk_payloads: list[dict[str, Any]]) -> dict[str, Any]:
        notes: list[dict[str, Any]] = []
        currency: str | None = None
        scale: str | None = None

        for payload in chunk_payloads:
            if not isinstance(payload, dict):
                continue
            payload_notes = payload.get("notes")
            if isinstance(payload_notes, list):
                notes.extend(note for note in payload_notes if isinstance(note, dict))
            if currency is None and payload.get("currency") is not None:
                currency = payload.get("currency")
            if scale is None and payload.get("scale") is not None:
                scale = payload.get("scale")

        return {
            "statement_type": "income_notes",
            "currency": currency,
            "scale": scale,
            "notes": notes,
        }

    def process(self, report_id: str, file_path: str = "") -> str:
        status = "completed"
        normalized_rows: list[dict] = []
        error_code: str | None = None
        chunk_results: list[dict[str, Any]] = []

        chunks_key = f"report:{report_id}:document_chunks"
        chunks_data = self._fetch_from_redis(chunks_key)

        if isinstance(chunks_data, dict) and "chunks" in chunks_data:
            chunks = chunks_data["chunks"]
        elif isinstance(chunks_data, list):
            chunks = chunks_data
        else:
            chunks = []

        if not chunks:
            status = "failed"
            error_code = "missing_document_chunks_in_redis"
            logger.error("No document chunks found in Redis for report_id=%s", report_id)
        else:
            relevant_chunks = self._filter_chunks(chunks)
            if not relevant_chunks:
                status = "failed"
                error_code = "no_relevant_income_notes_chunks"
                logger.warning("No relevant income notes chunks found for report_id=%s", report_id)
            else:
                try:
                    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                        futures = {
                            executor.submit(self.gemini_client.extract_chunk, chunk.get("text_content", "")): chunk
                            for chunk in relevant_chunks
                        }
                        for future in concurrent.futures.as_completed(futures):
                            chunk = futures[future]
                            try:
                                chunk_results.append(future.result())
                            except Exception as exc:
                                logger.error(
                                    "Gemini chunk extraction failed for chunk_id=%s: %s",
                                    chunk.get("chunk_id"),
                                    exc,
                                )
                except Exception as exc:
                    logger.error("Chunk extraction orchestration failed for report_id=%s: %s", report_id, exc)
                    status = "failed"
                    error_code = "chunk_extraction_orchestration_error"

        if status != "failed":
            if not chunk_results:
                status = "failed"
                error_code = "all_chunk_extractions_failed"
            else:
                try:
                    raw_payload = self._merge_chunk_payloads(chunk_results)
                    normalized_rows, is_partial = self.transformation_service.transform(report_id, raw_payload)
                    if is_partial:
                        status = "partial"
                except Exception as exc:
                    logger.error("Transformation failed for report_id=%s: %s", report_id, exc.__class__.__name__)
                    status = "failed"
                    error_code = "gemini_or_transform_error"

        payload = {
            "report_id": report_id,
            "statement_type": "income_notes",
            "status": status,
            "normalized_rows": normalized_rows,
            "metadata": {
                "source_file": file_path,
                "row_count": len(normalized_rows),
                "processed_chunks": len(chunk_results),
                "error_code": error_code,
            },
        }

        if not self.repository.persist_result(report_id=report_id, payload=payload):
            return "failed"
        return status
