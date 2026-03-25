import re
from typing import Any
import logging

logger = logging.getLogger(__name__)

class TransformationService:
    _SEMANTIC_MAP: dict[str, tuple[str, ...]] = {
        "revaluation_gain": ("revaluation", "property", "plant"),
        "actuarial_gain": ("actuarial", "defined benefit"),
        "fair_value_change": ("fair value", "financial assets", "fvoci"),
        "exchange_diff": ("exchange difference", "translation", "foreign"),
        "total_oci": ("total other comprehensive income", "other comprehensive income for the year"),
        "total_comprehensive_income": ("total comprehensive income for the year", "total comprehensive income"),
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
        "detected_currency",
        "currency_symbol",
        "scale",
        "scale_multiplier",
        "is_audited",
        "period_end_date"
    }

    @staticmethod
    def _parse_header(header: str) -> tuple[int | None, str]:
        year_match = re.search(r"(19|20)\d{2}", header)
        year = int(year_match.group(0)) if year_match else None

        lowered = header.lower()
        if "bank" in lowered and "group" in lowered:
            entity_type = "bank/group"
        elif "group" in lowered:
            entity_type = "group"
        else:
            entity_type = "company"
            
        return year, entity_type

    @staticmethod
    def _to_number(value: Any) -> tuple[float | None, bool]:
        if value is None:
            return None, False
        if isinstance(value, (int, float)):
            numeric = float(value)
            return numeric, numeric < 0

        text = str(value).strip()
        if not text or text in {"-", "--", "N/A", "n/a", ""}:
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

    def merge_and_transform(self, report_id: str, chunk_results: list[tuple[str, dict[str, Any]]]) -> tuple[list[dict[str, Any]], bool, list[str]]:
        seen_keys = set()
        
        current_section = None
        depth_stack = {}
        
        normalized_records = []
        validation_errors = []
        
        for chunk_id, payload in chunk_results:
            detected_currency = payload.get("detected_currency")
            if detected_currency and "usd" in str(detected_currency).lower():
                 continue

            scale_multiplier = 1000.0
            if "scale_multiplier" in payload:
                 try:
                     scale_multiplier = float(payload["scale_multiplier"])
                 except (ValueError, TypeError):
                     scale_multiplier = 1000.0

            rows = payload.get("rows") or []
            
            for order_index, row in enumerate(rows):
                if not isinstance(row, dict):
                    continue
                label = str(row.get("label") or "").strip()
                if not label:
                    continue
                    
                section = row.get("section") or current_section
                current_section = section
                
                depth = self._infer_depth(label, row.get("depth_level"), row.get("indent_level"))
                explicit_parent = row.get("parent_label")
                parent = explicit_parent if explicit_parent else depth_stack.get(max(depth - 1, 0))
                if depth == 0:
                    parent = None
                
                depth_stack[depth] = label

                values = row.get("values")
                if not isinstance(values, dict):
                    values = {k: v for k, v in row.items() if k not in self._META_KEYS}
                
                if not values:
                    continue
                    
                for header, raw_value in values.items():
                    if "usd" in str(header).lower():
                        continue
                        
                    year, entity_type = self._parse_header(str(header))
                    if year is None:
                        continue
                        
                    numeric_value, is_negative = self._to_number(raw_value)
                    semantic_type = self._semantic_type(label)
                    
                    dedup_key = f"{year}-{entity_type}-{label.lower()}-{section}"
                    if dedup_key in seen_keys:
                        continue
                    seen_keys.add(dedup_key)
                    
                    confidence = 1.0
                    if numeric_value is None:
                        confidence -= 0.2
                    if not parent and depth > 0:
                        confidence -= 0.1
                        
                    page_number = row.get("page_number")
                    
                    normalised_value = None
                    if numeric_value is not None:
                        normalised_value = (numeric_value * scale_multiplier) / 1000.0

                    normalized_records.append({
                        "report_id": report_id,
                        "statement_type": "oci_statement",
                        "label": label,
                        "value": numeric_value,
                        "normalised_value": normalised_value,
                        "scale_multiplier": scale_multiplier,
                        "year": year,
                        "entity_type": entity_type,
                        "semantic_type": semantic_type,
                        "depth": depth,
                        "parent": parent,
                        "confidence_score": max(0.0, float(round(confidence, 2))),
                        "source_chunk_id": chunk_id,
                        "page_number": page_number,
                        "section": section,
                        "is_negative": is_negative,
                        "order_index": order_index
                    })

        return normalized_records, len(validation_errors) > 0, validation_errors
