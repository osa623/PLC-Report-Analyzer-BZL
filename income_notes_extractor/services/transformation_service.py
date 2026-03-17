import re
from typing import Any


class TransformationService:
    _SEMANTIC_MAP: dict[str, tuple[str, ...]] = {
        "revenue_component": ("revenue", "sales", "service income", "product"),
        "cost_component": ("cost of sales", "cost", "raw material", "direct cost"),
        "expense_component": ("expense", "salaries", "marketing", "administrative"),
        "other_income_component": ("other income", "gain", "interest income"),
    }

    _META_KEYS = {
        "label",
        "values",
        "section",
        "subsection",
        "parent_label",
        "indent_level",
        "depth_level",
        "note_reference",
        "page_number",
    }

    @staticmethod
    def _parse_header(header: str) -> tuple[int | None, str]:
        year_match = re.search(r"(19|20)\d{2}", header)
        year = int(year_match.group(0)) if year_match else None

        scope_match = re.search(r"\(([^)]+)\)", header)
        scope = scope_match.group(1).strip().lower() if scope_match else "company"
        if "group" in scope:
            return year, "group"
        if "bank" in scope:
            return year, "bank"
        return year, "company"

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
    def _infer_depth(label: str, depth_level: Any, indent_level: Any) -> int:
        for candidate in (depth_level, indent_level):
            if isinstance(candidate, int) and candidate >= 0:
                return candidate
            if isinstance(candidate, str) and candidate.isdigit():
                return int(candidate)

        leading_spaces = len(label) - len(label.lstrip(" "))
        if leading_spaces <= 0:
            return 0
        return max(1, leading_spaces // 2)

    def _semantic_type(self, label: str, note_title: str) -> str | None:
        lowered = f"{note_title} {label}".lower()
        for semantic_type, markers in self._SEMANTIC_MAP.items():
            if any(marker in lowered for marker in markers):
                return semantic_type
        return None

    def _merge_notes(self, notes: list[Any]) -> list[dict[str, Any]]:
        merged: dict[tuple[str, str], dict[str, Any]] = {}

        for note in notes:
            if not isinstance(note, dict):
                continue

            note_number = str(note.get("note_number") or "").strip()
            note_title = str(note.get("note_title") or "").strip()
            if not note_number or not note_title:
                continue

            key = (note_number, note_title)
            rows = note.get("rows") if isinstance(note.get("rows"), list) else []

            if key not in merged:
                merged[key] = {
                    "note_number": note_number,
                    "note_title": note_title,
                    "rows": [],
                }

            merged[key]["rows"].extend(rows)

        return list(merged.values())

    def transform(self, report_id: str, raw_payload: dict[str, Any]) -> tuple[list[dict[str, Any]], bool]:
        notes = raw_payload.get("notes") or []
        currency = raw_payload.get("currency")
        scale = raw_payload.get("scale")

        merged_notes = self._merge_notes(notes)

        normalized_rows: list[dict[str, Any]] = []
        partial = False

        for note in merged_notes:
            note_number = note.get("note_number")
            note_title = note.get("note_title")
            note_rows = note.get("rows") if isinstance(note.get("rows"), list) else []

            if not note_number or not note_title:
                partial = True
                continue

            depth_stack: dict[int, str] = {}

            for order_index, row in enumerate(note_rows):
                if not isinstance(row, dict):
                    partial = True
                    continue

                label = str(row.get("label") or "").strip()
                if not label:
                    partial = True
                    continue

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
                            "statement_type": "income_notes",
                            "note_number": str(note_number),
                            "note_title": str(note_title),
                            "entity_type": entity_type,
                            "year": year,
                            "label": label,
                            "value": numeric_value,
                            "section": row.get("section"),
                            "subsection": row.get("subsection"),
                            "parent_label": parent_label,
                            "depth_level": depth_level,
                            "order_index": order_index,
                            "currency": row.get("currency") or currency,
                            "scale": row.get("scale") or scale,
                            "is_negative": is_negative,
                            "note_reference": row.get("note_reference"),
                            "page_number": row.get("page_number"),
                            "semantic_type": self._semantic_type(label, str(note_title)),
                        }
                    )

        return normalized_rows, partial
