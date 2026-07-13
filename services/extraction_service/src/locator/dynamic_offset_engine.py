import re
import logging
from typing import Optional, List, Dict, Tuple
import pdfplumber

logger = logging.getLogger(__name__)

class DynamicPageOffsetResolutionEngine:
    """
    Dynamic Page Offset Resolution Engine (Critical System Component).
    Resolves mismatches between Table of Contents page numbers,
    printed document page numbers, and PDF page indexes.
    
    Formula:
        Offset = PDF Page - Printed Page
        Correct PDF Page = TOC Page + Offset
    """
    
    def __init__(self, pdf_path: Optional[str] = None):
        self.pdf_path = pdf_path
        self._cached_baseline_offset = None
        self._cached_printed_pages = {}
        
    def detect_printed_page_number(self, pdf, pdf_page_num: int) -> Optional[int]:
        """
        Identify and extract the printed page number from a given PDF page (1-based index).
        Checks headers (top lines) and footers (bottom lines) for page number patterns.
        """
        if pdf_page_num < 1 or pdf_page_num > len(pdf.pages):
            return None
            
        # Check cache
        if pdf_page_num in self._cached_printed_pages:
            return self._cached_printed_pages[pdf_page_num]
            
        try:
            page = pdf.pages[pdf_page_num - 1]
            text = page.extract_text() or ""
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            if not lines:
                return None
                
            # Scan top 3 lines (headers) and bottom 3 lines (footers)
            candidates = lines[:3] + lines[-3:] if len(lines) > 6 else lines
            
            found_numbers = []
            
            # Patterns for printed page numbers
            patterns = [
                r'^\s*(\d{1,4})\s*$',  # Standalone number: "256"
                r'(?:page|pg\.?)\s*(\d{1,4})',  # Page keyword prefix: "page 256" or "pg. 256"
                r'^\s*(\d{1,4})\s*(?:[|•]|-)\s*',  # Pipe/dash prefix: "256 | Annual Report" or "256 - Annual Report"
                r'\s*(?:[|•]|-)\s*(\d{1,4})\s*$',  # Pipe/dash suffix: "Annual Report | 256" or "Annual Report - 256"
                r'^\s*(\d{1,4})\b',  # Word start: "256 Annual Report"
                r'\b(\d{1,4})\s*$',  # Word end: "Annual Report 256"
            ]
            
            for line in candidates:
                line_lower = line.lower()
                for pattern in patterns:
                    matches = re.findall(pattern, line_lower)
                    for m in matches:
                        try:
                            num = int(m)
                            # Printed page should be reasonably close to the PDF page index
                            if abs(pdf_page_num - num) < 100:
                                found_numbers.append((num, 1)) # High priority
                        except ValueError:
                            continue
                            
            # Fallback 1: check any word-boundary number in the first/last lines
            if not found_numbers:
                for line in candidates:
                    for m in re.findall(r'\b(\d{1,4})\b', line):
                        try:
                            num = int(m)
                            if abs(pdf_page_num - num) < 100:
                                found_numbers.append((num, 2)) # Medium priority
                        except ValueError:
                            continue
                            
            # Fallback 2: scan the entire page text for numbers close to the pdf_page_num
            if not found_numbers:
                for m in re.findall(r'\b(\d{1,4})\b', text):
                    try:
                        num = int(m)
                        if abs(pdf_page_num - num) < 40: # Stricter limit for general page text
                            found_numbers.append((num, 3)) # Low priority
                    except ValueError:
                        continue
                        
            if found_numbers:
                # Sort by priority and then by closeness to pdf_page_num
                found_numbers.sort(key=lambda x: (x[1], abs(pdf_page_num - x[0])))
                res = found_numbers[0][0]
                self._cached_printed_pages[pdf_page_num] = res
                return res
                
        except Exception as e:
            logger.warning(f"Error extracting printed page from PDF page {pdf_page_num}: {e}")
            
        return None
        
    def calculate_baseline_offset(self, pdf) -> Optional[int]:
        """
        Calculate a baseline offset using the first detected TOC page.
        TOC Page index - Printed Page number of TOC Page.
        """
        if self._cached_baseline_offset is not None:
            return self._cached_baseline_offset
            
        try:
            # Detect TOC pages (scan first 20 pages)
            toc_indices = []
            for i in range(min(20, len(pdf.pages))):
                text = pdf.pages[i].extract_text() or ""
                # Look for TOC markers
                if any(m in text.lower() for m in ["contents", "table of contents", "index"]):
                    toc_indices.append(i + 1)
                    
            if not toc_indices:
                return None
                
            first_toc_pdf_page = toc_indices[0]
            printed_page_num = self.detect_printed_page_number(pdf, first_toc_pdf_page)
            
            # If we can't extract the printed page number from TOC page directly, try fallback methods
            if printed_page_num is None:
                # Try to scan footer of first TOC page manually
                text = pdf.pages[first_toc_pdf_page - 1].extract_text() or ""
                lines = [l.strip() for l in text.split('\n') if l.strip()]
                for line in reversed(lines[-5:] + lines[:3]):
                    # Check standalone digit < 100
                    if re.fullmatch(r"[\(\[\-–—\s]*(\d{1,3})[\)\]\-–—\s]*", line):
                        val = int(re.search(r"\d+", line).group())
                        if val < 50:
                            printed_page_num = val
                            break
                            
            if printed_page_num is not None:
                self._cached_baseline_offset = first_toc_pdf_page - printed_page_num
                logger.info(f"Baseline offset calculated: {self._cached_baseline_offset} (TOC page {first_toc_pdf_page} maps to printed page {printed_page_num})")
                return self._cached_baseline_offset
                
        except Exception as e:
            logger.warning(f"Error calculating baseline offset: {e}")
            
        return None
        
    def resolve_page_offset(self, pdf, toc_page_num: int) -> int:
        """
        Calculate the page offset dynamically for a given TOC page number.
        Formula: Offset = PDF Page - Printed Page
        """
        total_pages = len(pdf.pages)
        baseline = self.calculate_baseline_offset(pdf)
        
        # Try finding offset by inspecting the page at the TOC page number, and its neighbors
        for candidate_pdf_page in [toc_page_num, toc_page_num - 1, toc_page_num + 1]:
            if 1 <= candidate_pdf_page <= total_pages:
                printed_val = self.detect_printed_page_number(pdf, candidate_pdf_page)
                if printed_val is not None:
                    offset = candidate_pdf_page - printed_val
                    logger.info(f"Dynamically resolved offset at TOC page {toc_page_num}: PDF Page {candidate_pdf_page} has Printed Page {printed_val}. Offset = {offset}")
                    return offset
                    
        # Fallback to baseline offset
        if baseline is not None:
            logger.info(f"TOC page {toc_page_num} dynamic lookup failed, fallback to baseline offset {baseline}")
            return baseline
            
        # Default fallback
        logger.warning(f"TOC page {toc_page_num} offset resolution failed completely. Defaulting to offset = 0")
        return 0
        
    def resolve_correct_pdf_page(self, pdf, toc_page_num: int, keywords: Optional[List[str]] = None) -> int:
        """
        Resolve the correct PDF page index (1-based) from a TOC page number.
        Apply the formula: Correct PDF Page = TOC Page + Offset
        Also validates that the resolved page exists and optionally checks for keywords.
        """
        offset = self.resolve_page_offset(pdf, toc_page_num)
        resolved_page = toc_page_num + offset
        
        # Clamp to valid range
        total_pages = len(pdf.pages)
        resolved_page = max(1, min(resolved_page, total_pages))
        
        # Validate page against keywords if provided
        if keywords:
            # Check resolved page and its immediate neighbors
            for page_idx in [resolved_page, resolved_page - 1, resolved_page + 1, resolved_page - 2, resolved_page + 2]:
                if 1 <= page_idx <= total_pages:
                    text = (pdf.pages[page_idx - 1].extract_text() or "").lower()
                    if any(keyword.lower() in text for keyword in keywords):
                        if page_idx != resolved_page:
                            logger.info(f"Adjusting resolved page from {resolved_page} to {page_idx} based on keyword matches")
                        return page_idx
                        
        return resolved_page
