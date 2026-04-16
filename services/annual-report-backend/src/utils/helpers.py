"""Helper utility functions for the AI Extractor."""

import re
import yaml
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime


def load_config(config_path: str = "config/settings.yaml") -> Dict[str, Any]:
    """
    Load configuration from YAML file.
    
    Args:
        config_path: Path to the config file
    
    Returns:
        Configuration dictionary
    """
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    return config


def clean_text(text: str) -> str:
    """
    Clean and normalize text.
    
    Args:
        text: Raw text
    
    Returns:
        Cleaned text
    """
    if not text:
        return ""
    
    # Remove extra whitespace
    text = ' '.join(text.split())
    
    # Remove special characters but keep important ones
    text = text.strip()
    
    return text


def extract_numbers(text: str) -> Optional[float]:
    """
    Extract numerical value from text.
    
    Args:
        text: Text containing numbers
    
    Returns:
        Extracted number or None
    """
    if not text:
        return None
    
    # Clean the text
    text = str(text).strip()
    
    # Handle parentheses (negative numbers) - do this first
    is_negative = False
    if '(' in text and ')' in text:
        is_negative = True
        text = text.replace('(', '').replace(')', '')
    
    # Remove currency symbols and text
    text = re.sub(r'[A-Za-z$€£₹Rs]+', '', text)
    
    # Remove commas and spaces
    text = text.replace(',', '').replace(' ', '').replace("'", '')
    
    # Handle negative sign
    if text.startswith('-'):
        is_negative = True
        text = text[1:]
    
    # Extract number using regex - now should find decimal numbers
    match = re.search(r'\d+\.?\d*', text)
    if match:
        try:
            value = float(match.group())
            return -value if is_negative else value
        except ValueError:
            return None
    
    return None


def parse_currency_unit(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse currency and unit from text.
    
    Args:
        text: Text containing currency/unit information
    
    Returns:
        Tuple of (currency, unit)
    """
    text_lower = text.lower()
    
    # Currency detection
    currency = None
    if any(c in text_lower for c in ['rs', 'lkr', 'rupees']):
        currency = 'LKR'
    elif 'usd' in text_lower or '$' in text:
        currency = 'USD'
    
    # Unit detection
    unit = None
    if "'000" in text or "000" in text or "thousands" in text_lower:
        unit = 'thousands'
    elif "million" in text_lower:
        unit = 'millions'
    elif "billion" in text_lower:
        unit = 'billions'
    
    return currency, unit


def normalize_value(value: float, unit: str, target_unit: str = 'thousands') -> float:
    """
    Normalize value to target unit.
    
    Args:
        value: Value to normalize
        unit: Current unit
        target_unit: Target unit
    
    Returns:
        Normalized value
    """
    if not value or not unit:
        return value
    
    conversion_factors = {
        'ones': 1,
        'thousands': 1000,
        'millions': 1000000,
        'billions': 1000000000
    }
    
    if unit not in conversion_factors or target_unit not in conversion_factors:
        return value
    
    # Convert to ones first, then to target unit
    value_in_ones = value * conversion_factors[unit]
    normalized_value = value_in_ones / conversion_factors[target_unit]
    
    return normalized_value


def extract_date(text: str) -> Optional[datetime]:
    """
    Extract date from text.
    
    Args:
        text: Text containing date
    
    Returns:
        Datetime object or None
    """
    # Common date patterns
    patterns = [
        r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})',  # DD/MM/YYYY or DD-MM-YYYY
        r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})',  # YYYY/MM/DD or YYYY-MM-DD
        r'(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})',
        r'(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})'
    ]
    
    text_lower = text.lower()
    
    for pattern in patterns:
        match = re.search(pattern, text_lower)
        if match:
            try:
                # Try to parse the date
                if pattern == patterns[0]:  # DD/MM/YYYY
                    day, month, year = match.groups()
                    return datetime(int(year), int(month), int(day))
                elif pattern == patterns[1]:  # YYYY/MM/DD
                    year, month, day = match.groups()
                    return datetime(int(year), int(month), int(day))
                # Add more parsing logic for other patterns as needed
            except (ValueError, TypeError):
                continue
    
    return None


def fuzzy_match(text: str, candidates: List[str], threshold: int = 85) -> Optional[str]:
    """
    Find the best fuzzy match from candidates.
    
    Args:
        text: Text to match
        candidates: List of candidate strings
        threshold: Minimum similarity threshold (0-100)
    
    Returns:
        Best matching candidate or None
    """
    try:
        from fuzzywuzzy import process
        
        result = process.extractOne(text, candidates)
        if result and result[1] >= threshold:
            return result[0]
    except ImportError:
        # Fallback to exact match if fuzzywuzzy not available
        text_lower = text.lower()
        for candidate in candidates:
            if candidate.lower() == text_lower:
                return candidate
    
    return None


def ensure_dir(directory: str) -> Path:
    """
    Ensure directory exists, create if it doesn't.
    
    Args:
        directory: Directory path
    
    Returns:
        Path object
    """
    path = Path(directory)
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_file_hash(file_path: str) -> str:
    """
    Generate MD5 hash of a file.
    
    Args:
        file_path: Path to file
    
    Returns:
        MD5 hash string
    """
    import hashlib
    
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()
