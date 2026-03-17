from typing import Any


class TransformationService:
    @staticmethod
    def _normalize_strategy_type(value: Any) -> str:
        text = str(value or "").strip().lower()
        if "growth" in text:
            return "growth"
        if "expand" in text:
            return "expansion"
        if "cost" in text or "efficien" in text or "optimi" in text:
            return "cost_optimization"
        if "market" in text or "position" in text:
            return "market_positioning"
        if text in {"growth", "expansion", "cost_optimization", "market_positioning", "other"}:
            return text
        return "other"

    @staticmethod
    def _parse_confidence(value: Any) -> float | None:
        if value is None:
            return None
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return None
        if numeric < 0:
            return 0.0
        if numeric > 1:
            return 1.0
        return numeric

    @staticmethod
    def _as_text(value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    def transform(self, report_id: str, raw_payload: dict[str, Any]) -> tuple[list[dict[str, Any]], bool]:
        records: list[dict[str, Any]] = []
        partial = False

        if not isinstance(raw_payload, dict):
            return records, True

        strategies = raw_payload.get("strategies")
        if not isinstance(strategies, list):
            return records, True

        for strategy in strategies:
            if not isinstance(strategy, dict):
                partial = True
                continue

            text = self._as_text(strategy.get("text"))
            if not text:
                partial = True
                continue

            records.append(
                {
                    "report_id": report_id,
                    "strategy_type": self._normalize_strategy_type(strategy.get("type")),
                    "text": text,
                    "confidence": self._parse_confidence(strategy.get("confidence")),
                }
            )

        return records, partial
