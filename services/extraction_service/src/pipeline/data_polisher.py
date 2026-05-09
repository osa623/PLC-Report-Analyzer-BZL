
import re
import logging
from typing import Any, Dict, List, Union

logger = logging.getLogger(__name__)

def clean_json_data(data: Union[Dict, List]) -> Union[Dict, List]:
    """
    Recursively traverse JSON data and polish keys and values.
    """
    if isinstance(data, dict):
        new_dict = {}
        for k, v in data.items():
            new_key = _clean_key(k)
            new_dict[new_key] = clean_json_data(v)
        return new_dict
    elif isinstance(data, list):
        return [clean_json_data(item) for item in data]
    elif isinstance(data, str):
        return _clean_value(data)
    else:
        return data

def _clean_key(key: str) -> str:
    """Clean dictionary keys (row labels)."""
    # Remove leading/trailing markers
    # e.g. "(a) " -> "(a)" is fine, but "_Label" -> "Label"
    
    # Remove underscores, pipes, weird quotes from start/end
    cleaned = key.strip(" _—-|«‘'\"")
    
    # Fix common OCR typos in labels
    # e.g. "Net cash used in financing activities" often has noise
    
    return cleaned

def _clean_value(text: str) -> str:
    """
    Polishes a value string.
    Target artifacts: 
    - Leading/trailing: _ - — « ‘ ' |
    - Internal: dots used as thousand separators (1.000.000 -> 1,000,000)
    - Weird chars: §
    """
    if not text:
        return text
        
    # 0. Check for Standalone Dash (Zero in financial terms)
    # If the text is just horizontal lines, return "-"
    # " — " or "-" or " - "
    item_clean = text.strip()
    if item_clean in ['-', '—', '–', '_']:
        return "-"
        
    # Check for Negative Numbers markers BEFORE aggressive strip
    # Tesseract might give: "(123" or "123)" or "_123" or "—123"
    is_negative = False
    
    # Check parens
    if '(' in text and ')' in text:
        is_negative = True
    
    # Check dashed prefixes
    # Identify if the *first meaningful character* is a dash-like symbol
    # (ignoring underscores/spaces)
    start_check = text.lstrip(" _|«‘'\"")
    if start_check.startswith('-') or start_check.startswith('—') or start_check.startswith('–'):
        is_negative = True
        
    # Now aggressive strip of artifacts
    # We remove dashes from the strip set because we handle them logic-wise? 
    # Actually we want to remove them from the *string content* so we can re-add standard formatting
    cleaned = text.strip(" _—-|«‘'\"§–")
    
    # Extract digits, dots, commas
    # Remove spaces inside numbers? "1 000" -> "1000"
    content = re.sub(r'[^\d.,]', '', cleaned)
    
    # If content empty, return empty
    if not content:
        # If we stripped everything but the original had length, maybe it was text?
        # But for financial columns, purely text entries are usually errors or nil.
        # "Nil" -> ""
        return ""
    
    # Logic to fix formatting
    # If string has multiple '.', replace them with ','
    if content.count('.') > 1:
        # "290.876.688" -> "290,876,688"
        content = content.replace('.', ',')
        
    # If string has mixed '.' and ',':
    # "1.234,56" (Euro style) vs "1,234.56" (US/UK style)
    # The OCR output "270.509.409" suggests Tesseract sometimes reads commas as dots.
    # "336,638.91" suggests standard US style is present too.
    
    # Heuristic: If there is a dot near the end (2-3 chars), it's a decimal.
    # If dots are every 3 chars, they are separators.
    
    # Restore Negative wrapper
    if is_negative:
        return f"({content})"
    
    return content

if __name__ == "__main__":
    # Test cases
    examples = [
        "_(361351,036)_(82.156552)", # Merged garbage?
        "«15080565",
        "(4.787.910)", # Should be (4,787,910)
        "—_(24,821,097)",
        "191.106.801", # Should be 191,106,801
        "336,638.91",
        "§548.079"
    ]
    
    print("Testing DataPolisher:")
    for ex in examples:
        print(f"Original: '{ex}' -> Cleaned: '{_clean_value(ex)}'")
