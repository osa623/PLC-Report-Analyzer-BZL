import re
from typing import Any

ALLOWED_SECTIONS = {
    "Operating Activities",
    "Investing Activities",
    "Financing Activities",
}


class TransformationService:
    _SEMANTIC_MAP: dict[str, tuple[str, ...]] = {
        "cash_inflow": ("cash received", "proceeds", "inflow", "received"),
        "cash_outflow": ("cash paid", "payment", "outflow", "paid"),
        "net_cashflow": ("net cash", "net increase", "net decrease"),
        "financing_outflow": ("interest paid", "dividend paid", "repayment"),
    }

    _META_KEYS = {
        "label",
        "values",
        "section",
        "subsection",
        "parent_label",
        "depth_level",
        "indent_level",
        "note_reference",
        "page_number",
    }

    @staticmethod
    def _parse_header(header: str) -> tuple[int | None, str]:
        year_match = re.search(r"(19|20)\d{2}", header)
        year = int(year_match.group(0)) if year_match else None

        scope_match = re.search(r"\(([^)]+)\)", header)
        scope = scope_match.group(1).strip().lower() if scope_match else "company"
        entity_type = "group" if "group" in scope else "company"
        return year, entity_type

    @staticmethod
    def _to_number(value: Any) -> tuple[float | None, bool]:
        if value is None:
            return None, False
        if isinstance(value, (int, float)):
            numeric = float(value)
            return numeric, numeric < 0

        text = str(value).strip()
        if not text or text in {"-", "--", "N/A", "n/a"}:
            return None, False

        is_negative = text.startswith("(") and text.endswith(")")
        normalized = text.strip("()").replace(",", "").replace(" ", "")

        if normalized in {"", "."}:
            return None, False

        try:
            numeric = float(normalized)
        except ValueError:
            return None, False

        if is_negative:
            numeric = -numeric
        return numeric, numeric < 0

    @staticmethod
    def _normalize_section(value: Any) -> str | None:
        if value is None:
            return None

        text = str(value).strip()
        if text in ALLOWED_SECTIONS:
            return text

        lowered = text.lower()
        if "operating" in lowered:
            return "Operating Activities"
        if "investing" in lowered:
            return "Investing Activities"
        if "financing" in lowered:
            return "Financing Activities"
        return None

    @staticmethod
    def _infer_depth(label: str, explicit_depth: Any, indent_level: Any) -> int:
        for candidate in (explicit_depth, indent_level):
            if isinstance(candidate, int) and candidate >= 0:
                return candidate
            if isinstance(candidate, str) and candidate.isdigit():
                return int(candidate)

        leading_spaces = len(label) - len(label.lstrip(" "))
        if leading_spaces <= 0:
            return 0
        return max(1, leading_spaces // 2)

    def _semantic_type(self, label: str) -> str | None:
        lowered = label.lower()
        for semantic_type, markers in self._SEMANTIC_MAP.items():
            if any(marker in lowered for marker in markers):
                return semantic_type
        return None

    def transform(self, report_id: str, raw_payload: dict[str, Any]) -> tuple[list[dict[str, Any]], bool]:
        rows = raw_payload.get("rows") or []
        currency = raw_payload.get("currency")
        scale = raw_payload.get("scale")

        normalized_rows: list[dict[str, Any]] = []
        partial = False

        depth_stack: dict[int, str] = {}
        current_section: str | None = None

        for order_index, row in enumerate(rows):
            if not isinstance(row, dict):
                partial = True
                continue

            label = str(row.get("label") or "").strip()
            if not label:
                partial = True
                continue

            section = self._normalize_section(row.get("section")) or current_section
            if section is None:
                partial = True
                continue
            current_section = section

            depth_level = self._infer_depth(label, row.get("depth_level"), row.get("indent_level"))
            parent_label = row.get("parent_label") or depth_stack.get(max(depth_level - 1, 0))
            if depth_level == 0:
                parent_label = None
            depth_stack[depth_level] = label

            values = row.get("values")
            if not isinstance(values, dict):
                values = {k: v for k, v in row.items() if k not in self._META_KEYS}

            if not values:
                partial = True
                continue

            for header, raw_value in values.items():
                year, entity_type = self._parse_header(str(header))
                if year is None:
                    partial = True
                    continue

                numeric_value, is_negative = self._to_number(raw_value)
                normalized_rows.append(
                    {
                        "report_id": report_id,
                        "statement_type": "cashflow",
                        "entity_type": entity_type,
                        "year": year,
                        "label": label,
                        "value": numeric_value,
                        "section": section,
                        "subsection": row.get("subsection"),
                        "parent_label": parent_label,
                        "depth_level": depth_level,
                        "order_index": order_index,
                        "currency": row.get("currency") or currency,
                        "scale": row.get("scale") or scale,
                        "is_negative": is_negative,
                        "note_reference": row.get("note_reference"),
                        "page_number": row.get("page_number"),
                        "semantic_type": self._semantic_type(label),
                    }
                )

        return normalized_rows, partial
