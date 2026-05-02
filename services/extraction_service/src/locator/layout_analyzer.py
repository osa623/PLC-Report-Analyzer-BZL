"""
Layout Analyzer
Analyzes page layout to identify financial statement characteristics:
- High numeric density
- Table-like structures
- Year headers
- Bank/Group headers
- Note column presence
"""

import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import pdfplumber


@dataclass
class LayoutSignals:
    """Layout analysis signals for a page."""
    page_num: int
    numeric_density: float  # 0.0 to 1.0
    has_table_structure: bool
    has_year_headers: bool
    has_bank_group_headers: bool
    has_note_column: bool
    table_count: int
    overall_score: float = 0.0


class LayoutAnalyzer:
    """Analyze page layout to identify financial statements."""
    
    def __init__(self):
        """Initialize layout analyzer."""
        # Patterns for detecting financial statement features
        self.year_pattern = r'\b20\d{2}\b'  # Matches years like 2023, 2024
        self.bank_group_pattern = r'\b(bank|group|company|consolidated)\b'
        self.note_pattern = r'\b(note|notes?)\b'
        self.currency_pattern = r'(rs\.?|lkr|usd|\$|rupees?)'
        
        # Numeric patterns
        self.number_pattern = r'[\d,]+(?:\.\d+)?'
    
    def calculate_numeric_density(self, text: str) -> float:
        """
        Calculate the density of numeric values in text.
        
        Args:
            text: Page text
            
        Returns:
            Numeric density score (0.0 to 1.0)
        """
        if not text:
            return 0.0
        
        # Count numbers
        numbers = re.findall(self.number_pattern, text)
        
        # Count total words
        words = text.split()
        
        if not words:
            return 0.0
        
        # Density = ratio of numeric tokens to total words
        density = len(numbers) / len(words)
        
        # Financial statements have HIGH numeric density (30-60%)
        # Notes pages have lower density (10-20%)
        # Normalize accordingly
        if density >= 0.3:
            # High density - likely actual statement
            normalized = min(0.8 + (density - 0.3) * 0.67, 1.0)
        elif density >= 0.2:
            # Medium density - could be statement
            normalized = 0.5 + (density - 0.2) * 3.0
        else:
            # Low density - probably notes/text
            normalized = density * 2.5
        
        return round(normalized, 2)
    
    def calculate_text_to_number_ratio(self, text: str) -> float:
        """
        Calculate ratio of text to numbers. 
        High ratio = notes page, Low ratio = data table.
        
        Returns:
            Ratio value (higher = more text, lower = more numbers)
        """
        if not text:
            return 0.0
        
        # Count words (non-numeric)
        words = [w for w in text.split() if not re.match(r'^[\d,.\(\)\-]+$', w)]
        
        # Count numbers
        numbers = re.findall(self.number_pattern, text)
        
        if not numbers:
            return 10.0  # Very high ratio = all text
        
        ratio = len(words) / len(numbers)
        return round(ratio, 2)
    
    def detect_table_structure(self, page) -> Tuple[bool, int]:
        """
        Detect if page has table structures.
        
        Args:
            page: pdfplumber page object
            
        Returns:
            Tuple of (has_tables: bool, table_count: int)
        """
        try:
            tables = page.extract_tables()
            table_count = len(tables) if tables else 0
            
            # Check for meaningful tables (not just 1 row)
            meaningful_tables = 0
            if tables:
                for table in tables:
                    if table and len(table) >= 3:  # At least 3 rows
                        meaningful_tables += 1
            
            return meaningful_tables > 0, meaningful_tables
        
        except Exception:
            return False, 0
    
    def detect_year_headers(self, text: str) -> bool:
        """
        Detect if page has year headers (e.g., 2023, 2024 at top).
        
        Args:
            text: Page text
            
        Returns:
            True if year headers detected
        """
        if not text:
            return False
        
        # Check first few lines for years
        lines = text.split('\n')[:10]
        first_text = '\n'.join(lines)
        
        years = re.findall(self.year_pattern, first_text)
        
        # Financial statements typically show 2 years
        return len(years) >= 2
    
    def detect_bank_group_headers(self, text: str) -> bool:
        """
        Detect if page has Bank/Group column headers.
        
        Args:
            text: Page text
            
        Returns:
            True if Bank/Group headers detected
        """
        if not text:
            return False
        
        text_lower = text.lower()
        
        # Check first portion of page for "Bank" and "Group"
        lines = text.split('\n')[:15]
        first_text = '\n'.join(lines).lower()
        
        has_bank = 'bank' in first_text
        has_group = 'group' in first_text
        
        # Both should appear close together (same line or adjacent lines)
        return has_bank and has_group
    
    def detect_note_column(self, text: str) -> bool:
        """
        Detect if page has a "Note" column (common in financial statements).
        
        Args:
            text: Page text
            
        Returns:
            True if Note column detected
        """
        if not text:
            return False
        
        text_lower = text.lower()
        
        # Look for "Note" or "Notes" in first portion
        lines = text.split('\n')[:15]
        first_text = '\n'.join(lines).lower()
        
        return 'note' in first_text
    
    def analyze_page(self, page, page_num: int) -> LayoutSignals:
        """
        Analyze a single page for financial statement layout signals.
        
        Args:
            page: pdfplumber page object
            page_num: Page number (0-indexed)
            
        Returns:
            LayoutSignals object with analysis results
        """
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        
        # Calculate all signals
        numeric_density = self.calculate_numeric_density(text)
        has_table_structure, table_count = self.detect_table_structure(page)
        has_year_headers = self.detect_year_headers(text)
        has_bank_group_headers = self.detect_bank_group_headers(text)
        has_note_column = self.detect_note_column(text)
        
        # Calculate text-to-number ratio
        text_to_number_ratio = self.calculate_text_to_number_ratio(text)
        
        # Calculate overall score
        overall_score = 0.0
        
        # Higher weights for stronger indicators
        overall_score += numeric_density * 0.35  # Increased - critical indicator
        overall_score += (1.0 if has_table_structure else 0.0) * 0.30  # Increased - tables = statements
        overall_score += (1.0 if has_year_headers else 0.0) * 0.15
        overall_score += (1.0 if has_bank_group_headers else 0.0) * 0.15
        overall_score += (1.0 if has_note_column else 0.0) * 0.05
        
        # PENALTY for high text-to-number ratio (indicates notes page)
        if text_to_number_ratio > 5.0:
            overall_score *= 0.5  # Reduce score by half for text-heavy pages
        elif text_to_number_ratio > 3.0:
            overall_score *= 0.7  # Moderate penalty
        
        signals = LayoutSignals(
            page_num=page_num,
            numeric_density=numeric_density,
            has_table_structure=has_table_structure,
            has_year_headers=has_year_headers,
            has_bank_group_headers=has_bank_group_headers,
            has_note_column=has_note_column,
            table_count=table_count,
            overall_score=round(overall_score, 2)
        )
        
        return signals
    
    def analyze_page_range(
        self,
        pdf,
        page_range: Optional[List[int]] = None
    ) -> List[LayoutSignals]:
        """
        Analyze layout signals for a range of pages.
        
        Args:
            pdf: pdfplumber PDF object
            page_range: Optional list of page numbers (0-indexed)
                       If None, analyzes all pages
        
        Returns:
            List of LayoutSignals for each page
        """
        if page_range is None:
            page_range = list(range(len(pdf.pages)))
        
        signals_list = []
        
        for page_num in page_range:
            if 0 <= page_num < len(pdf.pages):
                try:
                    page = pdf.pages[page_num]
                    signals = self.analyze_page(page, page_num)
                    signals_list.append(signals)
                except Exception:
                    continue
        
        return signals_list
    
    def identify_statement_pages_by_layout(
        self,
        pdf,
        min_score: float = 0.6,
        page_range: Optional[List[int]] = None
    ) -> Dict[str, List[Dict]]:
        """
        Identify pages that likely contain financial statements based on layout.
        
        Args:
            pdf: pdfplumber PDF object
            min_score: Minimum overall score threshold
            page_range: Optional list of page numbers to analyze
        
        Returns:
            Dictionary with generic candidates (not statement-specific yet)
        """
        # Analyze speicifc pages or all pages
        all_signals = self.analyze_page_range(pdf, page_range=page_range)
        
        # Filter high-scoring pages
        candidate_pages = [
            signals for signals in all_signals
            if signals.overall_score >= min_score
        ]
        
        # Group consecutive high-scoring pages into ranges
        page_ranges = []
        if candidate_pages:
            current_range = [candidate_pages[0].page_num]
            
            for i in range(1, len(candidate_pages)):
                prev_page = candidate_pages[i-1].page_num
                curr_page = candidate_pages[i].page_num
                
                # If consecutive or close (within 1 page)
                if curr_page - prev_page <= 2:
                    if curr_page not in current_range:
                        current_range.append(curr_page)
                else:
                    # Start new range
                    page_ranges.append(current_range)
                    current_range = [curr_page]
            
            # Add last range
            if current_range:
                page_ranges.append(current_range)
        
        # Convert to result format
        # Note: Layout analysis alone can't distinguish statement types
        # This provides generic high-probability pages
        results = []
        for page_range in page_ranges:
            avg_score = sum(
                sig.overall_score for sig in all_signals
                if sig.page_num in page_range
            ) / len(page_range)
            
            results.append({
                'page_range': [min(page_range), max(page_range)],
                'confidence': round(avg_score, 2),
                'evidence': f"High layout score (numeric density, tables, headers)",
                'source': 'layout_analysis',
                'signals': {
                    'avg_numeric_density': round(sum(
                        sig.numeric_density for sig in all_signals
                        if sig.page_num in page_range
                    ) / len(page_range), 2),
                    'table_count': sum(
                        sig.table_count for sig in all_signals
                        if sig.page_num in page_range
                    )
                }
            })
        
        return {'generic_candidates': results}
