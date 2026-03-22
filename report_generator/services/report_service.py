import json
import logging
from collections import defaultdict
from pathlib import Path
from textwrap import wrap
from typing import Any

from redis import Redis
from redis import Redis

logger = logging.getLogger(__name__)


class ReportService:
    _SUMMARY_FIELDS = {
        "total_revenue": "revenue",
        "net_profit": "net_profit",
        "operating_cashflow": "operating_cashflow",
        "total_assets": "total_assets",
    }

    _PROFITABILITY_RATIOS = {"gross_margin", "net_margin"}
    _LIQUIDITY_RATIOS = {"current_ratio", "operating_cashflow_ratio"}
    _STATEMENT_SECTIONS = (
        "income_statement",
        "balance_sheet",
        "cashflow",
        "segments",
        "segment",
    )
    _METRIC_ALIASES = {
        "total_revenue": {"revenue", "total_revenue", "gross_income", "income"},
        "net_profit": {"net_profit", "profit", "profit_after_tax", "profit_attributable"},
        "operating_cashflow": {
            "operating_cashflow",
            "cash_flow_from_operating_activities",
            "net_cash_from_operating_activities",
        },
        "total_assets": {"total_assets", "assets"},
    }

    def __init__(
        self,
        redis_client: Redis,
        input_prefix: str,
        ratios_suffix: str,
        patterns_suffix: str,
        final_report_suffix: str,
        ttl_seconds: int,
        output_dir: str,
        pattern_min_confidence: float,
    ) -> None:
        self.redis_client = redis_client
        self.input_prefix = input_prefix
        self.ratios_suffix = ratios_suffix
        self.patterns_suffix = patterns_suffix
        self.final_report_suffix = final_report_suffix
        self.ttl_seconds = ttl_seconds
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.pattern_min_confidence = pattern_min_confidence

    def _key(self, report_id: str, suffix: str | None = None) -> str:
        if suffix:
            return f"{self.input_prefix}:{report_id}:{suffix}"
        return f"{self.input_prefix}:{report_id}"

    def _load_json(self, key: str) -> Any:
        try:
            raw = self.redis_client.get(key)
        except Exception:
            logger.error("Redis unavailable while reading key=%s", key)
            return None
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.error("Invalid JSON at redis key=%s", key)
            return None

    @staticmethod
    def _to_float(value: Any) -> float | None:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)

        text = str(value).strip()
        if not text or text in {"-", "--", "N/A", "n/a", "NA", "na"}:
            return None

        negative = text.startswith("(") and text.endswith(")")
        normalized = text.strip("()").replace(",", "").replace(" ", "")
        try:
            numeric = float(normalized)
        except ValueError:
            return None

        return -numeric if negative else numeric

    @staticmethod
    def _as_year(value: Any) -> int | None:
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.strip().isdigit():
            return int(value.strip())
        return None

    @staticmethod
    def _extract_rows_from_known_keys(payload: Any) -> list[dict[str, Any]]:
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, dict)]

        if not isinstance(payload, dict):
            return []

        rows: list[dict[str, Any]] = []
        for key in ("normalized_rows", "records", "rows", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                rows.extend([item for item in value if isinstance(item, dict)])

        if not rows and {"year", "entity_type", "semantic_type", "value"}.issubset(set(payload.keys())):
            rows.append(payload)

        return rows

    def _extract_rows(self, payload: Any) -> list[dict[str, Any]]:
        rows = self._extract_rows_from_known_keys(payload)

        if isinstance(payload, dict):
            for section in self._STATEMENT_SECTIONS:
                section_payload = payload.get(section)
                section_rows = self._extract_rows_from_known_keys(section_payload)
                if section_rows:
                    rows.extend(section_rows)

        return rows

    def _build_summary(self, rows: list[dict[str, Any]]) -> tuple[dict[str, float | None], int | None]:
        by_year_semantic: dict[int, dict[str, float]] = defaultdict(dict)
        for row in rows:
            year = self._as_year(row.get("year"))
            if year is None:
                continue
            semantic = str(row.get("semantic_type") or "").strip().lower()
            if not semantic:
                continue
            value = self._to_float(row.get("value"))
            if value is None:
                continue
            by_year_semantic[year][semantic] = value

        if not by_year_semantic:
            return {k: None for k in self._SUMMARY_FIELDS}, None

        latest_year = max(by_year_semantic)
        semantic_values = by_year_semantic[latest_year]

        summary: dict[str, float | None] = {}
        for out_field, semantic in self._SUMMARY_FIELDS.items():
            summary[out_field] = semantic_values.get(semantic)

        return summary, latest_year

    def _build_ratios(self, ratio_payload: Any) -> dict[str, dict[str, Any]]:
        if not isinstance(ratio_payload, dict):
            return {"profitability": {}, "liquidity": {}, "efficiency": {}}

        ratio_rows = ratio_payload.get("ratios")
        if not isinstance(ratio_rows, list):
            ratio_rows = []

        profitability: dict[str, Any] = {}
        liquidity: dict[str, Any] = {}
        efficiency: dict[str, Any] = {}

        for ratio in ratio_rows:
            if not isinstance(ratio, dict):
                continue
            name = str(ratio.get("name") or "").strip().lower()
            value = ratio.get("value")
            year = ratio.get("year")
            entity = ratio.get("entity_type")
            if not name:
                continue

            payload = {
                "value": value,
                "year": year,
                "entity_type": entity,
            }

            if name in self._PROFITABILITY_RATIOS:
                profitability[name] = payload
            elif name in self._LIQUIDITY_RATIOS:
                liquidity[name] = payload
            else:
                efficiency[name] = payload

        return {
            "profitability": profitability,
            "liquidity": liquidity,
            "efficiency": efficiency,
        }

    def _build_patterns(self, pattern_payload: Any) -> list[dict[str, Any]]:
        if not isinstance(pattern_payload, dict):
            return []

        patterns = pattern_payload.get("patterns")
        if not isinstance(patterns, list):
            return []

        filtered: list[dict[str, Any]] = []
        for pattern in patterns:
            if not isinstance(pattern, dict):
                continue
            confidence = pattern.get("confidence")
            try:
                confidence_value = float(confidence)
            except (TypeError, ValueError):
                continue
            if confidence_value < self.pattern_min_confidence:
                continue

            filtered.append(
                {
                    "pattern_type": str(pattern.get("pattern_type") or ""),
                    "description": str(pattern.get("description") or ""),
                    "confidence": confidence_value,
                }
            )
        return filtered

    @staticmethod
    def _build_segment_analysis(rows: list[dict[str, Any]], latest_year: int | None) -> list[dict[str, Any]]:
        if latest_year is None:
            return []

        segments: list[dict[str, Any]] = []
        for row in rows:
            year = row.get("year")
            if year != latest_year:
                continue
            segment_name = row.get("segment_name")
            if not segment_name:
                continue
            segments.append(
                {
                    "segment_name": str(segment_name),
                    "entity_type": str(row.get("entity_type") or "unknown"),
                    "label": str(row.get("label") or ""),
                    "value": row.get("value"),
                    "semantic_type": row.get("semantic_type"),
                }
            )
        return segments

    @staticmethod
    def _build_risk_flags(patterns: list[dict[str, Any]]) -> list[dict[str, Any]]:
        risk_like = {
            "liquidity_risk",
            "earnings_quality_issue",
            "segment_decline",
            "revenue_decline",
            "margin_compression",
            "expense_spike",
            "cost_increase",
            "weak_signal",
        }
        flags: list[dict[str, Any]] = []
        for pattern in patterns:
            p_type = str(pattern.get("pattern_type") or "")
            if p_type in risk_like:
                flags.append(
                    {
                        "flag_type": p_type,
                        "description": pattern.get("description"),
                        "confidence": pattern.get("confidence"),
                    }
                )
        return flags

    @staticmethod
    def _build_narrative_consistency(patterns: list[dict[str, Any]]) -> list[dict[str, Any]]:
        consistency: list[dict[str, Any]] = []
        for pattern in patterns:
            p_type = str(pattern.get("pattern_type") or "")
            if "contradiction" in p_type or "consistency" in p_type:
                consistency.append(
                    {
                        "type": p_type,
                        "description": pattern.get("description"),
                        "confidence": pattern.get("confidence"),
                    }
                )
        return consistency

    def _build_semantic_distribution(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        counts: dict[str, int] = defaultdict(int)
        for row in rows:
            semantic = str(row.get("semantic_type") or "unknown").strip().lower() or "unknown"
            counts[semantic] += 1

        top_items = sorted(counts.items(), key=lambda item: item[1], reverse=True)[:8]
        return [{"semantic_type": semantic, "count": count} for semantic, count in top_items]

    def _build_metric_trends(self, rows: list[dict[str, Any]]) -> dict[str, dict[int, float]]:
        trends: dict[str, dict[int, float]] = {metric: {} for metric in self._METRIC_ALIASES}
        for row in rows:
            year = self._as_year(row.get("year"))
            if year is None:
                continue
            semantic = str(row.get("semantic_type") or "").strip().lower()
            value = self._to_float(row.get("value"))
            if not semantic or value is None:
                continue

            for metric, aliases in self._METRIC_ALIASES.items():
                if semantic in aliases:
                    trends[metric][year] = value

        return trends

    def _build_top_line_items(self, rows: list[dict[str, Any]], limit: int = 12) -> list[dict[str, Any]]:
        scored: list[tuple[float, dict[str, Any]]] = []
        for row in rows:
            value = self._to_float(row.get("value"))
            if value is None:
                continue
            scored.append((abs(value), row))

        top_rows = [row for _, row in sorted(scored, key=lambda item: item[0], reverse=True)[:limit]]
        normalized: list[dict[str, Any]] = []
        for row in top_rows:
            normalized.append(
                {
                    "year": row.get("year"),
                    "entity_type": row.get("entity_type"),
                    "semantic_type": row.get("semantic_type"),
                    "label": row.get("label"),
                    "value": self._to_float(row.get("value")),
                }
            )
        return normalized

    def _build_extraction_overview(self, base_payload: Any, rows: list[dict[str, Any]]) -> list[str]:
        lines: list[str] = []
        if isinstance(base_payload, dict):
            section_presence = []
            for section in self._STATEMENT_SECTIONS:
                if section in base_payload:
                    section_presence.append(section)
            if section_presence:
                lines.append("Detected sections: " + ", ".join(section_presence))
        lines.append(f"Extracted normalized row count: {len(rows)}")

        sample_rows = rows[:8]
        for idx, row in enumerate(sample_rows, start=1):
            year = row.get("year")
            label = row.get("label")
            semantic = row.get("semantic_type")
            value = row.get("value")
            entity = row.get("entity_type")
            lines.append(
                f"Sample {idx}: year={year}, entity={entity}, semantic={semantic}, label={label}, value={value}"
            )

        return lines



    def process(self, report_id: str) -> dict[str, Any]:
        base_payload = self._load_json(self._key(report_id))
        if base_payload is None:
            return {"status": "not_found", "pdf_path": None}

        ratio_payload = self._load_json(self._key(report_id, self.ratios_suffix)) or {}
        pattern_payload = self._load_json(self._key(report_id, self.patterns_suffix)) or {}

        rows = self._extract_rows(base_payload)

        summary, latest_year = self._build_summary(rows)
        ratios = self._build_ratios(ratio_payload)
        patterns = self._build_patterns(pattern_payload)
        segment_analysis = self._build_segment_analysis(rows, latest_year)
        risk_flags = self._build_risk_flags(patterns)
        narrative_consistency = self._build_narrative_consistency(patterns)
        extraction_overview = self._build_extraction_overview(base_payload, rows)
        semantic_distribution = self._build_semantic_distribution(rows)
        metric_trends = self._build_metric_trends(rows)
        top_line_items = self._build_top_line_items(rows)

        final_report = {
            "report_id": report_id,
            "summary": summary,
            "ratios": ratios,
            "patterns": patterns,
            "segment_analysis": segment_analysis,
            "risk_flags": risk_flags,
            "narrative_consistency": narrative_consistency,
            "extraction_overview": extraction_overview,
            "semantic_distribution": semantic_distribution,
            "metric_trends": metric_trends,
            "top_line_items": top_line_items,
        }

        try:
            self.redis_client.set(
                name=self._key(report_id, self.final_report_suffix),
                value=json.dumps(final_report, ensure_ascii=True),
                ex=self.ttl_seconds,
            )
        except Exception:
            logger.error("Redis unavailable while writing final report for report_id=%s", report_id)
            return {"status": "failed", "pdf_path": None}

        try:
            from services.pdf_builder import PDFBuilder
            builder = PDFBuilder()
            pdf_path_str = str((self.output_dir / f"{report_id}.pdf").resolve())
            pdf_path = builder.build_single_report(pdf_path_str, final_report)
        except Exception:
            logger.exception("PDF generation failed for report_id=%s", report_id)
            return {"status": "failed", "pdf_path": None}

        return {"status": "completed", "pdf_path": pdf_path}

    def process_batch(self, batch_id: str, company: dict) -> dict[str, Any]:
        batch_key = f"{self.input_prefix}:batch:{batch_id}:comparative"
        batch_payload = self._load_json(batch_key)
        if not batch_payload:
            logger.error("Batch comparative payload not found for key=%s", batch_key)
            return {"status": "not_found", "pdf_path": None}
            
        try:
            from services.pdf_builder import PDFBuilder
            builder = PDFBuilder()
            pdf_path_str = str((self.output_dir / f"{batch_id}_comparative.pdf").resolve())
            pdf_path = builder.build_comparative_report(pdf_path_str, batch_payload)
        except Exception:
            logger.exception("Batch PDF generation failed for batch_id=%s", batch_id)
            return {"status": "failed", "pdf_path": None}

        return {"status": "completed", "pdf_path": pdf_path}
