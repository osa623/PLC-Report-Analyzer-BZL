"""Currency detection module."""

import re
from typing import Optional, Tuple
from src.utils.logger import get_logger

logger = get_logger(__name__)


def detect_currency(text: str) -> Optional[str]:
    """
    Detect currency from text.
    
    Args:
        text: Text to analyze
    
    Returns:
        Currency code (e.g., 'LKR', 'USD') or None
    """
    text_lower = text.lower()
    
    # Sri Lankan Rupees
    if any(keyword in text_lower for keyword in ['lkr', 'rs.', 'rs ', 'rupees', 'sri lankan rupees']):
        return 'LKR'
    
    # US Dollars
    if any(keyword in text_lower for keyword in ['usd', 'us$', 'us dollars', 'dollars']):
        return 'USD'
    
    # Indian Rupees
    if any(keyword in text_lower for keyword in ['inr', 'indian rupees']):
        return 'INR'
    
    # Euro
    if any(keyword in text_lower for keyword in ['eur', '€', 'euro']):
        return 'EUR'
    
    # British Pound
    if any(keyword in text_lower for keyword in ['gbp', '£', 'pound']):
        return 'GBP'
    
    return None


def detect_unit(text: str) -> Optional[str]:
    """
    Detect unit/scale from text.
    
    Args:
        text: Text to analyze
    
    Returns:
        Unit ('ones', 'thousands', 'millions', 'billions') or None
    """
    text_lower = text.lower()
    
    # Check for billions
    if any(keyword in text_lower for keyword in ['billion', 'bn', "'000,000,000"]):
        return 'billions'
    
    # Check for millions
    if any(keyword in text_lower for keyword in ['million', 'mn', "'000,000", "000,000"]):
        return 'millions'
    
    # Check for thousands
    if any(keyword in text_lower for keyword in ['thousand', "'000", "000)", "(000"]):
        # Make sure it's not millions (which also contains 000)
        if 'million' not in text_lower:
            return 'thousands'
    
    return None


def detect_currency_and_unit(text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Detect both currency and unit from text.
    
    Args:
        text: Text to analyze
    
    Returns:
        Tuple of (currency, unit)
    """
    currency = detect_currency(text)
    unit = detect_unit(text)
    
    logger.info(f"Detected: Currency={currency}, Unit={unit}")
    
    return currency, unit


def extract_currency_statement(text: str, lines: int = 5) -> Tuple[Optional[str], Optional[str]]:
    """
    Extract currency and unit from the first few lines of a document.
    
    Args:
        text: Full text to search
        lines: Number of lines to check
    
    Returns:
        Tuple of (currency, unit)
    """
    text_lines = text.split('\n')[:lines]
    search_text = '\n'.join(text_lines)
    
    return detect_currency_and_unit(search_text)
