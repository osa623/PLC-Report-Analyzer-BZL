import json
import logging
from collections import defaultdict
from typing import Any

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

    def __init__(
        self,
        redis_client: Redis,
        input_prefix: str,
        ratios_suffix: str,
        patterns_suffix: str,
        final_report_suffix: str,
        ttl_seconds: int,
    ) -> None:
        self.redis_client = redis_client
        self.input_prefix = input_prefix
        self.ratios_suffix = ratios_suffix
        self.patterns_suffix = patterns_suffix
        self.final_report_suffix = final_report_suffix
        self.ttl_seconds = ttl_seconds

    def _key(self, report_id: str, suffix: str | None = None) -> str:
        if suffix:
            return f"{self.input_prefix}:{report_id}:{suffix}"
        return f"{self.input_prefix}:{report_id}"

    def _load_json(self, key: str) -> Any:
        raw = self.redis_client.get(key)
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
    def _extract_rows(payload: Any) -> list[dict[str, Any]]:
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

    @staticmethod
    def _build_patterns(pattern_payload: Any) -> list[dict[str, Any]]:
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
            if confidence_value <= 0.6:
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

    def process(self, report_id: str) -> str:
        base_payload = self._load_json(self._key(report_id))
        if base_payload is None:
            return "not_found"

        ratio_payload = self._load_json(self._key(report_id, self.ratios_suffix)) or {}
        pattern_payload = self._load_json(self._key(report_id, self.patterns_suffix)) or {}

        rows = self._extract_rows(base_payload)

        summary, latest_year = self._build_summary(rows)
        ratios = self._build_ratios(ratio_payload)
        patterns = self._build_patterns(pattern_payload)
        segment_analysis = self._build_segment_analysis(rows, latest_year)
        risk_flags = self._build_risk_flags(patterns)
        narrative_consistency = self._build_narrative_consistency(patterns)

        final_report = {
            "report_id": report_id,
            "summary": summary,
            "ratios": ratios,
            "patterns": patterns,
            "segment_analysis": segment_analysis,
            "risk_flags": risk_flags,
            "narrative_consistency": narrative_consistency,
        }

        self.redis_client.set(
            name=self._key(report_id, self.final_report_suffix),
            value=json.dumps(final_report, ensure_ascii=True),
            ex=self.ttl_seconds,
        )

        return "completed"
