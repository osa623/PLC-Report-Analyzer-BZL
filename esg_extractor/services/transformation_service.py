import re
from typing import Any


class TransformationService:
    @staticmethod
    def _normalize_category(category: Any) -> str:
        text = str(category or "").strip().lower()
        if "env" in text:
            return "environmental"
        if "social" in text:
            return "social"
        if "govern" in text or "board" in text or "compliance" in text:
            return "governance"
        if text in {"environmental", "social", "governance", "other"}:
            return text
        return "other"

    @staticmethod
    def _parse_year(header: str) -> int | None:
        year_match = re.search(r"(19|20)\d{2}", header)
        if year_match:
            return int(year_match.group(0))
        return None

    @staticmethod
    def _parse_numeric_with_unit(raw: Any) -> tuple[float | None, str | None]:
        if raw is None:
            return None, None
        text = str(raw).strip()
        if not text or text in {"-", "--", "N/A", "n/a", "NA", "na"}:
            return None, None

        negative = text.startswith("(") and text.endswith(")")
        base = text.strip("()")

        numeric_match = re.search(r"[-+]?\d[\d,]*(?:\.\d+)?", base)
        if not numeric_match:
            return None, None

        numeric_text = numeric_match.group(0).replace(",", "")
        try:
            numeric = float(numeric_text)
        except ValueError:
            return None, None

        if negative:
            numeric = -numeric

        unit = base.replace(numeric_match.group(0), "", 1).strip() or None
        return numeric, unit

    def transform(self, report_id: str, raw_payload: dict[str, Any]) -> tuple[list[dict[str, Any]], bool]:
        categories = raw_payload.get("categories") if isinstance(raw_payload, dict) else []
        records: list[dict[str, Any]] = []
        partial = False

        if not isinstance(categories, list):
            return records, True

        for category_block in categories:
            if not isinstance(category_block, dict):
                partial = True
                continue

            category = self._normalize_category(category_block.get("category"))
            items = category_block.get("items")
            if not isinstance(items, list):
                partial = True
                continue

            for item in items:
                if not isinstance(item, dict):
                    partial = True
                    continue

                label = str(item.get("label") or "").strip()
                if not label:
                    partial = True
                    continue

                item_type = str(item.get("type") or "").strip().lower()
                if item_type not in {"metric", "narrative"}:
                    if "values" in item:
                        item_type = "metric"
                    elif "text" in item:
                        item_type = "narrative"
                    else:
                        partial = True
                        continue

                if item_type == "narrative":
                    text = item.get("text")
                    if text is None:
                        partial = True
                        continue
                    records.append(
                        {
                            "report_id": report_id,
                            "category": category,
                            "label": label,
                            "type": "narrative",
                            "text": str(text),
                        }
                    )
                    continue

                values = item.get("values")
                if not isinstance(values, dict) or not values:
                    partial = True
                    continue

                for year_header, raw_value in values.items():
                    year = self._parse_year(str(year_header))
                    if year is None:
                        partial = True
                        continue

                    numeric_value, unit = self._parse_numeric_with_unit(raw_value)
                    records.append(
                        {
                            "report_id": report_id,
                            "category": category,
                            "label": label,
                            "year": year,
                            "value": numeric_value,
                            "unit": unit,
                            "type": "metric",
                        }
                    )

        return records, partial
