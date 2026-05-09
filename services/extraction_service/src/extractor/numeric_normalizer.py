"""
Numeric Normalizer
Handles all numeric value normalization:
- Brackets (1,234) as negative
- Dashes/hyphens as null
- Comma/currency stripping
- Decimal preservation
- Column-shift detection and prevention
"""

import re
from typing import Optional, Any, Union, List
from dataclasses import dataclass


@dataclass
class NumericValue:
    """Represents a parsed numeric value with metadata."""
    original_text: str
    normalized_value: Optional[float]
    is_negative: bool
    is_null: bool
    confidence: float = 1.0
    warnings: List[str] = None
    
    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


class NumericNormalizer:
    """
    Normalize numeric values from financial statements.
    
    Handles:
    - Brackets as negatives: (1,234) or (1,234.56)
    - Dashes as nulls: -, –, —
    - Currency symbols: Rs., LKR, USD, $
    - Thousands separators: 1,234,567
    - Decimals: 1,234.56
    - Whitespace and noise
    """
    
    def __init__(self):
        """Initialize numeric normalizer with patterns."""
        # Pattern for bracketed numbers (negative)
        self.bracketed_pattern = r'\(\s*([\d,]+(?:\.\d+)?)\s*\)'
        
        # Pattern for regular numbers
        self.number_pattern = r'-?\s*[\d,]+(?:\.\d+)?'
        
        # Dash patterns (various unicode dashes)
        self.dash_patterns = [
            r'^-$',
            r'^–$',  # en-dash
            r'^—$',  # em-dash
            r'^−$',  # minus sign
            r'^\s*-\s*$',
        ]
        
        # Currency/unit symbols to strip
        self.currency_symbols = ['rs.', 'rs', 'lkr', 'usd', '$', '₨']
        
        # Words indicating null
        self.null_indicators = ['nil', 'n/a', 'na', 'not applicable', '']
    
    def normalize(self, value: Any) -> NumericValue:
        """
        Normalize a single value (can be string, number, or None).
        
        Args:
            value: Raw value from extraction
        
        Returns:
            NumericValue object with normalized data
        """
        original = str(value) if value is not None else ""
        original_trimmed = original.strip()
        
        # Handle None or empty
        if value is None or original_trimmed == "":
            return NumericValue(
                original_text=original,
                normalized_value=None,
                is_negative=False,
                is_null=True
            )
        
        # Convert to string for processing
        text = original_trimmed
        
        # Check for null indicators (dashes, "nil", etc.)
        if self._is_null_indicator(text):
            return NumericValue(
                original_text=original,
                normalized_value=None,
                is_negative=False,
                is_null=True
            )
        
        # Check for bracketed (negative) numbers
        bracket_match = re.search(self.bracketed_pattern, text)
        if bracket_match:
            number_str = bracket_match.group(1)
            parsed = self._parse_number_string(number_str)
            
            if parsed is not None:
                return NumericValue(
                    original_text=original,
                    normalized_value=-abs(parsed),  # Ensure negative
                    is_negative=True,
                    is_null=False
                )
        
        # Try to parse as regular number
        # First, clean the text
        cleaned = self._clean_text(text)
        
        if not cleaned:
            return NumericValue(
                original_text=original,
                normalized_value=None,
                is_negative=False,
                is_null=True,
                warnings=["Could not extract number from text"]
            )
        
        parsed = self._parse_number_string(cleaned)
        
        if parsed is None:
            return NumericValue(
                original_text=original,
                normalized_value=None,
                is_negative=False,
                is_null=True,
                confidence=0.5,
                warnings=["Failed to parse number"]
            )
        
        return NumericValue(
            original_text=original,
            normalized_value=parsed,
            is_negative=parsed < 0,
            is_null=False
        )
    
    def _is_null_indicator(self, text: str) -> bool:
        """Check if text indicates a null/missing value."""
        text_lower = text.lower().strip()
        
        # Check dash patterns
        for pattern in self.dash_patterns:
            if re.match(pattern, text):
                return True
        
        # Check null words
        if text_lower in self.null_indicators:
            return True
        
        return False
    
    def _clean_text(self, text: str) -> str:
        """
        Clean text to extract just the numeric portion.
        
        Removes:
        - Currency symbols
        - Extra whitespace
        - Non-numeric characters (except minus, comma, period)
        """
        cleaned = text.strip()
        
        # Remove currency symbols (case-insensitive)
        for symbol in self.currency_symbols:
            cleaned = re.sub(re.escape(symbol), '', cleaned, flags=re.IGNORECASE)
        
        # Remove other common noise
        cleaned = cleaned.replace(' ', '')
        cleaned = cleaned.replace('\n', '')
        cleaned = cleaned.replace('\t', '')
        
        # Keep only: digits, comma, period, minus
        cleaned = re.sub(r'[^\d,.\-]', '', cleaned)
        
        return cleaned
    
    def _parse_number_string(self, number_str: str) -> Optional[float]:
        """
        Parse a cleaned number string to float.
        
        Handles:
        - Thousands separators: 1,234,567
        - Decimals: 1,234.56
        - Negative: -1,234.56
        
        Args:
            number_str: Cleaned numeric string
        
        Returns:
            Parsed float or None if invalid
        """
        try:
            # Remove commas (thousands separators)
            clean = number_str.replace(',', '')
            
            # Parse to float
            value = float(clean)
            
            return value
        
        except (ValueError, TypeError):
            return None
    
    def normalize_row(
        self,
        row_values: List[Any]
    ) -> List[NumericValue]:
        """
        Normalize all values in a row.
        
        Args:
            row_values: List of raw values from a table row
        
        Returns:
            List of NumericValue objects
        """
        return [self.normalize(val) for val in row_values]
    
    def detect_column_shift(
        self,
        row1_values: List[NumericValue],
        row2_values: List[NumericValue],
        expected_columns: int
    ) -> bool:
        """
        Detect if columns might have shifted (common OCR error).
        
        Checks:
        - Do rows have consistent column counts?
        - Are non-null values in expected positions?
        
        Args:
            row1_values: First row normalized values
            row2_values: Second row normalized values
            expected_columns: Expected number of columns
        
        Returns:
            True if shift detected
        """
        # Check if column counts differ significantly
        if abs(len(row1_values) - len(row2_values)) > 1:
            return True
        
        # Check if column count differs from expected
        if abs(len(row1_values) - expected_columns) > 1:
            return True
        
        # Check if non-null positions are consistent
        non_null_cols_1 = [i for i, v in enumerate(row1_values) if not v.is_null]
        non_null_cols_2 = [i for i, v in enumerate(row2_values) if not v.is_null]
        
        # If patterns are very different, possible shift
        if len(non_null_cols_1) > 0 and len(non_null_cols_2) > 0:
            # Check if they overlap
            overlap = set(non_null_cols_1) & set(non_null_cols_2)
            if len(overlap) == 0:
                return True
        
        return False
    
    def apply_unit_conversion(
        self,
        value: NumericValue,
        source_unit: str,
        target_unit: str
    ) -> NumericValue:
        """
        Apply unit conversion (e.g., millions to thousands).
        
        Args:
            value: Normalized numeric value
            source_unit: Source unit ('ones', 'thousands', 'millions', 'billions')
            target_unit: Target unit
        
        Returns:
            Converted NumericValue
        """
        unit_multipliers = {
            'ones': 1,
            'thousands': 1_000,
            'millions': 1_000_000,
            'billions': 1_000_000_000
        }
        
        if value.normalized_value is None:
            return value
        
        source_mult = unit_multipliers.get(source_unit.lower(), 1)
        target_mult = unit_multipliers.get(target_unit.lower(), 1)
        
        # Convert to ones, then to target
        value_in_ones = value.normalized_value * source_mult
        converted = value_in_ones / target_mult
        
        return NumericValue(
            original_text=value.original_text,
            normalized_value=round(converted, 2),
            is_negative=value.is_negative,
            is_null=False,
            confidence=value.confidence,
            warnings=value.warnings + [f"Converted from {source_unit} to {target_unit}"]
        )
