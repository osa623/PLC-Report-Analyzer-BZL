import concurrent.futures
import json
import logging
from typing import Any

from repositories.report_repository import ReportRepository
from services.confidence_service import ConfidenceScorer
from services.gemini_client import GeminiExtractor
from services.transformation_service import TransformationService
from services.validation_service import ExtractionValidator

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
        self.validator = ExtractionValidator()
        self.confidence = ConfidenceScorer()

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
            "esg",
            "environmental",
            "social",
            "governance",
            "sustainability",
            "emission",
            "carbon",
            "diversity",
        }
        relevant: list[dict] = []
        for chunk in chunks:
            text = str(chunk.get("text_content", "")).lower()
            if any(keyword in text for keyword in keywords):
                relevant.append(chunk)
        return relevant

    @staticmethod
    def _merge_chunk_payloads(chunk_payloads: list[dict[str, Any]]) -> dict[str, Any]:
        category_map: dict[str, list[dict[str, Any]]] = {}
        for payload in chunk_payloads:
            if not isinstance(payload, dict):
                continue
            categories = payload.get("categories")
            if not isinstance(categories, list):
                continue
            for category_entry in categories:
                if not isinstance(category_entry, dict):
                    continue
                category_name = str(category_entry.get("category") or "other")
                items = category_entry.get("items") if isinstance(category_entry.get("items"), list) else []
                category_map.setdefault(category_name, []).extend(
                    item for item in items if isinstance(item, dict)
                )

        return {
            "categories": [
                {"category": category, "items": items}
                for category, items in category_map.items()
            ]
        }

    def process(self, report_id: str, file_path: str = "") -> str:
        status = "completed"
        records: list[dict] = []
        error_code: str | None = None
        category_count = 0
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
                error_code = "no_relevant_esg_chunks"
                logger.warning("No relevant ESG chunks found for report_id=%s", report_id)
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
                    category_count = len(raw_payload.get("categories", [])) if isinstance(raw_payload, dict) else 0
                    records, is_partial = self.transformation_service.transform(report_id, raw_payload)
                    if is_partial:
                        status = "partial"
                except Exception as exc:
                    logger.error(
                        "ESG transform failed for report_id=%s: %s",
                        report_id,
                        exc.__class__.__name__,
                    )
                    status = "failed"
                    error_code = "gemini_or_transform_error"

        validation_result = self.validator.validate_records("esg", records)
        if validation_result["errors"] and status == "completed":
            status = "partial"
        confidence_result = self.confidence.score("esg", records, validation_result)
        confidence_details = self.confidence.analyze_records(records)
        if status != "failed":
            if confidence_result["confidence_band"] == "low":
                status = "failed"
                error_code = error_code or "low_confidence_output"
            elif confidence_result["confidence_band"] == "medium" and status == "completed":
                status = "partial"

        payload = {
            "report_id": report_id,
            "statement_type": "esg",
            "status": status,
            "records": records,
            "metadata": {
                "source_file": file_path,
                "record_count": len(records),
                "category_count": category_count,
                "processed_chunks": len(chunk_results),
                "validation_errors": validation_result["errors"],
                "validation_warnings": validation_result["warnings"],
                "validation_error_count": validation_result["error_count"],
                "validation_warning_count": validation_result["warning_count"],
                "confidence_score": confidence_result["confidence_score"],
                "confidence_band": confidence_result["confidence_band"],
                "confidence_reasons": confidence_result["confidence_reasons"],
                "confidence_distribution": confidence_details["confidence_distribution"],
                "confidence_samples": confidence_details["confidence_samples"],
                "confidence_section_summary": confidence_details["confidence_section_summary"],
                "error_code": error_code,
            },
        }

        if not self.repository.persist_result(report_id=report_id, payload=payload):
            return "failed"
        return status
