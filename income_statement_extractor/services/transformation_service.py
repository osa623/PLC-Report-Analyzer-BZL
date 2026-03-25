import re
from typing import Any


class TransformationService:
    _SEMANTIC_MAP: dict[str, tuple[str, ...]] = {
        "revenue": ("revenue", "turnover", "interest income", "sales"),
        "cost": ("cost of sales", "cost", "expense", "direct cost"),
        "profit": ("profit", "earnings", "income", "loss"),
        "tax": ("tax", "taxation"),
        "finance": ("finance cost", "finance income", "interest expense"),
        "operating": ("operating", "operations"),
    }

    _META_KEYS = {
        "label",
        "values",
        "section",
        "subsection",
        "parent_label",
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
        entity_type = "group" if "group" in scope else "company"
        return year, entity_type

    @staticmethod
    def _infer_depth(label: str, explicit_depth: Any) -> int:
        if isinstance(explicit_depth, int) and explicit_depth >= 0:
            return explicit_depth

        leading_spaces = len(label) - len(label.lstrip(" "))
        if leading_spaces <= 0:
            return 0
        return max(1, leading_spaces // 2)

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
        normalized = text.strip("()")
        normalized = normalized.replace(",", "").replace(" ", "")

        if normalized in {"", "."}:
            return None, False

        try:
            numeric = float(normalized)
        except ValueError:
            return None, False

        if is_negative:
            numeric = -numeric
        return numeric, numeric < 0

    def _semantic_type(self, label: str) -> str | None:
        lowered = label.lower()
        for semantic_type, markers in self._SEMANTIC_MAP.items():
            if any(marker in lowered for marker in markers):
                return semantic_type
        return None

    def transform(self, report_id: str, raw_payload: dict[str, Any]) -> tuple[list[dict[str, Any]], bool]:
        rows = raw_payload.get("rows") or []
        currency = raw_payload.get("currency") or raw_payload.get("detected_currency")
        
        # New Scale Logic
        scale_mult = 1.0
        if "scale_multiplier" in raw_payload:
            try:
                scale_mult = float(raw_payload["scale_multiplier"])
            except (ValueError, TypeError):
                pass
        
        # If new scale not found, fallback to legacy text parsing
        if scale_mult == 1.0:
            legacy_scale = str(raw_payload.get("scale") or "").lower()
            if "mn" in legacy_scale or "million" in legacy_scale:
                scale_mult = 1000.0
            elif "bn" in legacy_scale or "billion" in legacy_scale:
                scale_mult = 1000000.0

        normalized_rows: list[dict[str, Any]] = []
        partial = False
        depth_stack: dict[int, str] = {}
        
        # Default currency if missing (assuming LKR context unless detected USD)
        if not currency:
            currency = "LKR"

        for order_index, row in enumerate(rows):
            if not isinstance(row, dict):
                partial = True
                continue

            label = str(row.get("label") or "").strip()
            if not label:
                partial = True
                continue

            depth_level = self._infer_depth(label, row.get("depth_level"))
            parent_label = row.get("parent_label")
            if parent_label is None and depth_level > 0:
                parent_label = depth_stack.get(depth_level - 1)

            depth_stack[depth_level] = label

            values = row.get("values")
            if not isinstance(values, dict):
                values = {k: v for k, v in row.items() if k not in self._META_KEYS}

            if not values:
                partial = True
                continue

            for header, raw_value_str in values.items():
                year, entity_type = self._parse_header(str(header))
                if year is None:
                    # Skip columns without detectable year
                    continue

                numeric_value, is_negative = self._to_number(raw_value_str)
                
                # If numeric parsing failed, we can't normalize
                if numeric_value is None:
                    continue

                # Normalization
                normalized_val = numeric_value * scale_mult

                normalized_rows.append(
                    {
                        "report_id": report_id,
                        "statement_type": "income",
                        "entity_type": entity_type,
                        "year": year,
                        "label": label,
                        "value": normalized_val,  # Canonical Rs '000
                        "raw_value": numeric_value, # Original numeric from text
                        "scale_multiplier": scale_mult,
                        "section": row.get("section"),
                        "subsection": row.get("subsection"),
                        "parent_label": parent_label,
                        "depth_level": depth_level,
                        "order_index": order_index,
                        "currency": currency,
                        "is_negative": is_negative,
                        "note_reference": row.get("note_reference"),
                        "page_number": row.get("page_number"),
                        "semantic_type": self._semantic_type(label),
                    }
                )

        return normalized_rows, partial
