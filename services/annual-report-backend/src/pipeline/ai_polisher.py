
import os
import gc
import json
import logging
import time
import re
import ast
from typing import Dict, Any, List, Optional
from PIL import Image
import google.generativeai as genai
import importlib.util

if importlib.util.find_spec("dotenv"):
    from dotenv import load_dotenv

    load_dotenv()

logger = logging.getLogger(__name__)


def clean_json_string(text: str) -> str:
    """Fix common AI-generated JSON issues."""
    text = re.sub(r'//.*?$', '', text, flags=re.MULTILINE)      # Remove // comments
    text = re.sub(r',(\s*[}\]])', r'\1', text)                   # Trailing commas
    text = re.sub(r',\s*,', ',', text)                           # Double commas
    text = re.sub(r"'([^']*)'(\s*:\s*)", r'"\1"\2', text)        # Single-quoted keys
    text = re.sub(r":\s*'([^']*)'", r': "\1"', text)             # Single-quoted values
    text = re.sub(r',(\s*\n\s*[}\]])', r'\1', text)              # Multiline trailing commas
    return text


class AIPolisher:
    """
    Polishes extracted OCR data using Gemini 2.0 Flash Vision.
    Refreshes the Gemini client periodically to prevent session degradation.
    """

    # Refresh the Gemini model instance every N requests to prevent stale connections
    MAX_REQUESTS_BEFORE_REFRESH = 3  # Refresh after every batch (3 images)

    def __init__(self):
        self._api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self._request_count = 0
        self.model = None

        if not self._api_key:
            logger.warning("GEMINI_API_KEY not found. AI Polish will be skipped.")
        else:
            self._init_model()

    def _init_model(self):
        """Create a fresh Gemini model instance."""
        genai.configure(api_key=self._api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash-lite')
        self._request_count = 0
        logger.info("AIPolisher: Fresh gemini-2.5-flash-lite model initialized")

    def force_refresh(self):
        """Force a full model refresh. Call this after each batch completes."""
        logger.info(f"AIPolisher: Force refreshing model (processed {self._request_count} requests since last refresh)")
        self._init_model()
        gc.collect()

    def _maybe_refresh_model(self):
        """Refresh the model if request count exceeds threshold."""
        self._request_count += 1
        if self._request_count >= self.MAX_REQUESTS_BEFORE_REFRESH:
            logger.info(f"AIPolisher: Auto-refreshing model after {self._request_count} requests")
            self._init_model()
            gc.collect()

    def refine_with_gemini(self, image: Image.Image, ocr_json: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sends Image + OCR JSON to Gemini to verify, correct, and reformat data.
        Enforces strict 6-key layout: label + Note + 4 year columns.
        """
        if not self.model:
            return ocr_json

        # Refresh model periodically to prevent session degradation
        self._maybe_refresh_model()

        try:
            # IMPORTANT: Copy the image so we don't mutate the caller's original
            img_copy = image.copy()

            # Resize to max 1536px to prevent timeouts
            max_size = 1536
            if img_copy.width > max_size or img_copy.height > max_size:
                img_copy.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

            # Strip heavy metadata to save tokens
            simplified_json = self._strip_heavy_metadata(ocr_json)

            # Detect column keys from OCR data for strict enforcement
            expected_columns = self._detect_column_keys(ocr_json)
            columns_instruction = ""
            if expected_columns:
                col_list = ', '.join([f'"{c}"' for c in expected_columns])
                columns_instruction = f"""
**MANDATORY COLUMN KEYS — use these EXACT keys for every row:**
{col_list}

Every row MUST contain: "label", "Note", {col_list}
Do NOT rename, reorder, or omit any of these keys."""

            prompt = f"""You are a Financial Statement Data Extractor. The IMAGE is the GROUND TRUTH.

**TASK:** Look at the financial table IMAGE and produce a perfectly structured JSON extraction.

**STEP 1 — Read the IMAGE column headers:**
Identify the 4 data columns at the top of the table.
Pattern: YEAR (ENTITY) — e.g. "2023 (Bank)", "2022 (Bank)", "2023 (Group)", "2022 (Group)".
{columns_instruction}

**STEP 2 — Extract every row from the IMAGE:**
For EACH row in the IMAGE, from top to bottom:
- "label": The line item name on the LEFT side. Fix any spelling or grammar errors. Use proper English financial terminology and capitalization.
- "Note": The note reference number if visible, otherwise "".
- 4 value columns: The EXACT number from each column position in the IMAGE.
  * Keep commas and decimals as shown.
  * Negative values: use parentheses "(1,234)" as in the image.
  * Empty cell or dash: use "".
  * Fix OCR errors: S→5, O→0, l→1, I→1, B→8.

**STEP 3 — Quality checks:**
- Every row MUST have ALL 6 keys: "label", "Note", and 4 value columns.
- Do NOT skip any row. Do NOT add rows not in the IMAGE.
- Ensure each value is in its CORRECT column (match position in the image).

**OUTPUT — Return ONLY this JSON:**
{{
  "data": [
    {{"label": "Interest Income", "Note": "5", "YYYY (Entity)": "value", "YYYY-1 (Entity)": "value", "YYYY (Entity2)": "value", "YYYY-1 (Entity2)": "value"}}
  ]
}}

Valid JSON only. Double quotes only. No trailing commas. No comments."""

            # Retry with exponential backoff
            max_retries = 6
            base_delay = 8
            response = None

            for attempt in range(max_retries):
                try:
                    response = self.model.generate_content(
                        [prompt, img_copy, json.dumps(simplified_json)],
                        generation_config={"response_mime_type": "application/json"}
                    )
                    break
                except Exception as e:
                    error_str = str(e)
                    is_retryable = any(code in error_str for code in ["504", "Deadline Exceeded", "429", "Resource exhausted"])
                    if is_retryable and attempt < max_retries - 1:
                        sleep_time = base_delay * (2 ** attempt)  # 8, 16, 32, 64, 128, 256
                        logger.warning(f"Gemini error ({e}). Retrying in {sleep_time}s ({attempt+1}/{max_retries})...")
                        time.sleep(sleep_time)
                        # Refresh model on repeated failures — stale session likely
                        if attempt >= 2:
                            logger.info("Refreshing Gemini model after repeated failures...")
                            self._init_model()
                        continue
                    logger.error(f"Gemini Non-Retryable Error: {e}")
                    raise e

            # Clean up the image copy immediately
            img_copy.close()
            del img_copy

            if response is None:
                logger.error("All Gemini retries exhausted. Falling back to OCR data.")
                return ocr_json

            raw_text = response.text

            # Extract Token Usage
            token_counts = {}
            try:
                if hasattr(response, 'usage_metadata') and response.usage_metadata:
                    um = response.usage_metadata
                    token_counts = {
                        "prompt_token_count": um.prompt_token_count,
                        "candidates_token_count": um.candidates_token_count,
                        "total_token_count": um.total_token_count
                    }
                    logger.info(f"Gemini Token Usage: {token_counts}")
            except Exception as usage_err:
                logger.warning(f"Could not extract token usage: {usage_err}")

            # Free response object
            del response

            # Clean and parse JSON
            clean_text = raw_text.replace("```json", "").replace("```", "").strip()
            clean_text = clean_json_string(clean_text)

            polished_data = self._safe_json_parse(clean_text)
            if polished_data is None:
                logger.error("JSON parsing failed. Falling back to OCR data.")
                return ocr_json

            # POST-PROCESSING: Enforce strict column format
            if expected_columns:
                polished_data = self._enforce_column_format(polished_data, expected_columns)

            # Add metadata
            if isinstance(polished_data, dict):
                if "parse_meta" not in polished_data:
                    polished_data["parse_meta"] = {}
                polished_data["parse_meta"]["method"] = "hybrid_gemini_flash_lite"
                if token_counts:
                    polished_data["parse_meta"]["token_usage"] = token_counts

            return polished_data

        except Exception as e:
            logger.error(f"AI Polish Failed: {e}")
            return ocr_json

    # ─────────────────────────────────────────────────────────────
    # JSON Parsing Helpers
    # ─────────────────────────────────────────────────────────────

    def _safe_json_parse(self, text: str) -> Optional[Dict]:
        """Try multiple strategies to parse potentially malformed JSON."""
        # Attempt 1: Standard
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse attempt 1 failed: {e}")

        # Attempt 2: Cleaned
        try:
            return json.loads(clean_json_string(text))
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse attempt 2 failed: {e}")
            logger.debug(f"Error context: ...{text[max(0,e.pos-80):e.pos+80]}...")

        # Attempt 3: Python literal eval
        try:
            return ast.literal_eval(text)
        except Exception as e:
            logger.warning(f"JSON parse attempt 3 (literal_eval) failed: {e}")

        # Attempt 4: Extract data array by brute force
        try:
            match = re.search(r'"data"\s*:\s*\[', text)
            if match:
                start = text.rfind('{', 0, match.start())
                if start == -1:
                    start = 0
                depth = 0
                end = start
                for i in range(start, len(text)):
                    if text[i] == '{': depth += 1
                    elif text[i] == '}':
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break
                subset = clean_json_string(text[start:end])
                return json.loads(subset)
        except Exception as e:
            logger.warning(f"JSON parse attempt 4 (extract data) failed: {e}")

        return None

    # ─────────────────────────────────────────────────────────────
    # Column Detection & Enforcement
    # ─────────────────────────────────────────────────────────────

    def _detect_column_keys(self, ocr_json: Dict[str, Any]) -> List[str]:
        """
        Detect year/entity column keys from OCR JSON.
        Returns e.g.: ['2023 (Bank)', '2022 (Bank)', '2023 (Group)', '2022 (Group)']
        """
        columns = []
        if not isinstance(ocr_json, dict):
            return columns

        data = ocr_json.get("data", [])
        if not data or not isinstance(data, list):
            return columns

        skip_keys = {"label", "Note", "note", "parse_meta"}
        seen = set()
        for row in data[:10]:
            if isinstance(row, dict):
                for key in row.keys():
                    if key not in skip_keys and key not in seen:
                        if re.match(r'\d{4}\s*\(', key):
                            seen.add(key)
                            columns.append(key)

        # Sort: current year first, Bank/Company before Group
        columns.sort(key=lambda x: (
            -int(re.search(r'\d{4}', x).group()),
            0 if 'bank' in x.lower() or 'company' in x.lower() else 1
        ))

        if columns:
            logger.info(f"Detected schema columns: {columns}")
        return columns

    def _enforce_column_format(self, data: Dict[str, Any], expected_columns: List[str]) -> Dict[str, Any]:
        """
        Post-process Gemini output: ensure every row has exactly
        label + Note + the 4 expected year/entity columns.
        """
        if not isinstance(data, dict) or "data" not in data:
            return data

        rows = data.get("data", [])
        if not isinstance(rows, list):
            return data

        fixed_rows = []
        for row in rows:
            if not isinstance(row, dict):
                continue

            fixed_row = {
                "label": row.get("label", "").strip(),
                "Note": str(row.get("Note", row.get("note", ""))).strip()
            }

            if not fixed_row["label"]:
                continue

            for col in expected_columns:
                if col in row:
                    fixed_row[col] = str(row[col]).strip() if row[col] is not None else ""
                else:
                    matched = self._fuzzy_match_column(col, row)
                    fixed_row[col] = str(matched).strip() if matched is not None else ""

            fixed_rows.append(fixed_row)

        data["data"] = fixed_rows
        logger.info(f"Format enforced: {len(fixed_rows)} rows, {len(expected_columns)} value columns")
        return data

    def _fuzzy_match_column(self, expected_key: str, row: Dict) -> Optional[str]:
        """Match column key even if Gemini reformatted it slightly."""
        match = re.match(r'(\d{4})\s*\((\w+)\)', expected_key)
        if not match:
            return None

        year, entity = match.group(1), match.group(2).lower()

        for key, value in row.items():
            if key in ("label", "Note", "note"):
                continue
            if year in key and entity in key.lower():
                return value

        return None

    # ─────────────────────────────────────────────────────────────
    # Metadata Stripping
    # ─────────────────────────────────────────────────────────────

    def _strip_heavy_metadata(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Remove coordinates, confidence, paths — keep only data + currency."""
        if not isinstance(data, dict):
            return data

        clean_data = {}
        if "data" in data:
            clean_data["data"] = data["data"]
        if "currency_unit" in data:
            clean_data["currency_unit"] = data["currency_unit"]
        if "data" not in data and isinstance(data, list):
            return data

        return clean_data
