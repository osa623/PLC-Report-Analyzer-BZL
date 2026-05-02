"""Page locator module to find relevant sections in PDFs."""

import re
from typing import Dict, List, Optional, Tuple
from src.pdf.loader import PDFLoader
from src.utils.logger import get_logger
from config import keywords

logger = get_logger(__name__)


class PageLocator:
    """Locate specific sections in PDF documents."""
    
    def __init__(self, pdf_loader: PDFLoader):
        """
        Initialize page locator.
        
        Args:
            pdf_loader: PDFLoader instance
        """
        self.pdf_loader = pdf_loader
        self.section_pages = {}
        logger.info("Initialized Page Locator")
    
    def find_section_pages(
        self, 
        section_keywords: List[str], 
        section_name: str
    ) -> List[int]:
        """
        Find pages containing a specific section.
        
        Args:
            section_keywords: List of keywords to search for
            section_name: Name of the section (for logging)
        
        Returns:
            List of page numbers (0-indexed)
        """
        matching_pages = []
        
        try:
            # Search for each keyword
            for keyword in section_keywords:
                results = self.pdf_loader.search_text(keyword, case_sensitive=False)
                for result in results:
                    page_num = result['page']
                    if page_num not in matching_pages:
                        matching_pages.append(page_num)
                        logger.info(
                            f"Found '{keyword}' for {section_name} on page {page_num + 1}"
                        )
            
            matching_pages.sort()
            return matching_pages
            
        except Exception as e:
            logger.error(f"Error finding section pages: {str(e)}")
            return []
    
    def locate_financial_statements(self) -> Dict[str, List[int]]:
        """
        Locate all major financial statement sections.
        
        Returns:
            Dictionary mapping section names to page numbers
        """
        try:
            sections = {}
            
            # Locate Income Statement
            income_pages = self.find_section_pages(
                keywords.INCOME_STATEMENT_KEYWORDS,
                "Income Statement"
            )
            if income_pages:
                sections['income_statement'] = income_pages
            
            # Locate Balance Sheet
            balance_pages = self.find_section_pages(
                keywords.FINANCIAL_POSITION_KEYWORDS,
                "Financial Position Statement"
            )
            if balance_pages:
                sections['balance_sheet'] = balance_pages
            
            # Locate Cash Flow Statement
            cashflow_pages = self.find_section_pages(
                keywords.CASH_FLOW_KEYWORDS,
                "Cash Flow Statement"
            )
            if cashflow_pages:
                sections['cash_flow'] = cashflow_pages
            
            # Locate Notes
            notes_pages = self.find_section_pages(
                keywords.NOTES_KEYWORDS,
                "Notes"
            )
            if notes_pages:
                sections['notes'] = notes_pages[:5]  # Limit to first few note pages
            
            # FALLBACK: If no sections found, try to extract from all pages
            if not sections:
                logger.warning("No sections found with keywords, using fallback: processing all pages")
                # Use first half of document for financial statements
                total_pages = self.pdf_loader.total_pages
                # Assume statements are in first 30% to 70% of document
                start_page = max(0, int(total_pages * 0.1))
                end_page = min(total_pages - 1, int(total_pages * 0.7))
                
                # Split pages among statements
                pages_per_section = (end_page - start_page) // 3
                
                sections['income_statement'] = list(range(start_page, start_page + pages_per_section))
                sections['balance_sheet'] = list(range(start_page + pages_per_section, start_page + 2*pages_per_section))
                sections['cash_flow'] = list(range(start_page + 2*pages_per_section, end_page + 1))
                
                logger.info(f"Using fallback: assigned pages to sections")
            
            self.section_pages = sections
            logger.info(f"Located {len(sections)} financial statement sections")
            
            return sections
            
        except Exception as e:
            logger.error(f"Error locating financial statements: {str(e)}")
            return {}
    
    def get_section_text(self, section_name: str) -> str:
        """
        Get text from a specific section.
        
        Args:
            section_name: Name of the section
        
        Returns:
            Combined text from all pages in the section
        """
        if section_name not in self.section_pages:
            logger.warning(f"Section '{section_name}' not found")
            return ""
        
        try:
            page_numbers = self.section_pages[section_name]
            text = ""
            
            for page_num in page_numbers:
                page_text = self.pdf_loader.extract_text_pdfplumber(page_num)
                if page_text:
                    text += f"\n--- Page {page_num + 1} ---\n{page_text}"
            
            return text
            
        except Exception as e:
            logger.error(f"Error getting section text: {str(e)}")
            return ""
    
    def extract_period_from_text(self, text: str) -> Optional[Dict[str, str]]:
        """
        Extract financial period information from text.
        
        Args:
            text: Text to search
        
        Returns:
            Dictionary with period information
        """
        try:
            # Patterns for different date formats
            patterns = [
                r'for the year ended\s+(\d{1,2})[/-](\d{1,2})[/-](\d{4})',
                r'for the year ended\s+(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})',
                r'as at\s+(\d{1,2})[/-](\d{1,2})[/-](\d{4})',
                r'as at\s+(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})',
                r'year ended\s+(\d{4})',
                r'(december|march|june|september)\s+(\d{4})'
            ]
            
            text_lower = text.lower()
            
            for pattern in patterns:
                match = re.search(pattern, text_lower, re.IGNORECASE)
                if match:
                    period_info = {
                        'raw_text': match.group(0),
                        'groups': match.groups()
                    }
                    logger.info(f"Found period: {period_info['raw_text']}")
                    return period_info
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting period: {str(e)}")
            return None
    
    def extract_currency_info(self, text: str) -> Optional[Dict[str, str]]:
        """
        Extract currency and unit information from text.
        
        Args:
            text: Text to search
        
        Returns:
            Dictionary with currency and unit information
        """
        try:
            currency = None
            unit = None
            
            text_lower = text.lower()
            
            # Detect currency
            if any(c in text_lower for c in ['rs', 'lkr', 'rupees', 'sri lankan rupees']):
                currency = 'LKR'
            elif 'usd' in text_lower or 'us$' in text_lower:
                currency = 'USD'
            
            # Detect unit
            if "'000" in text or "000" in text_lower or "thousands" in text_lower:
                unit = 'thousands'
            elif "million" in text_lower:
                unit = 'millions'
            elif "billion" in text_lower:
                unit = 'billions'
            
            if currency or unit:
                info = {
                    'currency': currency,
                    'unit': unit
                }
                logger.info(f"Found currency info: {info}")
                return info
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting currency info: {str(e)}")
            return None
    
    def get_section_range(self, section_name: str) -> Optional[Tuple[int, int]]:
        """
        Get the page range for a section.
        
        Args:
            section_name: Name of the section
        
        Returns:
            Tuple of (start_page, end_page) or None
        """
        if section_name not in self.section_pages:
            return None
        
        pages = self.section_pages[section_name]
        if not pages:
            return None
        
        return (pages[0], pages[-1])
    
    def get_context_pages(
        self, 
        section_name: str, 
        before: int = 1, 
        after: int = 1
    ) -> List[int]:
        """
        Get pages including context before and after a section.
        
        Args:
            section_name: Name of the section
            before: Number of pages to include before
            after: Number of pages to include after
        
        Returns:
            List of page numbers
        """
        if section_name not in self.section_pages:
            return []
        
        pages = self.section_pages[section_name]
        if not pages:
            return []
        
        min_page = max(0, pages[0] - before)
        max_page = min(self.pdf_loader.total_pages - 1, pages[-1] + after)
        
        context_pages = list(range(min_page, max_page + 1))
        return context_pages
