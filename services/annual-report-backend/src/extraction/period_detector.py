"""Period/date detection module."""

import re
from datetime import datetime
from typing import Optional, Dict, List
from src.utils.logger import get_logger

logger = get_logger(__name__)


MONTH_NAMES = {
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12
}


def detect_period(text: str) -> Optional[Dict[str, any]]:
    """
    Detect financial period from text.
    
    Args:
        text: Text to analyze
    
    Returns:
        Dictionary with period information
    """
    text_lower = text.lower()
    
    # Pattern 1: "For the year ended 31 December 2023"
    pattern1 = r'for the year ended\s+(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})'
    match = re.search(pattern1, text_lower)
    if match:
        day, month_name, year = match.groups()
        month = MONTH_NAMES.get(month_name.lower())
        if month:
            try:
                date = datetime(int(year), month, int(day))
                return {
                    'type': 'year_ended',
                    'date': date,
                    'year': int(year),
                    'month': month,
                    'day': int(day),
                    'text': match.group(0)
                }
            except ValueError:
                pass
    
    # Pattern 2: "As at 31 December 2023"
    pattern2 = r'as at\s+(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})'
    match = re.search(pattern2, text_lower)
    if match:
        day, month_name, year = match.groups()
        month = MONTH_NAMES.get(month_name.lower())
        if month:
            try:
                date = datetime(int(year), month, int(day))
                return {
                    'type': 'as_at',
                    'date': date,
                    'year': int(year),
                    'month': month,
                    'day': int(day),
                    'text': match.group(0)
                }
            except ValueError:
                pass
    
    # Pattern 3: "Year ended December 2023"
    pattern3 = r'year ended\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})'
    match = re.search(pattern3, text_lower)
    if match:
        month_name, year = match.groups()
        month = MONTH_NAMES.get(month_name.lower())
        if month:
            return {
                'type': 'year_ended',
                'date': datetime(int(year), month, 1),
                'year': int(year),
                'month': month,
                'text': match.group(0)
            }
    
    # Pattern 4: Just year "2023"
    pattern4 = r'\b(20\d{2})\b'
    matches = re.findall(pattern4, text)
    if matches:
        # Get the most recent year mentioned
        year = max(int(y) for y in matches)
        return {
            'type': 'year',
            'year': year,
            'text': str(year)
        }
    
    return None


def detect_comparative_periods(text: str) -> List[Dict[str, any]]:
    """
    Detect multiple periods (current and comparative).
    
    Args:
        text: Text to analyze
    
    Returns:
        List of period dictionaries
    """
    text_lower = text.lower()
    periods = []
    
    # Find all year mentions
    year_pattern = r'\b(20\d{2})\b'
    years = list(set(re.findall(year_pattern, text)))
    years = sorted([int(y) for y in years], reverse=True)
    
    if len(years) >= 2:
        # Current year
        periods.append({
            'type': 'current',
            'year': years[0]
        })
        # Previous year
        periods.append({
            'type': 'comparative',
            'year': years[1]
        })
    elif len(years) == 1:
        periods.append({
            'type': 'current',
            'year': years[0]
        })
    
    logger.info(f"Detected {len(periods)} periods: {[p['year'] for p in periods]}")
    
    return periods


def extract_period_from_statement(text: str, lines: int = 10) -> Optional[Dict[str, any]]:
    """
    Extract period from the beginning of a financial statement.
    
    Args:
        text: Full text
        lines: Number of initial lines to search
    
    Returns:
        Period dictionary or None
    """
    text_lines = text.split('\n')[:lines]
    search_text = '\n'.join(text_lines)
    
    period = detect_period(search_text)
    
    if period:
        logger.info(f"Extracted period: {period.get('text', period.get('year'))}")
    
    return period
