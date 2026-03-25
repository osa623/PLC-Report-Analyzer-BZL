import re
from typing import Any
import logging

logger = logging.getLogger(__name__)

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

    def merge_and_transform(self, report_id: str, chunk_results: list[tuple[str, dict[str, Any]]]) -> tuple[list[dict[str, Any]], bool, list[str]]:
        merged_rows = []
        seen_keys = set()
        
        current_section = None
        depth_stack = {}
        
        normalized_records = []
        partial = False
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
                    
                section = self._normalize_section(row.get("section")) or current_section
                if section is None:
                    # In cashflow, determining section implicitly can be harder.
                    continue
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
                    
                    # Deduplication key across chunks
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
                        "statement_type": "cashflow_statement",
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

        # Multi-Year Alignment
        contexts = set((r["year"], r["entity_type"]) for r in normalized_records)
        labels_by_section = set((r["label"], r["section"], r["depth"], r["parent"], r["semantic_type"], r["source_chunk_id"], r["page_number"], r["order_index"]) for r in normalized_records)
        
        aligned_records = []
        for year, entity in contexts:
            existing = {(r["label"], r["section"]): r for r in normalized_records if r["year"] == year and r["entity_type"] == entity}
            
            for label, section, depth, parent, sem_type, chunk_id, page_num, order_index in labels_by_section:
                key = (label, section)
                if key in existing:
                    aligned_records.append(existing[key])
                else:
                    aligned_records.append({
                        "report_id": report_id,
                        "statement_type": "cashflow",
                        "label": label,
                        "value": None,
                        "year": year,
                        "entity_type": entity,
                        "semantic_type": sem_type,
                        "depth": depth,
                        "parent": parent,
                        "confidence_score": 0.5,
                        "source_chunk_id": chunk_id,
                        "page_number": page_num,
                        "section": section,
                        "is_negative": False,
                        "order_index": order_index
                    })

        # Validation Layer
        for year, entity in contexts:
            op_total = self._find_total(aligned_records, year, entity, "Operating Activities")
            inv_total = self._find_total(aligned_records, year, entity, "Investing Activities")
            fin_total = self._find_total(aligned_records, year, entity, "Financing Activities")
            
            if op_total is None or inv_total is None or fin_total is None:
                validation_errors.append(f"Missing required section totals for {year} {entity}")
                partial = True
                
            net_increase_records = [r for r in aligned_records if r["year"] == year and r["entity_type"] == entity and "net increase" in r["label"].lower() and r["value"] is not None]
            if net_increase_records and op_total is not None and inv_total is not None and fin_total is not None:
                calc_net = op_total + inv_total + fin_total
                actual_net = net_increase_records[0]["value"]
                if abs(calc_net - actual_net) > 2.0:
                    validation_errors.append(f"Math mismatch for {year} {entity}: Op({op_total}) + Inv({inv_total}) + Fin({fin_total}) != Net({actual_net})")
                    partial = True

        return aligned_records, partial, validation_errors

    def _find_total(self, records: list[dict], year: int, entity: str, section: str) -> float | None:
        section_items = [r for r in records if r["year"] == year and r["entity_type"] == entity and r["section"] == section and r["value"] is not None]
        if not section_items:
            return None
        
        for r in section_items:
            if "net cash" in r["label"].lower() and "generated" in r["label"].lower() or "used in" in r["label"].lower():
                return r["value"]
                
        # If no explicit "total" label, return the last depth 0 item or the absolute last item
        totals = [r["value"] for r in section_items if r["depth"] == 0]
        if totals:
            return totals[-1]
        return section_items[-1]["value"]
