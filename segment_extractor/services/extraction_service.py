import concurrent.futures
import json
import logging
import time
from typing import Any

from core.config import get_settings
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
        observability_trace = self.observability.trace_context(report_id, "segment")

        chunks_key = f"report:{report_id}:document_chunks"
        chunks_data = self._fetch_from_redis(chunks_key)
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

        if status != "failed" and not chunks:
            status = "failed"
            error_code = "missing_document_chunks_in_redis"
            logger.error("No document chunks found in Redis for report_id=%s", report_id)
        elif status != "failed":
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
        routing_decision = self.routing_policy.route_before_fallback(
            status=status,
            confidence_band=confidence_result["confidence_band"],
        )
        fallback_metadata = self.routing_policy.default_fallback_metadata(
            provider=self.fallback_adapter.provider,
            reason=routing_decision["reason"],
        )
        if routing_decision["should_attempt_fallback"]:
            allow_fallback, fallback_budget_reason = self.guardrails.allow_fallback_attempt(report_id)
            if allow_fallback:
                normalized_rows, fallback_metadata = self.fallback_adapter.apply(
                    report_id=report_id,
                    statement_type="segment",
                    primary_records=normalized_rows,
                    confidence_band=confidence_result["confidence_band"],
                )
            else:
                fallback_metadata = self.routing_policy.default_fallback_metadata(
                    provider=self.fallback_adapter.provider,
                    reason=fallback_budget_reason,
                )
        if fallback_metadata["fallback_applied"]:
            validation_result = self.validator.validate_records("segment", normalized_rows)
            confidence_result = self.confidence.score("segment", normalized_rows, validation_result)
            confidence_details = self.confidence.analyze_records(normalized_rows)

        if self.guardrails.exceeded_timeout(started_at):
            status = "failed"
            error_code = error_code or "processing_timeout_exceeded"

        status, routed_error_code = self.routing_policy.resolve_after_extraction(
            status=status,
            confidence_band=confidence_result["confidence_band"],
            fallback_attempted=fallback_metadata["fallback_attempted"],
        )
        if routed_error_code:
            error_code = error_code or routed_error_code

        usage_metadata = self.guardrails.usage_metadata(
            report_id=report_id,
            statement_type="segment",
            status=status,
            output_rows=len(normalized_rows),
            guardrail_state=guardrail_state,
            fallback_attempted=fallback_metadata["fallback_attempted"],
        )
        observability_metadata = self.observability.capture(
            report_id=report_id,
            statement_type="segment",
            status=status,
            processed_chunks=len(chunk_results),
            output_rows=len(normalized_rows),
            confidence_band=confidence_result["confidence_band"],
            fallback_attempted=fallback_metadata["fallback_attempted"],
            started_at=started_at,
        )

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
                "confidence_routing_decision": routing_decision["decision"],
                "confidence_routing_reason": routing_decision["reason"],
                **observability_trace,
                **observability_metadata,
                **guardrail_state,
                **usage_metadata,
                "error_code": error_code,
            },
        }

        if not self.repository.persist_result(report_id=report_id, payload=payload):
            return "failed"
        return status
