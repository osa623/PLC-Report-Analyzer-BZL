"""
LLM-Based Financial Statement Extractor.
Uses high-intelligence multimodal models to extract strict JSON data from statement images.
"""

import os
import base64
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional
import requests
import time
import random
import threading
import re
from PIL import Image
import io

# Configure logging
logger = logging.getLogger(__name__)

class LLMFinancialExtractor:
    """
    Extractor that uses Multimodal LLMs (GPT-4o / Gemini 1.5 Pro) to convert
    financial statement images into normalized JSON.
    """
    
    SYSTEM_PROMPT = """@[MyApp] You are a financial statement extraction engine for scanned pages/images.

Return ONLY valid JSON. Do not output markdown, code fences, comments, or extra text.

Primary goal:
- Convert the provided statement page content into a normalized JSON object that matches the required storage layout and will be saved into a database using a folder-like structure.

Hard constraints:
1) No hallucination: do not invent rows, notes, years, page numbers, or values that are not present in the provided input.
2) Output must be strict JSON and parseable.
3) Preserve numeric formatting as strings exactly as shown in the source:
   - Keep comma separators: "1,063,675,345"
   - Keep negatives in parentheses: "(4,308,429)"
   - Keep decimals and asterisks: "15.00*"
   - Keep dashes "-" exactly when the statement shows "-"
4) Clean labels:
   - Do NOT include unit/header noise inside row labels (e.g., remove "Rs 000 Rs 000 ...")
   - Do NOT glue section titles into line item labels (e.g., remove "ASSETS " prefix or "Cash flows from operating activities " prefix if stuck to the first item)
5) No duplicates:
   - If a label appears twice, keep the most complete one (with the most populated columns)
   - Drop rows that are only footnote markers (e.g., "15.00*" alone)
6) Columns:
   - Column keys must be exactly: "YYYY (Bank)" and/or "YYYY (Group)" based on the page header
   - Do not create any other column key formats
7) Include only data rows that have at least one value that looks numeric or "-" (excluding the header row which is mandatory).

If you are uncertain about any row label or a value, keep it as best-effort but add a warning under parse_meta.warnings and reduce confidence.
"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the extractor.
        """
        # Prioritize Google Gemini (Free Tier)
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
        
        # Determine provider based on available keys, preferring Gemini
        if os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"):
            self.provider = "gemini"
        elif os.getenv("OPENAI_API_KEY"):
            self.provider = "openai"
        else:
            self.provider = None

        if self.api_key and self.provider:
            masked_key = self.api_key[:8] + "..." + self.api_key[-4:]
            logger.info(f"LLM Initialized with provider: {self.provider}, Key: {masked_key}")
        
        # Enforce sequential execution to avoid rate limits
        self._concurrency_limit = threading.Semaphore(1)
        
        if not self.api_key:
            logger.warning("No API Key found (OPENAI_API_KEY or GEMINI_API_KEY). Extraction will fail or use mock.")

    def extract_from_image(self, image_path: str) -> Dict[str, Any]:
        """
        Extract financial data from a single image file.
        """
        # Acquire semaphore to prevent concurrent API calls
        with self._concurrency_limit:
            try:
                image_path = Path(image_path)
                if not image_path.exists():
                    raise FileNotFoundError(f"Image not found: {image_path}")

                # 1. Encode image
                base64_image = self._encode_image(image_path)
                
                # 2. Call LLM
                if self.provider == "openai":
                    response_text = self._call_openai(base64_image)
                elif self.provider == "gemini":
                    response_text = self._call_gemini(base64_image)
                else:
                    # Mock response for testing if no key provided
                    logger.warning("Using MOCK extraction (no API key configured)")
                    return self._mock_response(image_path.name)

                # 3. Clean and Parse JSON
                return self._clean_and_parse_json(response_text, image_path.name)

            except Exception as e:
                logger.error(f"LLM Extraction failed for {image_path}: {str(e)}")
                return {
                    "error": str(e),
                    "extraction_success": False
                }

    def _encode_image(self, image_path: Path) -> str:
        """Read, resize if needed, and encode image to base64."""
        with Image.open(image_path) as img:
            # OPTIMIZATION: Resize image to max 1536px to prevent 504 Timeouts & Reduce Tokens
            max_size = 1536
            if img.width > max_size or img.height > max_size:
                img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            # Save to buffer
            buffered = io.BytesIO()
            img.save(buffered, format="JPEG", quality=85) # Compress slightly to save bandwidth
            return base64.b64encode(buffered.getvalue()).decode('utf-8')

    def _call_openai(self, base64_image: str) -> str:
        """Call OpenAI GPT-4o API."""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
        payload = {
            "model": "gpt-4o",  # High intelligence multimodal model
            "messages": [
                {
                    "role": "system",
                    "content": self.SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract this financial statement page."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            "temperature": 0.0, # Deterministic outputs
            "max_tokens": 16384
        }
        
        max_retries = 5
        base_delay = 2  # Start with 2 seconds

        for attempt in range(max_retries):
            try:
                response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
                
                if response.status_code == 429:
                    if attempt < max_retries - 1:
                        # Add jitter to avoid thundering herd on retry
                        jitter = random.uniform(0.5, 2.0)
                        sleep_time = (base_delay * (2 ** attempt)) + jitter 
                        logger.warning(f"OpenAI 429 Rate Limit. Retrying in {sleep_time:.2f}s (Attempt {attempt+1}/{max_retries})")
                        time.sleep(sleep_time)
                        continue
                    else:
                        logger.error("Max retries reached for OpenAI API.")
                        response.raise_for_status()

                response.raise_for_status()
                result = response.json()
                return result['choices'][0]['message']['content']

            except requests.exceptions.RequestException as e:
                # If it's not a 429 (handled above) or if we are out of retries, raise.
                # If we want to retry on 5xx errors as well, we could add that condition.
                # For now, focused on 429.
                if response.status_code == 429 and attempt < max_retries - 1:
                     # This block is somewhat redundant if the if above catches it, 
                     # but requests.post generally doesn't raise exception on 429 unless raise_for_status is called.
                     # The flow above handles it.
                     pass 
                raise e

    def _call_gemini(self, base64_image: str) -> str:
        """Call Google Gemini Flash API (Latest)."""
        # Clean the API key in case of whitespace
        clean_key = self.api_key.strip() if self.api_key else ""
        # Use Gemini 2.0 Flash (Stable)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={clean_key}"
        
        payload = {
            "contents": [{
                "parts": [
                    {"text": self.SYSTEM_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": base64_image
                        }
                    }
                ]
            }],
            "generationConfig": {
                "temperature": 0.0,
                "maxOutputTokens": 4096,
                "responseMimeType": "application/json"
            },
            # Disable safety settings to prevent false positives on financial data
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
            ]
        }
        
        max_retries = 5
        base_delay = 2

        for attempt in range(max_retries):
            try:
                response = requests.post(url, json=payload, headers={'Content-Type': 'application/json'})
                
                # Check for Rate Limit (429) or Server Error (503) to retry
                if response.status_code in [429, 503]:
                    if attempt < max_retries - 1:
                        jitter = random.uniform(0.5, 2.0)
                        sleep_time = (base_delay * (2 ** attempt)) + jitter
                        logger.warning(f"Gemini {response.status_code} Error. Retrying in {sleep_time:.2f}s...")
                        time.sleep(sleep_time)
                        continue
                    else:
                        response.raise_for_status()

                if response.status_code != 200:
                    logger.error(f"Gemini API Error {response.status_code}: {response.text}")
                    response.raise_for_status()
                
                result = response.json()
                # Safety check for Gemini response structure
                candidates = result.get('candidates', [])
                if not candidates:
                     raise ValueError(f"Gemini returned no candidates. Full response: {result}")
                
                content = candidates[0].get('content', {})
                parts = content.get('parts', [])
                
                if not parts:
                    # Sometimes safety settings block the content
                    if "finishReason" in candidates[0]:
                        reason = candidates[0]["finishReason"]
                        # If MAX_TOKENS, return what we have (it might be in parts?) 
                        # usually parts is empty if completely blocked, but check
                    raise ValueError(f"Gemini returned no content parts (Safety block?). Full response: {result}")
                    
                return parts[0]['text']
                
            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                raise e
            except Exception as e:
                logger.error(f"Gemini Call Failed: {str(e)}")
                raise e

    def _clean_and_parse_json(self, text: str, context_id: str = "unknown") -> Dict[str, Any]:
        """Clean markdown fences and parse JSON. Attempts repairs and saves debug logs on failure."""
        try:
            # 1. Try to find JSON within code blocks first
            match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
            if not match:
                match = re.search(r"```\s*(\{.*?\})\s*```", text, re.DOTALL)
            
            if match:
                clean_text = match.group(1)
            else:
                # 2. If no code blocks, look for the first { and last }
                start = text.find('{')
                end = text.rfind('}')
                
                if start != -1 and end != -1:
                    clean_text = text[start:end+1]
                else:
                    clean_text = text.strip()

            return json.loads(clean_text)
            
        except json.JSONDecodeError as e:
            logger.warning(f"JSON Parse Error: {str(e)}. Attempting simple repairs...")
            logger.warning(f"Failed JSON tail (last 500 chars): {clean_text[-500:]}")
            
            try:
                # Attempt 1: Fix missing commas between objects in lists/dicts
                repaired_text = re.sub(r'}\s*{', '}, {', clean_text)
                
                # Attempt 2: Handle Truncated JSON
                # If the string ends unexpectedly, try to close it
                normalized_str = repaired_text.strip() # Use repaired version
                
                if normalized_str.endswith(','):
                     normalized_str = normalized_str[:-1]
                
                if normalized_str.count('"') % 2 != 0:
                     normalized_str += '"'

                # Heuristic: If it ends with a key "key": null
                if re.search(r'"[^"]*"\s*$', normalized_str):
                     # Check if it is a key
                     last_quote = normalized_str.rfind('"')
                     idx = last_quote - 1
                     while idx >= 0 and normalized_str[idx].isspace():
                            idx -= 1
                     if idx >= 0 and normalized_str[idx] in [',', '{']:
                         normalized_str += ': null'
                         
                if normalized_str.rstrip().endswith(':'):
                     normalized_str += ' null'

                # Balance braces
                open_braces = normalized_str.count('{')
                close_braces = normalized_str.count('}')
                open_brackets = normalized_str.count('[')
                close_brackets = normalized_str.count(']')
                
                while close_braces < open_braces:
                    normalized_str += '}'
                    close_braces += 1
                while close_brackets < open_brackets:
                    normalized_str += ']'
                    close_brackets += 1
                
                return json.loads(normalized_str)
            
            except json.JSONDecodeError as e2:
                # Attempt 3: Aggressive Salvage - Find the last valid "}," and cut off
                # This sacrifices the last partial row to save the rest
                try:
                    logger.warning("Simple repair failed. Attempting aggressive salvage (dropping partial data)...")
                    last_valid_comma = clean_text.rfind('},')
                    if last_valid_comma != -1:
                        salvaged_text = clean_text[:last_valid_comma+1] # Include '}'
                        # Now assume we are in a list, close it
                        # Check context: are we inside "data": [ ... ?
                        # Just try closing brackets/braces
                        open_braces = salvaged_text.count('{')
                        close_braces = salvaged_text.count('}')
                        open_brackets = salvaged_text.count('[')
                        close_brackets = salvaged_text.count(']')
                        
                        while close_brackets < open_brackets:
                            salvaged_text += ']'
                            close_brackets += 1
                        while close_braces < open_braces:
                            salvaged_text += '}'
                            close_braces += 1
                        
                        return json.loads(salvaged_text)

                except Exception as salvage_err:
                     logger.error(f"Aggressive salvage failed: {salvage_err}")
                     logger.error(f"Salvaged text tail: {salvaged_text[-500:]}")

                # Backup failure handling: Save the raw text to a file for debugging
                try:
                    debug_dir = Path("logs/debug_dumps")
                    debug_dir.mkdir(parents=True, exist_ok=True)
                    
                    timestamp = int(time.time())
                    safe_context = "".join(x for x in context_id if x.isalnum() or x in "-_.")
                    filename = f"failed_extraction_{safe_context}_{timestamp}.txt"
                    debug_path = debug_dir / filename
                    
                    with open(debug_path, "w", encoding="utf-8") as f:
                        f.write(text)
                        
                    logger.error(f"JSON Repair failed. Raw output saved to: {debug_path}")
                    
                except Exception as file_err:
                    logger.error(f"Could not save debug file: {file_err}")

                # Raise the original error (or the new one) to ensure we don't proceed with bad data
                raise e
                # Backup failure handling: Save the raw text to a file for debugging
                try:
                    debug_dir = Path("logs/debug_dumps")
                    debug_dir.mkdir(parents=True, exist_ok=True)
                    
                    timestamp = int(time.time())
                    safe_context = "".join(x for x in context_id if x.isalnum() or x in "-_.")
                    filename = f"failed_extraction_{safe_context}_{timestamp}.txt"
                    debug_path = debug_dir / filename
                    
                    with open(debug_path, "w", encoding="utf-8") as f:
                        f.write(text)
                        
                    logger.error(f"JSON Repair failed. Raw output saved to: {debug_path}")
                    
                except Exception as file_err:
                    logger.error(f"Could not save debug file: {file_err}")

                # Raise the original error (or the new one) to ensure we don't proceed with bad data
                raise e

    def _mock_response(self, filename: str) -> Dict[str, Any]:
        """Return a mock structure for testing UI flow."""
        return {
            "parse_meta": {
                "warnings": ["MOCK DATA - No API Key"],
                "confidence": 0.99
            },
            "financial_data": [
                {
                    "Line Item": "Example Asset Row",
                    "2024 (Group)": "1,000,000",
                    "2023 (Group)": "900,000"
                }
            ]
        }
