from typing import Any


class TransformationService:
    @staticmethod
    def _normalize_category(category: Any) -> str:
        text = str(category or "").strip().lower()
        if "finan" in text:
            return "financial"
        if "oper" in text:
            return "operational"
        if "market" in text:
            return "market"
        if "reg" in text or "compliance" in text:
            return "regulatory"
        if text in {"financial", "operational", "market", "regulatory", "other"}:
            return text
        return "other"

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

        risks = raw_payload.get("risks")
        if not isinstance(risks, list):
            return records, True

        for risk in risks:
            if not isinstance(risk, dict):
                partial = True
                continue

            title = self._as_text(risk.get("title"))
            description = self._as_text(risk.get("description"))
            if not title or not description:
                partial = True
                continue

            records.append(
                {
                    "report_id": report_id,
                    "risk_category": self._normalize_category(risk.get("category")),
                    "title": title,
                    "description": description,
                    "severity": self._as_text(risk.get("severity")),
                }
            )

        return records, partial
