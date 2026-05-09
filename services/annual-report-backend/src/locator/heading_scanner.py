"""
Heading Scanner
Scans pages for statement headings using text layer or lightweight OCR.
"""

import re
from typing import Dict, List, Optional, Set
from dataclasses import dataclass
import pdfplumber


@dataclass
class HeadingMatch:
    """Represents a heading match on a page."""
    page_num: int
    heading_text: str
    match_score: float
    position: Optional[str] = None  # 'top', 'middle', 'bottom'


class HeadingScanner:
    """Scan PDF pages for statement headings."""
    
    def __init__(self):
        """Initialize heading scanner with keyword patterns."""
        # Define statement keywords directly
        self.statement_keywords = {
            'Income_Statement': [
                'income statement',
                'statement of profit or loss',
                'statement of comprehensive income',
                'profit and loss',
                'statement of income'
            ],
            'Financial Position Statement': [
                'statement of financial position',
                'balance sheet',
                'statement of assets and liabilities',
                'financial position'
            ],
            'Cash Flow Statement': [
                'statement of cash flows',
                'cash flow statement',
                'statement of cash flow'
            ]
        }
        
        # Heading characteristics
        self.heading_indicators = [
            r'statement\s+of',
            r'consolidated\s+',
        ]
    
    def is_likely_heading(self, text: str, line_position: str = None) -> float:
        """
        Determine if a text line is likely a statement heading.
        
        Args:
            text: Text line to check
            line_position: Position in page ('top', 'middle', 'bottom')
            
        Returns:
            Likelihood score (0.0 to 1.0)
        """
        score = 0.0
        text_lower = text.lower()
        
        # CRITICAL: Must be a clean statement title, not embedded in paragraph
        # Check for disqualifying patterns (indicates it's within notes/explanations)
        disqualifying_patterns = [
            r'note\s+\d+',  # "Note 5", "note 32"
            r'refer to note',
            r'as set out in',
            r'described in',
            r'in accordance with',
            r'are presented',
            r'are summarised',
            r'paragraph',
            r'in us dollors',
            r'section\s+\d+'
        ]
        
        for pattern in disqualifying_patterns:
            if re.search(pattern, text_lower):
                return 0.0  # Disqualify - this is reference text, not a heading
        
        # MUST contain core statement keywords
        core_keywords = [
            'income statement',
            'statement of profit',
            'statement of comprehensive income',
            'statement of financial position',
            'statement of cash flow',
            'cash flow statement'
        ]
        
        has_core_keyword = any(keyword in text_lower for keyword in core_keywords)
        if not has_core_keyword:
            return 0.0  # Must have a core statement keyword
        
        # Check for heading indicator patterns
        for pattern in self.heading_indicators:
            if re.search(pattern, text_lower):
                score += 0.3
        
        # Title case or ALL CAPS suggests heading
        if text.isupper() or text.istitle():
            score += 0.3
        else:
            score += 0.1  # Still possible but lower score
        
        # Position at top of page strongly increases likelihood
        if line_position == 'top':
            score += 0.3
        elif line_position == 'middle':
            score += 0.1
        
        # Shorter text more likely to be heading (not a paragraph)
        word_count = len(text.split())
        if 2 <= word_count <= 8:
            score += 0.3
        elif word_count <= 15:
            score += 0.1
        else:
            score -= 0.2  # Long text is probably not a heading
        
        # Should NOT have too many lowercase words (indicates paragraph)
        if word_count > 10:
            score -= 0.3
        
        return max(0.0, min(score, 1.0))
    
    def extract_headings_from_page(
        self, 
        page, 
        page_num: int
    ) -> List[HeadingMatch]:
        """
        Extract potential headings from a single page.
        
        Args:
            page: pdfplumber page object
            page_num: Page number (0-indexed)
            
        Returns:
            List of HeadingMatch objects
        """
        headings = []
        
        try:
            text = page.extract_text() or ""
            if not text:
                return headings
            
            lines = text.split('\n')
            total_lines = len(lines)
            
            for i, line in enumerate(lines):
                line = line.strip()
                if not line or len(line) < 5:
                    continue
                
                # Determine line position
                if i < total_lines * 0.2:
                    position = 'top'
                elif i > total_lines * 0.8:
                    position = 'bottom'
                else:
                    position = 'middle'
                
                # Check if likely heading
                heading_score = self.is_likely_heading(line, position)
                
                if heading_score >= 0.5:  # Threshold for considering as heading
                    headings.append(HeadingMatch(
                        page_num=page_num,
                        heading_text=line,
                        match_score=heading_score,
                        position=position
                    ))
        
        except Exception:
            pass
        
        return headings
    
    def match_headings_to_statements(
        self,
        headings: List[HeadingMatch]
    ) -> Dict[str, List[HeadingMatch]]:
        """
        Match extracted headings to statement types.
        
        Args:
            headings: List of extracted headings
            
        Returns:
            Dictionary mapping statement types to matching headings
        """
        matches = {
            'Income_Statement': [],
            'Financial Position Statement': [],
            'Cash Flow Statement': []
        }
        
        for heading in headings:
            text_lower = heading.heading_text.lower()
            
            for statement_type, keywords in self.statement_keywords.items():
                for keyword in keywords:
                    # Use fuzzy matching for keywords
                    keyword_pattern = keyword.replace(' ', r'\s+')
                    if re.search(keyword_pattern, text_lower):
                        matches[statement_type].append(heading)
                        break  # Don't match same heading multiple times to same statement
        
        return matches
    
    def scan_pages_for_statements(
        self,
        pdf,
        page_range: Optional[List[int]] = None
    ) -> Dict[str, List[Dict]]:
        """
        Main method: scan pages for statement headings.
        
        Args:
            pdf: pdfplumber PDF object
            page_range: Optional list of page numbers to scan (0-indexed)
                       If None, scans all pages
        
        Returns:
            Dictionary with statement type -> list of candidate pages with metadata
            Format: {
                'Income_Statement': [
                    {
                        'page_range': [page_num],
                        'confidence': 0.7,
                        'evidence': 'Heading found: "Statement of Income"',
                        'source': 'heading_scan'
                    }
                ]
            }
        """
        results = {
            'Income_Statement': [],
            'Financial Position Statement': [],
            'Cash Flow Statement': []
        }
        
        if page_range is None:
            page_range = list(range(len(pdf.pages)))
        
        # Extract headings from all specified pages
        all_headings = []
        for page_num in page_range:
            if 0 <= page_num < len(pdf.pages):
                try:
                    page = pdf.pages[page_num]
                    headings = self.extract_headings_from_page(page, page_num)
                    all_headings.extend(headings)
                except Exception:
                    continue
        
        # Match headings to statements
        matches = self.match_headings_to_statements(all_headings)
        
        # Build results with confidence
        for statement_type, matched_headings in matches.items():
            # Group by page number
            pages_dict = {}
            for heading in matched_headings:
                if heading.page_num not in pages_dict:
                    pages_dict[heading.page_num] = []
                pages_dict[heading.page_num].append(heading)
            
            # Create page range entries
            for page_num, page_headings in pages_dict.items():
                # Multiple headings on same page increase confidence
                confidence = min(0.6 + len(page_headings) * 0.1, 0.9)
                
                best_heading = max(page_headings, key=lambda h: h.match_score)
                
                # Statement typically spans 1-2 pages for main statements
                page_range_end = min(page_num + 1, len(pdf.pages) - 1)
                
                # Boost confidence if heading is clean and at top
                if best_heading.position == 'top' and best_heading.match_score >= 0.8:
                    confidence = min(confidence + 0.1, 0.95)
                
                results[statement_type].append({
                    'page_range': [page_num, page_range_end],
                    'confidence': confidence,
                    'evidence': f"Heading found: '{best_heading.heading_text}'",
                    'source': 'heading_scan',
                    'heading_position': best_heading.position,
                    'match_score': best_heading.match_score
                })
        
        return results
