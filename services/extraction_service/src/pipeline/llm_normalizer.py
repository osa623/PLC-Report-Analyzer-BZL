"""
Financial Statement Normalization Engine.
Normalizes extracted raw JSON into a clean, query-friendly, MongoDB-ready format.
"""

import os
import json
import logging
from typing import Dict, Any
from datetime import datetime
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class LLMNormalizer:
    """
    Normalizes extracted financial statement data into a structured format
    ready for MongoDB insertion.
    """
    
    SYSTEM_PROMPT = """You are a Financial Statement Normalization Engine running inside a data pipeline before MongoDB insertion.

ROLE:
Your job is ONLY to normalize and restructure raw extracted annual report JSON into a clean, query-friendly, MongoDB-ready format.

IMPORTANT:
This is NOT a financial analysis task.
This is NOT a calculation task.
This is NOT a summarization task.

You MUST preserve extracted data exactly.

==================================================
PRIMARY RULE
==================================================

DO NOT CHANGE EXTRACTED VALUES.

That means:
- do not modify values
- do not estimate values
- do not infer missing values
- do not recalculate values
- do not round values
- do not rename company names
- do not remove valid rows

Only:
✓ restructure
✓ normalize keys
✓ clean formatting
✓ convert numeric strings to numeric types
✓ organize by year/entity/statement

==================================================
INPUT
==================================================

Raw extracted JSON from annual reports.

Possible statements:
- income_statement
- balance_sheet
- cash_flow
- equity
- comprehensive_income

Possible issues:
- nested arrays
- inconsistent labels
- duplicate rows
- OCR formatting noise
- multiple entity types
- multiple years
- numbers stored as strings

==================================================
NORMALIZATION RULES
==================================================

1. YEAR-FIRST OUTPUT

Extract ALL years found in the raw data column keys. If a row contains data for multiple years (e.g., "2017 (Bank)" and "2016 (Bank)"), you MUST create separate top-level entries for each year and place the respective values inside them. Do not skip previous years.

Convert to:

{
  "financials": {
    "2017": {...},
    "2016": {...}
  }
}

Years must be top-level keys.

--------------------------------------------------

2. DYNAMIC ENTITY DETECTION

Detect entity names from columns.

Examples:
"2019 (Bank)" -> bank
"2019 (Group)" -> group
"2019 (Company)" -> company
"2019 (Standalone)" -> standalone
"2019 (Consolidated)" -> consolidated

Normalize entity names:
lowercase + snake_case

Do not force "bank".

--------------------------------------------------

3. PRESERVE STATEMENT TYPES

Inside each entity:

{
 "income_statement": {},
 "balance_sheet": {},
 "cash_flow": {},
 "equity": {},
 "comprehensive_income": {}
}

--------------------------------------------------

4. FIELD NAME NORMALIZATION

Convert labels into canonical snake_case.

Example:
"Gross income" -> gross_income
"PROFIT FOR THE YEAR" -> profit_for_the_year
"Total assets" -> total_assets

Rules:
- lowercase
- snake_case
- remove punctuation
- remove "Less:"
- preserve meaning

Only keys change — values must stay identical.

--------------------------------------------------

5. VALUE PRESERVATION

Preserve exact extracted values.

Allowed:
"1,234,567" -> 1234567
"(5,200)" -> -5200
"[5,200)" -> -5200
"1.234.567" -> 1234567
"*8.50" -> 8.5
"-" -> null

Not allowed:
1234567 -> 1235000
16.46679 -> 16.47

No rounding.

--------------------------------------------------

6. REMOVE DUPLICATES

If exact duplicate labels exist:
keep only one.

If values differ:
keep the most complete row.

--------------------------------------------------

7. FLATTEN STRUCTURE

Remove unnecessary:
- rows[]
- sections[]
- tables[]
- content[]
- pages[]

Convert to direct key-value pairs.

--------------------------------------------------

8. MISSING VALUES

Missing values must be:
null

Never invent values.

--------------------------------------------------

9. DB READY

Required format:

{
  "financials": {...}
}

Must be valid JSON.

--------------------------------------------------

10. OUTPUT ONLY JSON

Return:
JSON only

Do NOT return:
- explanations
- markdown
- comments
- notes

ONLY VALID JSON.
"""

    def __init__(self):
        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not gemini_key:
            logger.warning("GEMINI_API_KEY not found. LLM Normalization may fail.")
            self.model = None
        else:
            genai.configure(api_key=gemini_key)
            # Use gemini-2.5-flash-lite as it's the stable standard for these extractions
            self.model = genai.GenerativeModel('gemini-2.5-flash-lite', system_instruction=self.SYSTEM_PROMPT)
            logger.info("LLMNormalizer initialized with gemini-2.5-flash-lite")

    def normalize(self, raw_data: Dict[str, Any], company_name: str, source_pdf: str) -> Dict[str, Any]:
        """
        Takes raw extracted JSON, passes it to the LLM to apply normalization rules,
        and returns the MongoDB-ready JSON format.
        """
        final_response = {
            "company": company_name,
            "source_pdf": source_pdf,
            "financials": {},
            "normalization_meta": {
                "status": "success",
                "version": "4.0",
                "normalized_by": "gemini-chunked",
                "db_ready": True,
                "normalized_at": datetime.utcnow().isoformat()
            }
        }
        
        if not self.model:
            logger.error("No model configured. Returning original data wrapped in db schema format.")
            return self._fallback_format(raw_data, company_name, source_pdf, "failed_no_model")
            
        try:
            # Process each statement individually to prevent Token Truncation
            for statement_type, statement_data in raw_data.items():
                if not statement_data:
                    continue
                    
                input_payload = {
                    "statement_type": statement_type,
                    "raw_extracted_data": statement_data
                }
                
                prompt = f"Please normalize the following {statement_type} data according to your system prompt rules:\n\n{json.dumps(input_payload)}"
                
                response = self.model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.0,
                        max_output_tokens=20000,
                    )
                )
                
                raw_text = response.text
                clean_text = raw_text.replace("```json", "").replace("```", "").strip()
                
                try:
                    normalized_data = json.loads(clean_text)
                except json.JSONDecodeError as e:
                    logger.warning(f"JSON Truncation detected: {e}. Attempting brace balancing repair...")
                    
                    normalized_str = clean_text.strip()
                    if normalized_str.endswith(','):
                        normalized_str = normalized_str[:-1]
                    
                    open_braces = normalized_str.count('{')
                    close_braces = normalized_str.count('}')
                    open_brackets = normalized_str.count('[')
                    close_brackets = normalized_str.count(']')
                    
                    while close_brackets < open_brackets:
                        normalized_str += ']'
                        close_brackets += 1
                    while close_braces < open_braces:
                        normalized_str += '}'
                        close_braces += 1
                        
                    normalized_data = json.loads(normalized_str)
                    logger.info("JSON successfully repaired after truncation.")
                
                # Merge the financial data for this statement into the main financials object
                if "financials" in normalized_data:
                    chunk_financials = normalized_data["financials"]
                    for year, entities in chunk_financials.items():
                        if year not in final_response["financials"]:
                            final_response["financials"][year] = {}
                        
                        for entity, statements in entities.items():
                            if entity not in final_response["financials"][year]:
                                final_response["financials"][year][entity] = {}
                                
                            # Merge statements
                            final_response["financials"][year][entity].update(statements)

            return final_response

        except Exception as e:
            logger.error(f"LLM Normalization Failed: {e}")
            return self._fallback_format(raw_data, company_name, source_pdf, f"failed_api_error: {str(e)}")
            
    def _fallback_format(self, raw_data: Dict[str, Any], company_name: str, source_pdf: str, status: str) -> Dict[str, Any]:
        """
        Provides a fallback schema-compliant response if normalization fails.
        """
        return {
            "company": company_name,
            "source_pdf": source_pdf,
            "financials": {"raw_unnormalized": raw_data},
            "normalization_meta": {
                "status": status,
                "version": "3.0",
                "normalized_by": "fallback",
                "db_ready": False,
                "normalized_at": datetime.utcnow().isoformat()
            }
        }
