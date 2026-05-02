
import os
import json
import logging
import time
from typing import Dict, Any, List
from PIL import Image
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class AIPolisher:
    """
    Polishes extracted data using Gemini 1.5 Flash Vision.
    Corrects OCR errors, visual misalignments, and missing values.
    """
    
    def __init__(self):
        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not gemini_key:
            logger.warning("GEMINI_API_KEY not found. AI Polish will be skipped.")
            self.model = None
        else:
            genai.configure(api_key=gemini_key)
            # Use Gemini 2.0 Flash (Stable)
            self.model = genai.GenerativeModel('gemini-2.0-flash')
            logger.info("AIPolisher initialized with gemini-2.0-flash")

    def refine_with_gemini(self, image: Image.Image, ocr_json: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sends Image + Simplified JSON to Gemini to verify and correct data.
        """
        if not self.model:
            return ocr_json
            
        try:
            # OPTIMIZATION: Resize image to max 1536px to prevent 504 Timeouts & Reduce Tokens
            # Financial tables need detail, but 4k+ images are overkill and cause timeouts
            max_size = 1536
            if image.width > max_size or image.height > max_size:
                image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            # OPTIMIZATION: Strip heavy metadata (coordinates, confidence, etc) to save tokens
            simplified_json = self._strip_heavy_metadata(ocr_json)
            
            prompt = """
            You are a Financial Data Auditor. Your goal is to produce a **100% accurate** digital representation of the Financial Statement Table in the provided IMAGE.
            
            **Input:**
            1. IMAGE: The ground truth.
            2. JSON: An OCR extraction that may have typos, missing rows, or wrong years.

            **Your Task:**
            1. **Verify Headers:** Look at the IMAGE headers. Does the JSON have the correct Years and Entities (e.g., "Group 2024", "Bank 2023")? If not, FIX THE KEYS in the output to match the image exactly.
            2. **Verify Rows:** Go through every row in the IMAGE. Ensure it exists in the JSON. If missing, ADD IT.
            3. **Verify Values:** Check every single number.
               - Fix OCR typos (e.g., 'S' -> '5', 'O' -> '0').
               - Fix missing decimals or commas.
               - Ensure values are in the correct column.
            4. **Clean Noise:** Remove empty rows or garbage text.

            **Output Format:**
            Return a SINGLE JSON object with a "data" key, containing a list of row objects.
            Example:
            {
              "data": [
                {"label": "Revenue", "Note": "3", "2024 (Group)": "100,000", "2023 (Group)": "90,000"},
                ...
              ]
            }
            """
            
            # Pass image and json string
            max_retries = 6
            base_delay = 4
            
            for attempt in range(max_retries):
                try:
                    # Send simplified JSON to save tokens
                    response = self.model.generate_content([prompt, image, json.dumps(simplified_json)])
                    break # Success, exit retry loop
                except Exception as e:
                    if "504" in str(e) or "Deadline Exceeded" in str(e) or "429" in str(e) or "Resource exhausted" in str(e):
                        if attempt < max_retries - 1:
                            sleep_time = (base_delay * (2 ** attempt)) + (attempt * 2) # Exponential backoff: 4, 10, 22, 46...
                            logger.warning(f"Gemini Rate Limit/Error ({e}). Retrying in {sleep_time}s (Attempt {attempt+1}/{max_retries})...")
                            time.sleep(sleep_time)
                            continue
                    
                    logger.error(f"Gemini Non-Retryable Error: {e}")
                    raise e # Re-raise if not retryable or max retries reached
            
            # Parse response
            raw_text = response.text
            
            # Parse response
            raw_text = response.text
            
            # Extract Token Usage (Safely)
            token_counts = {}
            try:
                # Check if attribute exists
                if hasattr(response, 'usage_metadata'):
                    usage_metadata = response.usage_metadata
                    # Check if usage_metadata is not None
                    if usage_metadata:
                        token_counts = {
                            "prompt_token_count": usage_metadata.prompt_token_count,
                            "candidates_token_count": usage_metadata.candidates_token_count,
                            "total_token_count": usage_metadata.total_token_count
                        }
                        logger.info(f"Gemini Token Usage: {token_counts}")
            except Exception as usage_err:
                logger.warning(f"Could not extract token usage: {usage_err}")

            # Remove markdown logic if present
            clean_text = raw_text.replace("```json", "").replace("```", "").strip()
            
            polished_data = json.loads(clean_text)
            
            # Add meta tag
            if isinstance(polished_data, dict):
                 if "parse_meta" not in polished_data: polished_data["parse_meta"] = {}
                 polished_data["parse_meta"]["method"] = "hybrid_gemini_flash_lite"
                 
                 # Inject token usage
                 if token_counts:
                     polished_data["parse_meta"]["token_usage"] = token_counts
                 
            return polished_data

        except Exception as e:
            logger.error(f"AI Polish Failed: {e}")
            # Fallback to original OCR data if AI fails
            return ocr_json

    def _strip_heavy_metadata(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Removes unnecessary fields (coordinates, confidence, internal paths) 
        from the JSON before sending to LLM to reduce token usage.
        """
        if not isinstance(data, dict):
            return data
            
        clean_data = {}
        
        # Keep only essential fields for correction
        if "data" in data:
            clean_data["data"] = data["data"] # The actual rows
        
        if "currency_unit" in data:
            clean_data["currency_unit"] = data["currency_unit"]
            
        # If "data" is missing, maybe it's the raw list itself?
        if "data" not in data and isinstance(data, list):
             return data
             
        return clean_data
