"""Key-value extraction using AI/LLM."""

import os
import json
import re
from typing import Dict, List, Optional, Any
from src.utils.logger import get_logger
from src.utils.helpers import extract_numbers, fuzzy_match
from config.target_schema_bank import TARGET_FIELDS
from config.term_mapping_bank import TERM_MAPPING

logger = get_logger(__name__)


class KeyValueExtractor:
    """Extract key-value pairs using AI/LLM or rule-based methods."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize key-value extractor.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config or {}
        self.provider = self.config.get('provider', 'gemini')
        self.model = self.config.get('model', 'gemini-pro')
        self.temperature = self.config.get('temperature', 0.1)
        self.use_fallback = self.config.get('use_rule_based_fallback', True)
        self.client = None
        
        # Initialize API client based on provider
        if self.provider == 'gemini':
            logger.info("Gemini API has deprecated the old package. Using rule-based extraction instead.")
            self.provider = 'rule-based'  # Force rule-based
            self.client = None
        elif self.provider == 'openai':
            try:
                import openai
                self.client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
                logger.info(f"Initialized OpenAI - {self.model}")
            except ImportError:
                logger.error("OpenAI package not installed")
        elif self.provider == 'anthropic':
            try:
                import anthropic
                self.client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
                logger.info(f"Initialized Anthropic - {self.model}")
            except ImportError:
                logger.error("Anthropic package not installed")
        elif self.provider == 'rule-based':
            logger.info("Using rule-based extraction (NO API REQUIRED)")
        else:
            logger.warning(f"Unknown provider: {self.provider}, will use rule-based extraction")
    
    def create_extraction_prompt(
        self, 
        text: str, 
        statement_type: str, 
        period: Optional[str] = None
    ) -> str:
        """
        Create prompt for AI extraction.
        
        Args:
            text: Text to extract from
            statement_type: Type of statement (income_statement, balance_sheet, cash_flow)
            period: Financial period
        
        Returns:
            Formatted prompt
        """
        # Get target fields for this statement type
        schema_key = {
            'income_statement': 'Income_Statement',
            'balance_sheet': 'Financial Position Statement',
            'cash_flow': 'Cash Flow Statement'
        }.get(statement_type, 'Income_Statement')
        
        fields = TARGET_FIELDS.get(schema_key, [])
        
        prompt = f"""You are a financial data extraction AI. Extract specific values from the following financial statement text.

Statement Type: {statement_type}
{f'Period: {period}' if period else ''}

Target Fields to Extract:
{chr(10).join(f'- {field}' for field in fields[:20])}  # Limit to first 20 for token limits
... and other related fields from the {statement_type}.

Instructions:
1. Extract exact numerical values for each field (without currency symbols or commas)
2. If a value is negative (in parentheses or with minus), include the negative sign
3. If a field is not found in the text, set its value to null
4. Return values in the same unit mentioned in the document (thousands, millions, etc.)
5. Return results as a JSON object with field names as keys and numbers as values

Text to extract from:
{text[:4000]}  # Limit text length to avoid token limits

Return only the JSON object, no additional text."""
        
        return prompt
    
    def extract_with_openai(self, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Extract data using OpenAI API.
        
        Args:
            prompt: Extraction prompt
        
        Returns:
            Extracted data dictionary
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a financial data extraction expert. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.temperature,
                response_format={"type": "json_object"}
            )
            
            result = response.choices[0].message.content
            data = json.loads(result)
            
            logger.info(f"Extracted {len(data)} fields using OpenAI")
            return data
            
        except Exception as e:
            logger.error(f"Error extracting with OpenAI: {str(e)}")
            return None
    
    def extract_with_anthropic(self, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Extract data using Anthropic Claude API.
        
        Args:
            prompt: Extraction prompt
        
        Returns:
            Extracted data dictionary
        """
        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                temperature=self.temperature,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            result = message.content[0].text
            # Extract JSON from response
            if '{' in result and '}' in result:
                json_start = result.find('{')
                json_end = result.rfind('}') + 1
                json_str = result[json_start:json_end]
                data = json.loads(json_str)
                
                logger.info(f"Extracted {len(data)} fields using Anthropic")
                return data
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting with Anthropic: {str(e)}")
            return None
    
    def extract_with_gemini(self, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Extract data using Google Gemini API (DEPRECATED - Falls back to rule-based).
        
        Args:
            prompt: Extraction prompt
        
        Returns:
            None (always falls back to rule-based)
        """
        logger.warning("Gemini API package is deprecated. Use rule-based extraction instead.")
        return None
    
    def extract_rule_based(self, text: str, statement_type: str) -> Dict[str, Any]:
        """
        Extract data using rule-based pattern matching (NO API REQUIRED).
        
        Args:
            text: Text to extract from
            statement_type: Type of statement (section name from TARGET_FIELDS)
        
        Returns:
            Extracted data dictionary
        """
        logger.info(f"Using rule-based extraction for: {statement_type}")
        data = {}
        
        # Get target fields directly from the statement_type (which is now the schema key)
        fields = TARGET_FIELDS.get(statement_type, [])
        
        if not fields:
            logger.warning(f"No fields found for statement type: {statement_type}")
            return data
        
        logger.info(f"Attempting to extract {len(fields)} fields")
        
        # Clean text for better matching
        text_clean = text.lower()
        
        # For each field, try to find it in text
        for field in fields:
            # Get all variations from term mapping
            variations = TERM_MAPPING.get(field, [field.lower()])
            
            found = False
            for variation in variations:
                if found:
                    break
                    
                # Multiple patterns to catch different formats
                patterns = [
                    # Pattern 1: "field name" followed by number on same or next line
                    rf'{re.escape(variation)}\s*[:\-]?\s*([\d,\.\(\)\-]+)',
                    # Pattern 2: Number before field name (for totals)
                    rf'([\d,\.\(\)\-]+)\s+{re.escape(variation)}',
                    # Pattern 3: Field with multiple spaces/tabs before number
                    rf'{re.escape(variation)}\s{{2,}}([\d,\.\(\)\-]+)',
                    # Pattern 4: Field on one line, number on next line
                    rf'{re.escape(variation)}\s*\n\s*([\d,\.\(\)\-]+)',
                ]
                
                for pattern in patterns:
                    matches = re.finditer(pattern, text_clean, re.IGNORECASE | re.MULTILINE)
                    for match in matches:
                        value_str = match.group(1)
                        value = extract_numbers(value_str)
                        if value is not None and value != 0:
                            data[field] = value
                            found = True
                            logger.debug(f"Found {field}: {value} (pattern matched: {variation})")
                            break
                    if found:
                        break
        
        logger.info(f"Rule-based extraction found {len(data)}/{len(fields)} fields ({len(data)/len(fields)*100:.1f}%)")
        return data
    
    def extract(
        self, 
        text: str, 
        statement_type: str, 
        period: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract key-value pairs from text.
        
        Args:
            text: Text to extract from
            statement_type: Type of statement
            period: Financial period
        
        Returns:
            Extracted data dictionary
        """
        # Try rule-based if no API or provider is rule-based
        if self.provider == 'rule-based' or not self.client:
            return self.extract_rule_based(text, statement_type)
        
        # Try API extraction
        prompt = self.create_extraction_prompt(text, statement_type, period)
        data = None
        
        try:
            if self.provider == 'gemini':
                data = self.extract_with_gemini(prompt)
            elif self.provider == 'openai':
                data = self.extract_with_openai(prompt)
            elif self.provider == 'anthropic':
                data = self.extract_with_anthropic(prompt)
            else:
                logger.error(f"Unknown provider: {self.provider}")
        except Exception as e:
            logger.error(f"API extraction failed: {str(e)}")
        
        # Fallback to rule-based if API fails
        if not data and self.use_fallback:
            logger.warning("API extraction failed, using rule-based fallback")
            data = self.extract_rule_based(text, statement_type)
        
        return data or {}
    
    def map_to_standard_fields(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map extracted field names to standard schema fields using term mapping.
        
        Args:
            extracted_data: Raw extracted data
        
        Returns:
            Mapped data with standard field names
        """
        mapped_data = {}
        
        for key, value in extracted_data.items():
            # Try to find matching standard field
            key_lower = key.lower().strip()
            
            # Check exact matches in term mapping
            for standard_field, variations in TERM_MAPPING.items():
                variations_lower = [v.lower() for v in variations]
                if key_lower in variations_lower or key_lower == standard_field.lower():
                    mapped_data[standard_field] = value
                    break
            else:
                # No mapping found, use original key
                mapped_data[key] = value
        
        logger.info(f"Mapped {len(mapped_data)} fields to standard schema")
        return mapped_data
