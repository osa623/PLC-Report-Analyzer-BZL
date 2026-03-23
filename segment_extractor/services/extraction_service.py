import concurrent.futures
import json
import logging
from typing import Any

from core.config import get_settings
from repositories.report_repository import ReportRepository
from services.confidence_service import ConfidenceScorer
from services.fallback_adapter import FallbackAdapter
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
        settings = get_settings()
        self.fallback_adapter = FallbackAdapter(
            repository=repository,
            provider=settings.fallback_provider,
            enabled=settings.fallback_enabled,
            kill_switch=settings.fallback_kill_switch,
            run_on_low_confidence=settings.fallback_on_low_confidence,
        )

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
            "segment",
            "business segment",
            "geographical segment",
            "segment revenue",
            "segment result",
            "operating segment",
        }
        relevant: list[dict] = []
        for chunk in chunks:
            text = str(chunk.get("text_content", "")).lower()
            if any(keyword in text for keyword in keywords):
                relevant.append(chunk)
        return relevant

    @staticmethod
    def _merge_chunk_payloads(chunk_payloads: list[dict[str, Any]]) -> dict[str, Any]:
        segments: list[dict[str, Any]] = []
        currency: str | None = None
        scale: str | None = None
        for payload in chunk_payloads:
            if not isinstance(payload, dict):
                continue
            payload_segments = payload.get("segments")
            if isinstance(payload_segments, list):
                segments.extend(segment for segment in payload_segments if isinstance(segment, dict))
            if currency is None and payload.get("currency") is not None:
                currency = payload.get("currency")
            if scale is None and payload.get("scale") is not None:
                scale = payload.get("scale")

        return {
            "statement_type": "segment",
            "currency": currency,
            "scale": scale,
            "segments": segments,
        }

    def process(self, report_id: str, file_path: str = "") -> str:
        status = "completed"
        normalized_rows: list[dict] = []
        error_code: str | None = None
        segment_count = 0
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
                error_code = "no_relevant_segment_chunks"
                logger.warning("No relevant segment chunks found for report_id=%s", report_id)
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
                    segment_count = len(raw_payload.get("segments", [])) if isinstance(raw_payload, dict) else 0
                    normalized_rows, is_partial = self.transformation_service.transform(report_id, raw_payload)
                    if is_partial:
                        status = "partial"
                except Exception as exc:
                    logger.error(
                        "Transformation failed for report_id=%s: %s",
                        report_id,
                        exc.__class__.__name__,
                    )
                    status = "failed"
                    error_code = "gemini_or_transform_error"

        validation_result = self.validator.validate_records("segment", normalized_rows)
        if validation_result["errors"] and status == "completed":
            status = "partial"
        confidence_result = self.confidence.score("segment", normalized_rows, validation_result)
        confidence_details = self.confidence.analyze_records(normalized_rows)
        normalized_rows, fallback_metadata = self.fallback_adapter.apply(
            report_id=report_id,
            statement_type="segment",
            primary_records=normalized_rows,
            confidence_band=confidence_result["confidence_band"],
        )
        if fallback_metadata["fallback_applied"]:
            validation_result = self.validator.validate_records("segment", normalized_rows)
            confidence_result = self.confidence.score("segment", normalized_rows, validation_result)
            confidence_details = self.confidence.analyze_records(normalized_rows)

        if status != "failed":
            if confidence_result["confidence_band"] == "low":
                status = "failed"
                if fallback_metadata["fallback_attempted"]:
                    error_code = error_code or "low_confidence_after_fallback"
                else:
                    error_code = error_code or "low_confidence_output"
            elif confidence_result["confidence_band"] == "medium" and status == "completed":
                status = "partial"

        payload = {
            "report_id": report_id,
            "statement_type": "segment",
            "status": status,
            "normalized_rows": normalized_rows,
            "metadata": {
                "source_file": file_path,
                "row_count": len(normalized_rows),
                "segment_count": segment_count,
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
                "fallback_provider": fallback_metadata["fallback_provider"],
                "fallback_attempted": fallback_metadata["fallback_attempted"],
                "fallback_applied": fallback_metadata["fallback_applied"],
                "fallback_reason": fallback_metadata["fallback_reason"],
                "error_code": error_code,
            },
        }

        if not self.repository.persist_result(report_id=report_id, payload=payload):
            return "failed"
        return status
