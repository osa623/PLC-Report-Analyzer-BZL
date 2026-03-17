import re
from typing import Any


class TransformationService:
    _SEMANTIC_MAP: dict[str, tuple[str, ...]] = {
        "revenue": ("revenue", "segment revenue", "external revenue", "sales"),
        "profit": (
            "profit",
            "operating profit",
            "segment result",
            "ebit",
            "pbt",
            "earnings",
        ),
        "asset": ("asset", "segment asset", "assets"),
        "liability": ("liability", "liabilities", "segment liability"),
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
        "currency",
        "scale",
    }

    @staticmethod
    def _normalize_segment_type(segment_type: Any) -> str:
        text = str(segment_type or "").strip().lower()
        if "geo" in text:
            return "geographical"
        if "business" in text:
            return "business"
        if text in {"business", "geographical", "other"}:
            return text
        return "other"

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
        if "company" in scope:
            return year, "company"
        return year, "company"

    @staticmethod
    def _to_number(value: Any) -> tuple[float | None, bool]:
        if value is None:
            return None, False
        if isinstance(value, (int, float)):
            numeric = float(value)
            return numeric, numeric < 0

        text = str(value).strip()
        if not text or text in {"-", "--", "N/A", "n/a", "NA", "na"}:
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
            if isinstance(candidate, str) and candidate.strip().isdigit():
                return int(candidate.strip())

        leading_spaces = len(label) - len(label.lstrip(" "))
        if leading_spaces <= 0:
            return 0
        return max(1, leading_spaces // 2)

    def _semantic_type(self, label: str, section: Any, subsection: Any) -> str | None:
        lowered = " ".join([str(section or ""), str(subsection or ""), label]).lower()
        for semantic_type, markers in self._SEMANTIC_MAP.items():
            if any(marker in lowered for marker in markers):
                return semantic_type
        return None

    def _merge_segments(self, segments: list[Any]) -> list[dict[str, Any]]:
        merged: dict[tuple[str, str], dict[str, Any]] = {}

        for segment in segments:
            if not isinstance(segment, dict):
                continue

            segment_name = str(segment.get("segment_name") or "").strip()
            if not segment_name:
                continue

            segment_type = self._normalize_segment_type(segment.get("segment_type"))
            key = (segment_name, segment_type)
            rows = segment.get("rows") if isinstance(segment.get("rows"), list) else []

            if key not in merged:
                merged[key] = {
                    "segment_name": segment_name,
                    "segment_type": segment_type,
                    "rows": [],
                }

            merged[key]["rows"].extend(rows)

        return list(merged.values())

    def transform(self, report_id: str, raw_payload: dict[str, Any]) -> tuple[list[dict[str, Any]], bool]:
        segments = raw_payload.get("segments") if isinstance(raw_payload, dict) else []
        currency = raw_payload.get("currency") if isinstance(raw_payload, dict) else None
        scale = raw_payload.get("scale") if isinstance(raw_payload, dict) else None

        merged_segments = self._merge_segments(segments if isinstance(segments, list) else [])

        normalized_rows: list[dict[str, Any]] = []
        partial = False

        for segment in merged_segments:
            segment_name = segment.get("segment_name")
            segment_type = segment.get("segment_type")
            segment_rows = segment.get("rows") if isinstance(segment.get("rows"), list) else []

            if not segment_name:
                partial = True
                continue

            depth_stack: dict[int, str] = {}

            for order_index, row in enumerate(segment_rows):
                if not isinstance(row, dict):
                    partial = True
                    continue

                label = str(row.get("label") or "").strip()
                if not label:
                    partial = True
                    continue

                depth_level = self._infer_depth(label, row.get("depth_level"), row.get("indent_level"))
                explicit_parent = row.get("parent_label")
                inferred_parent = depth_stack.get(depth_level - 1) if depth_level > 0 else None
                parent_label = explicit_parent if explicit_parent else inferred_parent
                if depth_level == 0:
                    parent_label = None

                depth_stack[depth_level] = label
                stale_levels = [level for level in depth_stack if level > depth_level]
                for stale_level in stale_levels:
                    depth_stack.pop(stale_level, None)

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
                            "statement_type": "segment",
                            "segment_name": str(segment_name),
                            "segment_type": str(segment_type),
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
                            "semantic_type": self._semantic_type(
                                label=label,
                                section=row.get("section"),
                                subsection=row.get("subsection"),
                            ),
                        }
                    )

        return normalized_rows, partial
