import json
import logging
from collections import defaultdict
from typing import Any

from redis import Redis

logger = logging.getLogger(__name__)


class RatioService:
    _REQUIRED_COMPONENTS: dict[str, tuple[str, str]] = {
        "gross_margin": ("gross_profit", "revenue"),
        "net_margin": ("net_profit", "revenue"),
        "current_ratio": ("current_assets", "current_liabilities"),
        "debt_to_equity": ("total_liabilities", "equity"),
        "operating_cashflow_ratio": ("operating_cashflow", "current_liabilities"),
    }

    def __init__(self, redis_client: Redis, input_prefix: str, output_suffix: str, ttl_seconds: int) -> None:
        self.redis_client = redis_client
        self.input_prefix = input_prefix
        self.output_suffix = output_suffix
        self.ttl_seconds = ttl_seconds

    def _input_key(self, report_id: str) -> str:
        return f"{self.input_prefix}:{report_id}"

    def _output_key(self, report_id: str) -> str:
        return f"{self.input_prefix}:{report_id}:{self.output_suffix}"

    @staticmethod
    def _coerce_year(value: Any) -> int | None:
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.strip().isdigit():
            return int(value.strip())
        return None

    @staticmethod
    def _coerce_entity(value: Any) -> str:
        if value is None:
            return "unknown"
        entity = str(value).strip().lower()
        return entity or "unknown"

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

        for nested in payload.values():
            if not isinstance(nested, dict):
                continue
            for key in ("normalized_rows", "records", "rows", "data"):
                value = nested.get(key)
                if isinstance(value, list):
                    rows.extend([item for item in value if isinstance(item, dict)])

        if not rows and {"year", "entity_type", "semantic_type", "value"}.issubset(set(payload.keys())):
            rows.append(payload)

        return rows

    @staticmethod
    def _compute_ratio(numerator: float, denominator: float) -> float | None:
        if denominator == 0:
            return None
        return numerator / denominator

    def process(self, report_id: str) -> str:
        source_key = self._input_key(report_id)
        raw = self.redis_client.get(source_key)
        if raw is None:
            return "not_found"

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            logger.error("Invalid JSON for report_id=%s", report_id)
            return "failed"

        rows = self._extract_rows(payload)

        grouped: dict[tuple[int, str], dict[str, float]] = defaultdict(dict)

        for row in rows:
            semantic_type = str(row.get("semantic_type") or "").strip().lower()
            if not semantic_type:
                continue

            year = self._coerce_year(row.get("year"))
            if year is None:
                continue

            entity_type = self._coerce_entity(row.get("entity_type"))
            value = self._to_float(row.get("value"))
            if value is None:
                continue

            grouped[(year, entity_type)][semantic_type] = value

        ratios: list[dict[str, Any]] = []
        for (year, entity_type), components in grouped.items():
            for ratio_name, (num_key, den_key) in self._REQUIRED_COMPONENTS.items():
                numerator = components.get(num_key)
                denominator = components.get(den_key)
                if numerator is None or denominator is None:
                    continue

                ratio_value = self._compute_ratio(numerator, denominator)
                if ratio_value is None:
                    continue

                ratios.append(
                    {
                        "name": ratio_name,
                        "year": year,
                        "entity_type": entity_type,
                        "value": ratio_value,
                    }
                )

        result = {
            "report_id": report_id,
            "ratios": ratios,
        }

        self.redis_client.set(
            name=self._output_key(report_id),
            value=json.dumps(result, ensure_ascii=True),
            ex=self.ttl_seconds,
        )

        return "completed"
