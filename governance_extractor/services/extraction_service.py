import concurrent.futures
import json
import logging
from typing import Any

from core.config import get_settings
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
        except Exception as exc:
            logger.error("Redis fetch error for key=%s: %s", key, exc)
            return default

    def _filter_chunks(self, chunks: list[dict]) -> list[dict]:
        keywords = {
            "governance",
            "board of directors",
            "committee",
            "audit committee",
            "risk committee",
            "nomination",
            "remuneration",
        }
        relevant: list[dict] = []
        for chunk in chunks:
            text = str(chunk.get("text_content", "")).lower()
            if any(keyword in text for keyword in keywords):
                relevant.append(chunk)
        return relevant

    @staticmethod
    def _merge_chunk_payloads(chunk_payloads: list[dict[str, Any]]) -> dict[str, Any]:
        merged = {
            "board_members": [],
            "committees": [],
            "executive_leadership": [],
            "governance_policies": [],
        }

        for payload in chunk_payloads:
            if not isinstance(payload, dict):
                continue
            for key in merged:
                values = payload.get(key)
                if isinstance(values, list):
                    merged[key].extend(item for item in values if isinstance(item, dict))

        return merged

    def process(self, report_id: str, file_path: str = "") -> str:
        status = "completed"
        records: list[dict] = []
        error_code: str | None = None
        governance_sections_count = 0
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
                error_code = "no_relevant_governance_chunks"
                logger.warning("No relevant governance chunks found for report_id=%s", report_id)
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
                        "Governance transform failed for report_id=%s: %s",
                        report_id,
                        exc.__class__.__name__,
                    )
                    status = "failed"
                    error_code = "gemini_or_transform_error"

        validation_result = self.validator.validate_records("governance", records)
        if validation_result["errors"] and status == "completed":
            status = "partial"
        confidence_result = self.confidence.score("governance", records, validation_result)
        confidence_details = self.confidence.analyze_records(records)
        routing_decision = self.routing_policy.route_before_fallback(
            status=status,
            confidence_band=confidence_result["confidence_band"],
        )
        fallback_metadata = self.routing_policy.default_fallback_metadata(
            provider=self.fallback_adapter.provider,
            reason=routing_decision["reason"],
        )
        if routing_decision["should_attempt_fallback"]:
            records, fallback_metadata = self.fallback_adapter.apply(
                report_id=report_id,
                statement_type="governance",
                primary_records=records,
                confidence_band=confidence_result["confidence_band"],
            )
        if fallback_metadata["fallback_applied"]:
            validation_result = self.validator.validate_records("governance", records)
            confidence_result = self.confidence.score("governance", records, validation_result)
            confidence_details = self.confidence.analyze_records(records)

        status, routed_error_code = self.routing_policy.resolve_after_extraction(
            status=status,
            confidence_band=confidence_result["confidence_band"],
            fallback_attempted=fallback_metadata["fallback_attempted"],
        )
        if routed_error_code:
            error_code = error_code or routed_error_code

        payload = {
            "report_id": report_id,
            "statement_type": "governance",
            "status": status,
            "records": records,
            "metadata": {
                "source_file": file_path,
                "record_count": len(records),
                "governance_sections_count": governance_sections_count,
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
                "error_code": error_code,
            },
        }

        if not self.repository.persist_result(report_id=report_id, payload=payload):
            return "failed"
        return status
