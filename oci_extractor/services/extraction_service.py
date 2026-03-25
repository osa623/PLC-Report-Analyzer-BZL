import json
import logging
import concurrent.futures
import time
from typing import Any

from core.config import get_settings
from common import error_codes
from repositories.report_repository import ReportRepository
from services.confidence_service import ConfidenceScorer
from services.fallback_adapter import FallbackAdapter
from services.gemini_client import GeminiExtractor
from services.guardrails_service import ProcessingGuardrails
from services.observability_service import ObservabilityService
from services.routing_policy import ConfidenceRoutingPolicy
from services.transformation_service import TransformationService
from services.validation_service import ExtractionValidator

logger = logging.getLogger(__name__)
FALLBACK_CHUNK_SAMPLE_SIZE = 120


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
        self.guardrails = ProcessingGuardrails(
            repository=repository,
            enabled=settings.guardrails_enabled,
            max_chunks_per_report=settings.guardrails_max_chunks_per_report,
            max_total_input_chars=settings.guardrails_max_total_input_chars,
            processing_timeout_seconds=settings.guardrails_processing_timeout_seconds,
            fallback_max_attempts_per_report=settings.guardrails_fallback_max_attempts_per_report,
            usage_metering_enabled=settings.guardrails_usage_metering_enabled,
            per_user_reports_per_hour=settings.guardrails_per_user_reports_per_hour,
            per_ip_reports_per_hour=settings.guardrails_per_ip_reports_per_hour,
        )
        self.observability = ObservabilityService(
            repository=repository,
            enabled=settings.observability_enabled,
            tracing_enabled=settings.observability_tracing_enabled,
            latency_alert_ms=settings.observability_latency_alert_ms,
            queue_depth_alert_threshold=settings.observability_queue_depth_alert_threshold,
            failure_rate_alert_threshold=settings.observability_failure_rate_alert_threshold,
            low_confidence_alert_enabled=settings.observability_low_confidence_alert_enabled,
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
        keywords = {
            "other comprehensive income", 
            "statement of comprehensive income", 
            "items that will not be reclassified", 
            "items that may be reclassified", 
            "actuarial gain", 
            "revaluation surplus",
            "total comprehensive income"
        }
        for chunk in chunks:
            text = str(chunk.get("text_content", ""))
            decoded = self._decode_rot2_text(text)
            text_l = text.lower()
            decoded_l = decoded.lower()
            if any(k in text_l for k in keywords) or any(k in decoded_l for k in keywords):
                relevant.append(chunk)
        return relevant

    @staticmethod
    def _decode_rot2_text(text: str) -> str:
        out_chars: list[str] = []
        for ch in text:
            code = ord(ch)
            if 65 <= code <= 90:
                out_chars.append(chr(((code - 65 - 2) % 26) + 65))
            elif 97 <= code <= 122:
                out_chars.append(chr(((code - 97 - 2) % 26) + 97))
            else:
                out_chars.append(ch)
        return "".join(out_chars)

    @classmethod
    def _prepare_chunk_text(cls, text: str) -> str:
        decoded = cls._decode_rot2_text(text)
        raw_l = text.lower()
        decoded_l = decoded.lower()
        signal_terms = ("comprehensive", "income", "actuarial", "revaluation")
        raw_hits = sum(1 for term in signal_terms if term in raw_l)
        decoded_hits = sum(1 for term in signal_terms if term in decoded_l)
        return decoded if decoded_hits > raw_hits else text

    def process(self, report_id: str, file_path: str = None) -> str:
        status = "completed"
        error_code = None
        validation_errors = []
        started_at = time.monotonic()
        guardrail_state = {
            "guardrails_enabled": self.guardrails.enabled,
            "guardrails_rejected": False,
            "guardrails_rejection_code": None,
            "guardrails_input_chunk_count": 0,
            "guardrails_input_total_chars": 0,
            "guardrails_user_rate_limited": False,
            "guardrails_ip_rate_limited": False,
        }
        observability_trace = self.observability.trace_context(report_id, "oci_statement")

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

        allowed, guardrail_state = self.guardrails.check_input_limits(report_id, chunks if isinstance(chunks, list) else [])
        if not allowed:
            status = "failed"
            error_code = guardrail_state.get("guardrails_rejection_code") or "guardrails_rejected"

        filtered_chunks = self._filter_chunks(chunks, structure_data)

        if status != "failed" and not filtered_chunks:
            # Fallback for OCR/encoding-noisy PDFs where keyword matching may fail.
            filtered_chunks = chunks[:FALLBACK_CHUNK_SAMPLE_SIZE]
            logger.warning(
                "No relevant chunks found for report_id=%s; using fallback sample of %s chunks",
                report_id,
                len(filtered_chunks),
            )
            if not filtered_chunks:
                payload = {
                    "report_id": report_id,
                    "statement_type": "oci_statement",
                    "status": "failed",
                    "normalized_rows": [],
                    "metadata": {
                        "total_rows": 0,
                        "validation_errors": [error_codes.NO_RELEVANT_CHUNKS],
                        "processed_chunks": 0,
                        **observability_trace,
                        **guardrail_state,
                    }
                }
                self.repository.persist_result(report_id, payload)
                return "failed"

        chunk_results = []
        if status != "failed":
            try:
                with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                    futures = {
                        executor.submit(
                            self.gemini_client.extract_chunk,
                            self._prepare_chunk_text(str(ch.get("text_content", ""))),
                        ): ch.get("chunk_id", str(i))
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
                normalized_records, is_partial, validation_errors = self.transformation_service.merge_and_transform(
                    report_id, chunk_results
                )
                if is_partial:
                    status = "partial"
            except Exception as e:
                logger.error("Transformation error %s", e)
                status = "failed"
                error_code = error_codes.TRANSFORMATION_ERROR

        confidence_result = self.confidence.score("oci_statement", normalized_records, {"errors": validation_errors})
        confidence_details = self.confidence.analyze_records(normalized_records)
        routing_decision = self.routing_policy.route_before_fallback(
            status=status,
            confidence_band=confidence_result["confidence_band"],
        )

        final_payload = {
            "report_id": report_id,
            "statement_type": "oci_statement",
            "status": status,
            "error_code": error_code,
            "normalized_rows": normalized_records,
            "metadata": {
                "total_rows": len(normalized_records),
                "validation_errors": validation_errors,
                "confidence_score": confidence_result["score"],
                "confidence_band": confidence_result["confidence_band"],
                "processing_time": time.monotonic() - started_at,
                "processed_chunks": len(chunk_results),
                **observability_trace,
                **guardrail_state,
            }
        }
        
        self.repository.persist_result(report_id, final_payload)
        return status
