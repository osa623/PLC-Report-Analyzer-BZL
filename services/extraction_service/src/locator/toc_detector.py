"""
Simple TOC Detector - Find Contents page and extract statement page numbers
"""

import re
from typing import Dict, List
import pdfplumber


class TOCDetector:
    """Dead simple TOC detector."""
    
    def __init__(self):
        """Initialize detector."""
        pass
    
    def get_statement_pages_from_toc(self, pdf) -> Dict[str, List[Dict]]:
        """
        Find Contents page, scan for statements, extract page numbers.
        
        Returns:
            {
                'Income_Statement': [{'page_range': [225, 226], 'confidence': 0.98, ...}],
                'Financial Position Statement': [...],
                'Cash Flow Statement': [...]
            }
        """
        results = {
            'Income_Statement': [],
            'Financial Position Statement': [],
            'Cash Flow Statement': []
        }
        
        # Step 1: Find Contents page (first 20 pages)
        contents_text = ""
        for page_num in range(min(20, len(pdf.pages))):
            try:
                text = pdf.pages[page_num].extract_text() or ""
                if 'content' in text.lower()[:500]:
                    contents_text += text + "\n"
            except:
                continue
        
        if not contents_text:
            return results  # No contents found
        
        # Step 2: Find each statement and its page number
        # Look for patterns like: "295 Income Statement" or "Income Statement 295" or multi-line
        
        # Join text and remove extra whitespace/newlines to handle multi-line entries
        full_text = ' '.join(contents_text.split())
        
        # Pattern 1: Income Statement
        income_patterns = [
            r'(\d{3})\s+Income\s+Statement',  # "295 Income Statement"
            r'Income\s+Statement\s+(\d{3})',  # "Income Statement 295"
            r'(\d{3})\s+Statement\s+of\s+Profit',  # "225 Statement of Profit"
            r'Statement\s+of\s+Profit\s+(?:or\s+Loss|and\s+Loss).*?(\d{3})',  # "Statement of Profit or Loss 225"
            r'(\d{3})\s+Statement\s+of\s+Comprehensive\s+Income',  # "225 Statement of Comprehensive Income"
            r'Statement\s+of\s+Comprehensive\s+Income\s+(\d{3})',  # "Statement of Comprehensive Income 225"
        ]
        
        for pattern in income_patterns:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                page_num = int(match.group(1))
                if 150 <= page_num <= 500:  # Reasonable range
                    # Find actual PDF page by checking content
                    pdf_page = self._find_actual_page(pdf, page_num, ['income statement', 'profit or loss'])
                    if pdf_page is not None:
                        results['Income_Statement'].append({
                            'page_range': [pdf_page, pdf_page + 1],
                            'confidence': 0.98,
                            'evidence': f"From Contents: Income Statement at page {page_num}",
                            'source': 'toc'
                        })
                        break
        
        # Pattern 2: Financial Position
        position_patterns = [
            r'(\d{3})\s+Statement\s+of\s+Financial\s+Position',
            r'Statement\s+of\s+Financial\s+Position\s+(\d{3})',
            r'(\d{3})\s+Financial\s+Position',
        ]
        
        # DEBUG: Check if text contains the phrase
        if 'financial position' in full_text.lower():
            # Try to find it with context
            idx = full_text.lower().find('financial position')
            context = full_text[max(0, idx-50):idx+50]
            # Extract number before it
            nums_before = re.findall(r'(\d{3})', context[:50])
            if nums_before:
                page_num = int(nums_before[-1])
                if 150 <= page_num <= 500:
                    pdf_page = self._find_actual_page(pdf, page_num, ['financial position','statement of financial position'])
                    if pdf_page is not None:
                        results['Financial Position Statement'].append({
                            'page_range': [pdf_page, pdf_page + 1],
                            'confidence': 0.98,
                            'evidence': f"From Contents: Financial Position at page {page_num}",
                            'source': 'toc'
                        })
        
        if not results['Financial Position Statement']:
            # Try regex patterns
            for pattern in position_patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    page_num = int(match.group(1))
                    if 150 <= page_num <= 500:
                        pdf_page = self._find_actual_page(pdf, page_num, ['financial position'])
                        if pdf_page is not None:
                            results['Financial Position Statement'].append({
                                'page_range': [pdf_page, pdf_page + 1],
                                'confidence': 0.98,
                                'evidence': f"From Contents: Financial Position at page {page_num}",
                                'source': 'toc'
                            })
                            break
        
        # Pattern 3: Cash Flow
        cashflow_patterns = [
            r'(\d{3})\s+Statement\s+of\s+Cash\s+Flow',
            r'Statement\s+of\s+Cash\s+Flow[s]?\s+(\d{3})',
            r'(\d{3})\s+Cash\s+Flow',
        ]
        
        # DEBUG: Check if text contains the phrase
        if 'cash flow' in full_text.lower():
            # Try to find it with context
            idx = full_text.lower().find('cash flow')
            context = full_text[max(0, idx-50):idx+50]
            # Extract number before it
            nums_before = re.findall(r'(\d{3})', context[:50])
            if nums_before:
                page_num = int(nums_before[-1])
                if 150 <= page_num <= 500:
                    pdf_page = self._find_actual_page(pdf, page_num, ['cash flow'])
                    if pdf_page is not None:
                        results['Cash Flow Statement'].append({
                            'page_range': [pdf_page, pdf_page + 1],
                            'confidence': 0.98,
                            'evidence': f"From Contents: Cash Flow at page {page_num}",
                            'source': 'toc'
                        })
        
        if not results['Cash Flow Statement']:
            # Try regex patterns
            for pattern in cashflow_patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    page_num = int(match.group(1))
                    if 150 <= page_num <= 500:
                        pdf_page = self._find_actual_page(pdf, page_num, ['cash flow'])
                        if pdf_page is not None:
                            results['Cash Flow Statement'].append({
                                'page_range': [pdf_page, pdf_page + 1],
                                'confidence': 0.98,
                                'evidence': f"From Contents: Cash Flow at page {page_num}",
                                'source': 'toc'
                            })
                            break
        
        return results
    
    def get_investor_relations_page_from_toc(self, pdf) -> List[Dict]:
        """
        Find pages where INVESTOR RELATIONS appears as main title.
        Skip TOC - only scan page content directly.
        
        Returns:
            [{'page_num': 45, 'confidence': 0.98, 'evidence': '...', 'source': 'content_scan'}]
        """
        # Directly scan all pages for "INVESTOR RELATIONS" as main title
        results = self._scan_for_investor_relations_pages(pdf)
        return results
    
    def _scan_for_investor_relations_pages(self, pdf) -> List[Dict]: 
        """
        Find INVESTOR RELATIONS section, then find all shareholder-related pages.
        Returns multiple pages (range of 8 pages from title) to capture context.
        """
        results = []
        investor_relations_page_idx = -1
        
        # Shareholder Table Indicators (High Confidence)
        shareholder_indicators = [
            'TOP 20 MAJOR SHAREHOLDERS',
            'TOP 20 SHAREHOLDERS',
            'TWENTY MAJOR SHAREHOLDERS',
            'MAJOR SHAREHOLDERS',
            'TOP TWENTY SHAREHOLDERS',
            'TOP 20 LARGEST SHAREHOLDERS',
            'TWENTY LARGEST SHAREHOLDERS',
            'SHAREHOLDING STRUCTURE',
            'SHAREHOLDER COMPOSITION',
            'DISTRIBUTION OF SHAREHOLDING',
            'TOP 20 MAJOR INVESTOR',
            'TOP 10 MAJOR SHAREHOLDERS',
            'TWENTY LARGEST SHAREHOLDERS',
        ]
        
        # Step 1: Scan ALL pages for Investor Relations Title AND Shareholder Tables directly
        
        for page_idx in range(len(pdf.pages)):
            try:
                page = pdf.pages[page_idx]
                text = page.extract_text() or ""
                text_upper = text.upper()
                
                # Check for TOC indicators - Ignore this page if it looks like a TOC
                # Heuristic: "Contents" or "Index" at top, and many lines ending in numbers
                first_lines = text_upper[:500]
                if ('CONTENTS' in first_lines or 'INDEX' in first_lines) and \
                   len(re.findall(r'\.\.+\s*\d+', text)) > 5:
                    continue  # Skip TOC page
                
                # Check for "INVESTOR RELATIONS" as a Main Title
                # Heuristic: It should be in the top part of the page, or be a standalone line
                if investor_relations_page_idx == -1 and 'INVESTOR RELATIONS' in text_upper:
                    # check if it's a title (short line)
                    lines = text_upper.split('\n')
                    for line in lines[:15]: # Check first 15 lines
                        if 'INVESTOR RELATIONS' in line and len(line) < 60:
                            investor_relations_page_idx = page_idx
                            break
                
                # Check for Shareholder Table Captions DIRECTLY
                for indicator in shareholder_indicators:
                    if indicator in text_upper:
                        results.append({
                            'page_num': page_idx + 1,
                            'confidence': 0.99, # High confidence for specific table caption
                            'evidence': f"Found '{indicator}' caption",
                            'source': 'direct_caption_scan',
                            'type': 'shareholders_page'
                        })
                        break  # Found a table on this page
                
            except Exception as e:
                continue
        
        # Step 2: If we found "Investor Relations" section title, include that page range
        # User requested first ~5-8 pages from the section start
        if investor_relations_page_idx != -1:
            # Add range of 8 pages (or until end of PDF)
            range_end = min(investor_relations_page_idx + 8, len(pdf.pages))
            for i in range(investor_relations_page_idx, range_end):
                results.append({
                    'page_num': i + 1,
                    'confidence': 0.85, # Good confidence since it's in the section
                    'evidence': "Within INVESTOR RELATIONS section range",
                    'source': 'section_range_scan',
                    'type': 'investor_relations_section'
                })

        # Deduplicate results based on page_num
        unique_results = []
        seen_pages = set()
        # Sort results by page_num to keep order
        results.sort(key=lambda x: x['page_num'])
        
        for res in results:
            if res['page_num'] not in seen_pages:
                unique_results.append(res)
                seen_pages.add(res['page_num'])
        
        return unique_results
    
    def _find_actual_page(self, pdf, reported_page: int, keywords: List[str]) -> int:
        """
        Find the actual PDF page index from a reported page number.
        Looks for pages with keywords AND data indicators (years, currency).
        
        Args:
            pdf: PDF object
            reported_page: Page number from TOC
            keywords: Keywords to look for (e.g., ['income statement'])
        
        Returns:
            PDF page index (0-based) or None
        """
        # Try offsets to find the actual data page, not just title pages
        # Check larger offsets first since many PDFs have title pages before data
        for offset in [1, 2, 3, 4, 0, -1, 5, 6, 7, -2]:
            pdf_page_idx = reported_page + offset - 1  # Convert to 0-based index
            
            if 0 <= pdf_page_idx < len(pdf.pages):
                try:
                    page = pdf.pages[pdf_page_idx]
                    text = (page.extract_text() or "").lower()
                    
                    # Check if keywords appear
                    has_keywords = any(keyword in text for keyword in keywords)
                    
                    if has_keywords:
                        # MUST have data indicators to qualify
                        # This prevents matching title pages
                        has_both_years = "2024" in text and "2023" in text
                        has_currency = "rs '000" in text or "rs. '000" in text or "rs '0" in text
                        
                        # Statement-specific data indicators
                        statement_indicators = {
                            'income': any([
                                "gross income" in text,
                                "interest income" in text,
                                "net interest" in text
                            ]),
                            'position': any([
                                "assets" in text and "liabilities" in text,
                                "cash and cash" in text,
                                "deposits" in text and "customers" in text
                            ]),
                            'balance': any([
                                "assets" in text and "liabilities" in text,
                                "cash and cash" in text
                            ]),
                            'cash': any([
                                "cash flows from operating" in text,
                                "operating activities" in text,
                                "financing activities" in text
                            ])
                        }
                        
                        # Check for statement-specific indicators
                        # Match keywords containing indicator keys (e.g., 'financial position' contains 'position')
                        has_statement_data = False
                        for keyword in keywords:
                            for indicator_key, indicator_check in statement_indicators.items():
                                if indicator_key in keyword:
                                    has_statement_data = indicator_check
                                    break
                            if has_statement_data:
                                break
                        
                        # Need both years AND (currency OR statement-specific data)
                        if has_both_years and (has_currency or has_statement_data):
                            return pdf_page_idx
                except:
                    continue
        
        # If no page with data found, return None (don't guess)
        return None
