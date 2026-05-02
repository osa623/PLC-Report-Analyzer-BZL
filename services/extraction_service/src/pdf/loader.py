"""PDF Loader module for reading and parsing PDF files."""

import PyPDF2
import pdfplumber
from pathlib import Path
from typing import List, Dict, Any, Optional
from src.utils.logger import get_logger

logger = get_logger(__name__)


class PDFLoader:
    """Load and parse PDF files."""
    
    def __init__(self, pdf_path: str):
        """
        Initialize PDF loader.
        
        Args:
            pdf_path: Path to the PDF file
        """
        self.pdf_path = Path(pdf_path)
        if not self.pdf_path.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        self.pdf_info = None
        self.total_pages = 0
        logger.info(f"Initialized PDF loader for: {self.pdf_path.name}")
    
    def get_pdf_info(self) -> Dict[str, Any]:
        """
        Get PDF metadata information.
        
        Returns:
            Dictionary containing PDF metadata
        """
        try:
            with open(self.pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                self.total_pages = len(pdf_reader.pages)
                
                metadata = pdf_reader.metadata or {}
                
                self.pdf_info = {
                    'file_name': self.pdf_path.name,
                    'file_path': str(self.pdf_path),
                    'total_pages': self.total_pages,
                    'title': metadata.get('/Title', 'N/A'),
                    'author': metadata.get('/Author', 'N/A'),
                    'subject': metadata.get('/Subject', 'N/A'),
                    'creator': metadata.get('/Creator', 'N/A'),
                    'producer': metadata.get('/Producer', 'N/A'),
                    'creation_date': metadata.get('/CreationDate', 'N/A')
                }
                
                logger.info(f"PDF Info: {self.total_pages} pages")
                return self.pdf_info
                
        except Exception as e:
            logger.error(f"Error getting PDF info: {str(e)}")
            raise
    
    def extract_text_pypdf2(self, page_num: Optional[int] = None) -> str:
        """
        Extract text from PDF using PyPDF2.
        
        Args:
            page_num: Specific page number (0-indexed), None for all pages
        
        Returns:
            Extracted text
        """
        try:
            with open(self.pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                if page_num is not None:
                    # Extract single page
                    if 0 <= page_num < len(pdf_reader.pages):
                        page = pdf_reader.pages[page_num]
                        return page.extract_text()
                    else:
                        logger.warning(f"Invalid page number: {page_num}")
                        return ""
                else:
                    # Extract all pages
                    text = ""
                    for page in pdf_reader.pages:
                        text += page.extract_text() + "\n"
                    return text
                    
        except Exception as e:
            logger.error(f"Error extracting text with PyPDF2: {str(e)}")
            return ""
    
    def extract_text_pdfplumber(self, page_num: Optional[int] = None) -> str:
        """
        Extract text from PDF using pdfplumber (more accurate).
        
        Args:
            page_num: Specific page number (0-indexed), None for all pages
        
        Returns:
            Extracted text
        """
        try:
            with pdfplumber.open(self.pdf_path) as pdf:
                if page_num is not None:
                    # Extract single page
                    if 0 <= page_num < len(pdf.pages):
                        page = pdf.pages[page_num]
                        return page.extract_text() or ""
                    else:
                        logger.warning(f"Invalid page number: {page_num}")
                        return ""
                else:
                    # Extract all pages
                    text = ""
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                    return text
                    
        except Exception as e:
            logger.error(f"Error extracting text with pdfplumber: {str(e)}")
            return ""
    
    def extract_text(self, page_num: Optional[int] = None, method: str = "pdfplumber") -> str:
        """
        Extract text from PDF using specified method.
        
        Args:
            page_num: Specific page number (0-indexed), None for all pages
            method: Extraction method ("pdfplumber" or "pypdf2")
        
        Returns:
            Extracted text
        """
        if method == "pdfplumber":
            return self.extract_text_pdfplumber(page_num)
        elif method == "pypdf2":
            return self.extract_text_pypdf2(page_num)
        else:
            logger.warning(f"Unknown method: {method}, using pdfplumber")
            return self.extract_text_pdfplumber(page_num)
    
    def extract_pages_text(self, start_page: int = 0, end_page: Optional[int] = None) -> Dict[int, str]:
        """
        Extract text from a range of pages.
        
        Args:
            start_page: Starting page number (0-indexed)
            end_page: Ending page number (0-indexed), None for last page
        
        Returns:
            Dictionary mapping page numbers to text
        """
        try:
            with pdfplumber.open(self.pdf_path) as pdf:
                if end_page is None:
                    end_page = len(pdf.pages) - 1
                
                pages_text = {}
                for i in range(start_page, min(end_page + 1, len(pdf.pages))):
                    page = pdf.pages[i]
                    text = page.extract_text()
                    if text:
                        pages_text[i] = text
                
                logger.info(f"Extracted text from {len(pages_text)} pages")
                return pages_text
                
        except Exception as e:
            logger.error(f"Error extracting pages text: {str(e)}")
            return {}
    
    def get_page_images(self, page_num: int, dpi: int = 300) -> List[Any]:
        """
        Extract images from a specific page.
        
        Args:
            page_num: Page number (0-indexed)
            dpi: Resolution for image extraction
        
        Returns:
            List of images
        """
        try:
            with pdfplumber.open(self.pdf_path) as pdf:
                if 0 <= page_num < len(pdf.pages):
                    page = pdf.pages[page_num]
                    return page.images or []
                else:
                    logger.warning(f"Invalid page number: {page_num}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error extracting images: {str(e)}")
            return []
    
    def search_text(self, search_term: str, case_sensitive: bool = False) -> List[Dict[str, Any]]:
        """
        Search for text across all pages.
        
        Args:
            search_term: Text to search for
            case_sensitive: Whether to perform case-sensitive search
        
        Returns:
            List of dictionaries with page numbers and matching text
        """
        results = []
        
        try:
            with pdfplumber.open(self.pdf_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    text = page.extract_text()
                    if text:
                        if not case_sensitive:
                            text = text.lower()
                            search_term_cmp = search_term.lower()
                        else:
                            search_term_cmp = search_term
                        
                        if search_term_cmp in text:
                            results.append({
                                'page': i,
                                'page_number': i + 1,  # 1-indexed for display
                                'text': text
                            })
            
            logger.info(f"Found '{search_term}' in {len(results)} pages")
            return results
            
        except Exception as e:
            logger.error(f"Error searching text: {str(e)}")
            return []
