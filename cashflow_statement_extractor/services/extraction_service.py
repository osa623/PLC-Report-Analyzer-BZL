import logging
import json
import concurrent.futures
import time
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
from models.schemas import DocumentChunk

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

    def _fetch_from_redis(self, key: str) -> dict | None:
        try:
            data = self.repository.redis_client.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.error(f"Error reading from Redis key '{key}': {e}")
        return None

    def _filter_chunks(self, chunks: list[dict]) -> list[DocumentChunk]:
        filtered = []
        # Keywords specifically indicating a cashflow statement presence
        keywords = ["cash flow", "operating activities", "investing activities", "financing activities", "cash and cash equivalents"]
        for chunk_data in chunks:
            text = chunk_data.get("text_content", "").lower()
            if any(kw in text for kw in keywords):
                filtered.append(DocumentChunk(**chunk_data))
        return filtered

    def process(self, report_id: str, file_path: str = None) -> str:
        status = "completed"
        normalized_records: list[dict] = []
        validation_errors: list[str] = []
        error_code: str | None = None
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
        observability_trace = self.observability.trace_context(report_id, "cashflow_statement")
        
        chunks_key = f"report:{report_id}:document_chunks"
        chunks_data = self._fetch_from_redis(chunks_key)
        
        if not chunks_data or "chunks" not in chunks_data:
            status = "failed"
            error_code = "missing_document_chunks_in_redis"
            logger.error(f"Failed to find document chunks for {report_id} in Redis.")
        else:
            raw_chunks = chunks_data["chunks"]
            allowed, guardrail_state = self.guardrails.check_input_limits(report_id, raw_chunks if isinstance(raw_chunks, list) else [])
            if not allowed:
                status = "failed"
                error_code = guardrail_state.get("guardrails_rejection_code") or "guardrails_rejected"

            relevant_chunks = self._filter_chunks(raw_chunks)
            
            if status != "failed" and not relevant_chunks:
                status = "failed"
                error_code = "no_relevant_cashflow_chunks"
                logger.warning(f"No cashflow chunks found for {report_id}")
            elif status != "failed":
                chunk_results = []
                try:
                    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                        future_to_chunk = {
                            executor.submit(self.gemini_client.extract_chunk, chunk.text_content): chunk 
                            for chunk in relevant_chunks
                        }
                        for future in concurrent.futures.as_completed(future_to_chunk):
                            chunk = future_to_chunk[future]
                            try:
                                payload = future.result()
                                chunk_results.append((chunk.chunk_id, payload))
                            except Exception as e:
                                logger.error(f"Gemini chunk extraction failed for {chunk.chunk_id}: {e}")
                                
                    if not chunk_results:
                        status = "failed"
                        error_code = "all_chunk_extractions_failed"
                    else:
                        normalized_records, is_partial, validation_errors = self.transformation_service.merge_and_transform(
                            report_id, chunk_results
                        )
                        if is_partial:
                            status = "partial"
                            
                except Exception as exc:
                    logger.error("Extraction failed for report_id=%s: %s", report_id, exc.__class__.__name__)
                    status = "failed"
                    error_code = "gemini_or_transform_error"

        validation_result = self.validator.validate_records("cashflow_statement", normalized_records)
        validation_errors.extend(validation_result["errors"])
        if validation_result["errors"] and status == "completed":
            status = "partial"
        confidence_result = self.confidence.score("cashflow_statement", normalized_records, validation_result)
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
            allow_fallback, fallback_budget_reason = self.guardrails.allow_fallback_attempt(report_id)
            if allow_fallback:
                normalized_records, fallback_metadata = self.fallback_adapter.apply(
                    report_id=report_id,
                    statement_type="cashflow_statement",
                    primary_records=normalized_records,
                    confidence_band=confidence_result["confidence_band"],
                )
            else:
                fallback_metadata = self.routing_policy.default_fallback_metadata(
                    provider=self.fallback_adapter.provider,
                    reason=fallback_budget_reason,
                )
        if fallback_metadata["fallback_applied"]:
            validation_result = self.validator.validate_records("cashflow_statement", normalized_records)
            validation_errors.extend(validation_result["errors"])
            confidence_result = self.confidence.score("cashflow_statement", normalized_records, validation_result)
            confidence_details = self.confidence.analyze_records(normalized_records)

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
            statement_type="cashflow_statement",
            status=status,
            output_rows=len(normalized_records),
            guardrail_state=guardrail_state,
            fallback_attempted=fallback_metadata["fallback_attempted"],
        )
        observability_metadata = self.observability.capture(
            report_id=report_id,
            statement_type="cashflow_statement",
            status=status,
            processed_chunks=len(chunk_results) if 'chunk_results' in locals() else 0,
            output_rows=len(normalized_records),
            confidence_band=confidence_result["confidence_band"],
            fallback_attempted=fallback_metadata["fallback_attempted"],
            started_at=started_at,
        )

        payload = {
            "statement_type": "cashflow_statement",
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
                "processed_chunks": len(chunk_results) if 'chunk_results' in locals() else 0,
                **observability_trace,
                **observability_metadata,
                **guardrail_state,
                **usage_metadata,
            }
        }
        if error_code:
            payload["metadata"]["error_code"] = error_code

        # Save to Redis correctly
        if not self.repository.persist_result(report_id=report_id, payload=payload):
            return "failed"
            
        return status
