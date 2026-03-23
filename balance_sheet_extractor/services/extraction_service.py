import json
import logging
import concurrent.futures
from typing import Any

from core.config import get_settings
from common import error_codes
from repositories.report_repository import ReportRepository
from services.confidence_service import ConfidenceScorer
from services.fallback_adapter import FallbackAdapter
from services.gemini_client import GeminiExtractor
from services.routing_policy import ConfidenceRoutingPolicy
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
        self.routing_policy = ConfidenceRoutingPolicy(
            enabled=settings.confidence_routing_enabled,
            fallback_on_medium=settings.confidence_routing_fallback_on_medium,
            fail_on_low=settings.confidence_routing_fail_on_low,
        )

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

        validation_result = self.validator.validate_records("balance_sheet", normalized_records)
        validation_errors.extend(validation_result["errors"])
        if validation_result["errors"] and status == "completed":
            status = "partial"
        confidence_result = self.confidence.score("balance_sheet", normalized_records, validation_result)
        confidence_details = self.confidence.analyze_records(normalized_records)
        routing_decision = self.routing_policy.route_before_fallback(
            status=status,
            confidence_band=confidence_result["confidence_band"],
        )
        fallback_metadata = self.routing_policy.default_fallback_metadata(
            provider=self.fallback_adapter.provider,
            reason=routing_decision["reason"],
        )
        if routing_decision["should_attempt_fallback"]:
            normalized_records, fallback_metadata = self.fallback_adapter.apply(
                report_id=report_id,
                statement_type="balance_sheet",
                primary_records=normalized_records,
                confidence_band=confidence_result["confidence_band"],
            )
        if fallback_metadata["fallback_applied"]:
            validation_result = self.validator.validate_records("balance_sheet", normalized_records)
            validation_errors.extend(validation_result["errors"])
            confidence_result = self.confidence.score("balance_sheet", normalized_records, validation_result)
            confidence_details = self.confidence.analyze_records(normalized_records)

        status, routed_error_code = self.routing_policy.resolve_after_extraction(
            status=status,
            confidence_band=confidence_result["confidence_band"],
            fallback_attempted=fallback_metadata["fallback_attempted"],
        )
        if routed_error_code:
            error_code = error_code or routed_error_code

        payload = {
            "statement_type": "balance_sheet",
            "status": status,
            "normalized_rows": normalized_records,
            "metadata": {
                "total_rows": len(normalized_records),
                "validation_errors": validation_errors,
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
                "confidence_routing_decision": routing_decision["decision"],
                "confidence_routing_reason": routing_decision["reason"],
                "processed_chunks": len(chunk_results),
            }
        }
        if error_code:
            payload["metadata"]["error_code"] = error_code

        self.repository.persist_result(report_id=report_id, payload=payload)
        return status
