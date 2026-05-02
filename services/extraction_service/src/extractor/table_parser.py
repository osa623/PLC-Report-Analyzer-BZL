"""
Table Parser
Parses text lines into structured data using ColumnInterpreter and Stream Extraction Strategy.
Refactored to handle both vertical (multiline) and horizontal (inline) layouts by tokenizing first.
"""

import re
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class ColumnType(Enum):
    NOTE = "note"
    PAGE = "page"
    VALUE = "value"

@dataclass
class ColumnDef:
    col_type: ColumnType
    name: str  # e.g., "Bank 2024", "Note", "Page"
    year: Optional[int] = None
    entity: Optional[str] = None

class TableParser:
    """Parses text lines into financial data structure."""

    def __init__(self):
        pass

    def parse_lines(self, lines: List[str], schema: Optional[List[ColumnDef]] = None, mode: str = "standard") -> Dict[str, Any]:
        """
        Parse lines of text into structured data.
        
        Args:
            lines: Text lines
            schema: Optional pre-defined schema
            mode: "standard" (2+ spaces) or "dense" (1+ space)
        """
        # Filter empty lines
        clean_lines = [line.strip() for line in lines if line.strip()]
        if not clean_lines:
            return {}, None

        # 1. Detect Schema from Header if not provided
        if not schema:
            schema = self.detect_schema(clean_lines[:50])
            
        if not schema:
            logger.warning("Could not detect schema from headers and none provided.")
            return {}, None

        logger.info(f"Using schema: {[c.name for c in schema]}")

        # 2. Tokenize Content
        tokens = []
        for line in clean_lines:
            if mode == "dense":
                # Split by SINGLE space (or tabs)
                parts = re.split(r'\s+', line)
            else:
                # Standard: Split by 2+ spaces or tabs
                parts = re.split(r'\s{2,}|\t+', line)
                
            for part in parts:
                p = part.strip()
                if p:
                    tokens.append(p)

        # 3. Extract Data from Token Stream
        data = self._extract_data_from_tokens(tokens, schema)
        
        return data, schema

    def detect_schema(self, lines: List[str]) -> List[ColumnDef]:
        """Detect column schema from header lines."""
        years = []
        has_note = False
        has_page = False
        entities = []

        for line in lines:
            text = line.lower()
            
            # Skip Title lines/Report meta-data to avoid grabbing years from "Annual Report 2024"
            if "report" in text or "dated" in text:
                continue

            # Detect Years
            found_years = re.findall(r'20\d{2}', text)
            for y in found_years:
                if len(years) < 4: # Limit to expected max 4 years usually
                    years.append(int(y))
            
            if re.search(r'\bnote\b', text): has_note = True
            if re.search(r'\bpage\b', text) or re.search(r'\bno\.\b', text): has_page = True
            
    def parse_with_spatial_layout(self, image, schema_hint: List[ColumnDef] = None) -> Dict[str, Any]:
        """
        Parses table using Spatial OCR (Coordinates) instead of text lines.
        Crucial for complex tables where spaces collapse.
        """
        import pytesseract
        from pytesseract import Output
        import pandas as pd
        
        # 1. Get detailed data (transcending just text)
        # Dictionary keys: 'level', 'page_num', 'block_num', 'par_num', 'line_num', 'word_num', 'left', 'top', 'width', 'height', 'conf', 'text'
        ocr_data = pytesseract.image_to_data(image, output_type=Output.DICT, config='--psm 3')
        
        # Filter empty/low conf
        df = pd.DataFrame(ocr_data)
        df = df[df.text.str.strip().astype(bool)] # Remove empty strings
        df['text'] = df['text'].astype(str)
        df['left'] = pd.to_numeric(df['left'])
        df['top'] = pd.to_numeric(df['top'])
        df['width'] = pd.to_numeric(df['width'])
        
        if df.empty:
            return {}, None

        # 2. Cluster Rows (Y-Axis)
        # Sort by top position
        df = df.sort_values(by=['top'])
        
        rows = []
        current_row = []
        last_top = -100
        row_height_tolerance = 15 # pixels deviation to separate lines
        
        for _, word in df.iterrows():
            if abs(word['top'] - last_top) > row_height_tolerance:
                 # New Row
                 if current_row:
                     rows.append(current_row)
                 current_row = [word]
                 last_top = word['top']
            else:
                 # Same Row
                 current_row.append(word)
                 # Update weighted average top? No, keep simple
        if current_row:
            rows.append(current_row)
            
        # 3. Detect Columns (X-Axis) based on Header
        # Find the header row containing "Bank" or "Group" or Years
        header_row_idx = -1
        for idx, row in enumerate(rows[:10]):
            row_text = " ".join([w['text'].lower() for w in row])
            if "bank" in row_text or "group" in row_text or "20" in row_text:
                header_row_idx = idx
                break
                
        if header_row_idx == -1:
             logger.warning("Spatial Parser: No header found. Using default distribution.")
             # Fallback: Divide Width into 5 chunks? 
             # Lets use heuristic 60% left = label, rest = 4 columns
        
        # Define Column Boundaries (X-Ranges)
        # Label | Note | C1 | C2 | C3 | C4
        # We need to find the X-midpoints of the header words
        
        # Simplified Spatial Logic:
        # Just sort each row by X (left)
        # The first chunk is Label. The rest are values.
        # But we need to assign them to C1..C4 strictly.
        
        data = {}
        
        # Let's derive schema from header if possible
        # Or use the passed hint
        
        # Start matching rows
        for row in rows[header_row_idx+1:]:
             # Sort words in row by Left
             row_words = sorted(row, key=lambda x: x['left'])
             
             # Reconstruct Line
             # Identify Label (Leftmost block) vs Values (Right blocks)
             
             # Heuristic: Find big gap in X
             # Label is usually 0 to X_Note
             
             # Naive Approach 2.0: 
             # Concat words until we see a numeric/financial value?
             
             label_parts = []
             values = []
             
             for w in row_words:
                 txt = w['text']
                 if self._is_valid_financial_value(txt) or self._is_numeric(txt):
                     # Likely a value column (or Note)
                     values.append(txt)
                 else:
                     label_parts.append(txt)
            
             key = " ".join(label_parts).strip()
             
             if not key and not values: continue
             if not key and values: key = "Unlabeled Row" # Or append to previous?
             
             # Clean Key
             if not self._is_valid_key(key):
                  # Maybe the label was split into multiple lines?
                  # Ignore for now if garbage
                  continue
                  
             # Map Values to Schema Hint (C1..C4)
             row_obj = {}
             # Reuse _map_values_to_schema logic but passing the spatially ordered values
             if schema_hint:
                 self._map_values_to_schema(row_obj, schema_hint, values)
             else:
                 # Default map
                 for i, v in enumerate(values):
                     row_obj[f"Col_{i}"] = v
                     
             # Add to Data
             # Handle duplicate keys
             orig_key = key
             k_count = 1
             while key in data:
                  key = f"{orig_key}_{k_count}"
                  k_count += 1
                  
             if row_obj:
                 data[key] = row_obj
                 
        return data, schema_hint

    def _extract_data_from_tokens(self, tokens: List[str], schema: List[ColumnDef]) -> Dict[str, Any]:
        """Extract data by matching stream of tokens to schema."""
        data = {}
        
        i = 0
        while i < len(tokens):
            token = tokens[i]
            
            # Identify Key
            if self._is_valid_key(token):
                key = token
                
                # Check adjacent tokens to build full key
                j = i + 1
                while j < len(tokens):
                    next_tok = tokens[j]
                    if self._is_valid_key(next_tok):
                        # Join with space
                        key += " " + next_tok
                        j += 1
                    else:
                        break
                
                # Now collect values
                row_data = {}
                collected_values = []
                
                # Look ahead for values starting from j
                max_values_needed = len([c for c in schema if c.col_type == ColumnType.VALUE])
                max_notes_needed = len([c for c in schema if c.col_type in [ColumnType.NOTE, ColumnType.PAGE]])
                
                k = j
                while k < len(tokens):
                    val_tok = tokens[k]
                    
                    # Stop if we hit a new Key (that isn't a likely value garbage)
                    if self._is_valid_key(val_tok):
                         break
                    
                    if self._is_numeric(val_tok):
                        if self._is_valid_financial_value(val_tok):
                            collected_values.append(val_tok)
                        else:
                           # Skip "small" numbers like 34, 205, (25) unless they look like Note numbers?
                           # For strictness, if it's numeric but not "financial" (like note '7'), 
                           # we might want to capture it if we need a Note.
                           # But simpler to just skip noise.
                           pass
                    
                    k += 1
                    
                    if len(collected_values) >= max_values_needed + max_notes_needed:
                        break
                
                # Map collected values
                if collected_values:
                    self._map_values_to_schema(row_data, schema, collected_values)
                    if row_data:
                        # Handle duplicate keys to avoid overwriting (e.g. "Total")
                        original_key = key
                        dup_count = 1
                        while key in data:
                            key = f"{original_key}_{dup_count}"
                            dup_count += 1
                        
                        data[key] = row_data
                
                # Advance main loop to k
                i = k
            else:
                # Noise or header token
                i += 1
                
        return data

    def _map_values_to_schema(self, row_data: Dict, schema: List[ColumnDef], values: List[str]):
        """
        Map collected values to schema columns.
        Refactored to include NOTE/PAGE columns and allow imperfect alignment.
        """
        val_idx = 0
        schema_idx = 0
        
        while val_idx < len(values) and schema_idx < len(schema):
            col_def = schema[schema_idx]
            val = values[val_idx]
            
            # Simple greedy mapping: Assign current value to current column
            # We could add smart logic here: e.g. if col is NOTE but val is "100,000", skip NOTE column?
            # For now, rely on strict order which Tesseract usually preserves.
            
            # Heuristic: If Schema asks for NOTE, but Value looks like Money (commas, parens, >999),
            # then it's proper column alignment mismatch. Skip Note.
            if col_def.col_type == ColumnType.NOTE:
                if self._is_looks_like_money(val):
                    # It's not a note. Skip this schema column.
                    schema_idx += 1
                    continue
                else:
                    # It fits as a note (small number, or alphanumeric)
                    row_data[col_def.name] = val
                    val_idx += 1
                    schema_idx += 1

            elif col_def.col_type == ColumnType.PAGE:
                 row_data[col_def.name] = val
                 val_idx += 1
                 schema_idx += 1
                 
            elif col_def.col_type == ColumnType.VALUE:
                row_data[col_def.name] = val
                val_idx += 1
                schema_idx += 1
            else:
                schema_idx += 1

    def _is_looks_like_money(self, text: str) -> bool:
        """Strong check if text is definitely a financial value, not a note."""
        clean = text.replace(',', '').replace('.', '').replace('(', '').replace(')', '').strip()
        # If it has commas or parens, it's money.
        if ',' in text or '(' in text or ')' in text: return True
        # If it has > 3 digits, it's money (Notes are usually 1-3 digits)
        if len(clean) > 3 and clean.isdigit(): return True
        return False
        
    def _is_valid_financial_value(self, text: str) -> bool:
        """
        True if text looks like a valid financial value.
        RELAXED: Accepts small integers (Notes, EPS, Dividends).
        """
        clean = text.strip()
        if clean in ['-', '–', '—']: return True
        
        # Must contain at least one digit
        if not any(c.isdigit() for c in clean):
            return False
            
        # Reject obvious garbage like "2/3" (dates?), or "FY23"
        # But EPS can be "36.36", Dividends "8.00". Notes "7".
        # So really, IF it is numeric, we keep it.
        
        return True

    def _is_valid_key(self, token: str) -> bool:
        """Check if token is a valid Row Key (Description)."""
        if self._is_numeric(token): return False
        
        # Reject generic noise
        if len(token) < 2: return False 
        
        # Reject garbage mixed alphanumeric like "_242.4i24o1" which Tesseract produces
        # If it has digits and symbols but starts with non-letter... or has >30% digits?
        digits = re.sub(r'\D', '', token)
        if len(digits) > 2: return False # Treat as value garbage
        
        lower = token.lower()
        # Headers usually are standalone
        if lower in ["bank", "group", "note", "page", "lkr", "no.", "rs"]:
            return False
            
        if re.match(r'^\(?(bank|group|note|page|lkr|no\.?)\)?$', lower):
            return False
            
        if re.match(r'20\d{2}', token): return False
        
        return True

    def _is_numeric(self, text: str) -> bool:
        """Rough check if token is 'number-like' to decide if it terminates a key."""
        cleaned = text.replace(',', '').replace('(', '').replace(')', '').replace('-', '').replace('.', '').replace('_', '').strip()
        if not cleaned: return False
        if cleaned == '–' or text.strip() == '-' or text.strip() == '—': return True
        
        # If it contains digits, it's numeric-ish
        if any(c.isdigit() for c in cleaned):
            return True
            
        return False

