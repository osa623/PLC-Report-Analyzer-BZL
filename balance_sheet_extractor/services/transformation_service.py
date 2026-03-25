import re
from typing import Any
import logging

logger = logging.getLogger(__name__)

ALLOWED_SECTIONS = {"Assets", "Liabilities", "Equity"}

class TransformationService:
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
            
        # Detect unit inconsistencies (heuristic: if very small like 1.5, might be billions, but just store raw)
        return numeric, numeric < 0

    def _semantic_type(self, parent: str | None, section: str | None) -> str | None:
        if not section:
            return None
        if section == "Assets":
            return "asset"
        if section == "Liabilities":
            return "liability"
        if section == "Equity":
            return "equity"
        return None

    @staticmethod
    def _normalize_section(value: Any) -> str | None:
        if value is None:
            return None
        as_text = str(value).strip()
        if as_text in ALLOWED_SECTIONS:
            return as_text
        lowered = as_text.lower()
        if "asset" in lowered:
            return "Assets"
        if "liabil" in lowered:
            return "Liabilities"
        if "equity" in lowered:
            return "Equity"
        return None

    @staticmethod
    def _depth_from_indent(indent_level: Any, label: str) -> int:
        if isinstance(indent_level, int) and indent_level >= 0:
            return indent_level
        if isinstance(indent_level, str) and indent_level.isdigit():
            return int(indent_level)

        leading_spaces = len(label) - len(label.lstrip(" "))
        if leading_spaces <= 0:
            return 0
        return max(1, leading_spaces // 2)

    def merge_and_transform(self, report_id: str, chunk_results: list[tuple[str, dict[str, Any]]]) -> tuple[list[dict[str, Any]], bool, list[str]]:
        merged_rows = []
        seen_keys = set()
        
        current_section = None
        depth_stack = {}
        
        normalized_records = []
        partial = False
        validation_errors = []
        
        for chunk_id, payload in chunk_results:
            if payload.get("currency_skipped") is True:
                continue
            
            # Currency Check
            curr = payload.get("detected_currency") or payload.get("currency")
            if curr and "usd" in str(curr).lower():
                continue

            # Scale Logic
            scale_mult = 1.0
            if "scale_multiplier" in payload and isinstance(payload["scale_multiplier"], (int, float)):
                scale_mult = float(payload["scale_multiplier"])
            elif "scale" in payload:
                legacy_scale = str(payload["scale"]).lower()
                if "mn" in legacy_scale or "million" in legacy_scale:
                    scale_mult = 1000.0
                elif "bn" in legacy_scale or "billion" in legacy_scale:
                    scale_mult = 1000000.0
            
            rows = payload.get("rows") or []
            
            for row in rows:
                if not isinstance(row, dict):
                    continue
                label = str(row.get("label") or "").strip()
                if not label:
                    continue
                    
                section = self._normalize_section(row.get("section")) or current_section
                if section is None:
                    if label.lower() in {"assets", "liabilities", "equity"}:
                        section = label.title()
                    else:
                        continue
                current_section = section
                
                depth = self._depth_from_indent(row.get("indent_level"), label)
                explicit_parent = row.get("parent_label")
                parent = explicit_parent if explicit_parent else depth_stack.get(max(depth - 1, 0))
                if depth == 0:
                    parent = None
                
                depth_stack[depth] = label

                values = row.get("values")
                if not isinstance(values, dict):
                    values = {k: v for k, v in row.items() if k not in {"label", "section", "subsection", "parent_label", "indent_level", "note_reference", "page_number"}}
                
                if not values:
                    continue
                    
                for header, raw_value_str in values.items():
                    if "usd" in str(header).lower():
                        continue
                        
                    year, entity_type = self._parse_header(str(header))
                    if year is None:
                        continue
                        
                    numeric_value, _ = self._to_number(raw_value_str)
                    semantic_type = self._semantic_type(parent, section)
                    
                    # Deduplication key across chunks
                    dedup_key = f"{year}-{entity_type}-{label.lower()}-{section}"
                    if dedup_key in seen_keys:
                        continue
                    seen_keys.add(dedup_key)
                    
                    confidence = 1.0
                    normalized_val = None
                    
                    if numeric_value is None:
                        confidence -= 0.2
                    else:
                        normalized_val = numeric_value * scale_mult

                    if not parent and depth > 0:
                        confidence -= 0.1
                        
                    page_number = row.get("page_number")

                    normalized_records.append({
                        "report_id": report_id,
                        "statement_type": "balance",
                        "label": label,
                        "value": normalized_val,
                        "raw_value": numeric_value,
                        "scale_multiplier": scale_mult,
                        "currency": curr or "LKR",
                        "year": year,
                        "entity_type": entity_type,
                        "semantic_type": semantic_type,
                        "depth": depth,
                        "parent": parent,
                        "confidence_score": max(0.0, round(confidence, 2)),
                        "source_chunk_id": chunk_id,
                        "page_number": page_number,
                        "section": section,
                    })

        # Multi-Year Alignment
        contexts = set((r["year"], r["entity_type"]) for r in normalized_records)
        labels_by_section = set((r["label"], r["section"], r["depth"], r["parent"], r["semantic_type"], r["source_chunk_id"], r["page_number"]) for r in normalized_records)
        
        aligned_records = []
        for year, entity in contexts:
            existing = {(r["label"], r["section"]): r for r in normalized_records if r["year"] == year and r["entity_type"] == entity}
            
            for label, section, depth, parent, sem_type, chunk_id, page_num in labels_by_section:
                key = (label, section)
                if key in existing:
                    aligned_records.append(existing[key])
                else:
                    aligned_records.append({
                        "report_id": report_id,
                        "statement_type": "balance",
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
                        "section": section
                    })

        # Validation Layer
        for year, entity in contexts:
            total_assets = self._find_total(aligned_records, year, entity, "Assets")
            total_liabilities = self._find_total(aligned_records, year, entity, "Liabilities")
            total_equity = self._find_total(aligned_records, year, entity, "Equity")
            
            if total_assets is None or total_liabilities is None or total_equity is None:
                validation_errors.append(f"Missing required total fields for {year} {entity}")
                partial = True
            else:
                diff = abs(total_assets - (total_liabilities + total_equity))
                if diff > 2.0:
                    validation_errors.append(f"Balance mismatch for {year} {entity}: Assets({total_assets}) != Liab({total_liabilities}) + Eq({total_equity})")
                    partial = True

        return aligned_records, partial, validation_errors

    def _find_total(self, records: list[dict], year: int, entity: str, section: str) -> float | None:
        section_items = [r for r in records if r["year"] == year and r["entity_type"] == entity and r["section"] == section and r["value"] is not None]
        if not section_items:
            return None
        
        for r in section_items:
            if "total" in r["label"].lower():
                return r["value"]
                
        # If no explicit "total" label, return the sum of depth 0 items or the last item
        totals = [r["value"] for r in section_items if r["depth"] == 0]
        if totals:
            return sum(totals)
        return section_items[-1]["value"]
