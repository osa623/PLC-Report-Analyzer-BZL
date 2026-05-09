"""
Table Detector
Detects and extracts table structures from PDF pages.
Includes OCR fallback for image-based PDFs.
"""

import pdfplumber
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class TableDetector:
    """Detect and extract tables from PDF pages with OCR fallback."""
    
    def __init__(self, use_ocr_fallback: bool = True):
        """Initialize table detector.
        
        Args:
            use_ocr_fallback: Whether to use OCR when normal extraction fails
        """
        self.use_ocr_fallback = use_ocr_fallback
        
        # Try text-based strategy first (better for multi-column layouts)
        self.table_settings_text = {
            "vertical_strategy": "text",
            "horizontal_strategy": "text",
            "intersection_tolerance": 3
        }
        
        # Fallback to lines strategy
        self.table_settings_lines = {
            "vertical_strategy": "lines",
            "horizontal_strategy": "lines",
            "intersection_tolerance": 5
        }
        
        # Check if OCR libraries are available
        self.ocr_available = self._check_ocr_availability()
        # Check if OCR libraries are available
        self.ocr_available = self._check_ocr_availability()
    
    def _check_ocr_availability(self) -> bool:
        """Check if OCR libraries (pytesseract, PIL) are available."""
        try:
            import pytesseract
            from PIL import Image
            import pdf2image
            
            # Try to load config
            try:
                from config.ocr_config import TESSERACT_PATH, POPPLER_PATH
                if TESSERACT_PATH:
                    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH
                    logger.info(f"Tesseract configured: {TESSERACT_PATH}")
            except ImportError:
                logger.info("OCR config not found, using system PATH")
            
            return True
        except ImportError as e:
            logger.warning(f"OCR libraries not available: {str(e)}")
            logger.warning("Install: pip install pytesseract pillow pdf2image")
            logger.warning("See OCR_SETUP.md for configuration")
            return False
    
    def detect_tables(self, pdf, page_range: List[int]) -> List[Dict[str, Any]]:
        """
        Extract tables from specified page range.
        
        Args:
            pdf: pdfplumber PDF object
            page_range: List of page numbers [start, end]
        
        Returns:
            List of table dictionaries with rows and metadata
        """
        tables = []
        
        for page_num in range(page_range[0], page_range[1] + 1):
            if page_num >= len(pdf.pages):
                continue
                
            page = pdf.pages[page_num]
            
            # Try with text strategy first (better for multi-column layouts)
            page_tables = page.extract_tables(self.table_settings_text)
            
            # If no good tables found, try lines-based extraction
            if not page_tables or all(len(t[0]) < 3 for t in page_tables if t):
                page_tables = page.extract_tables(self.table_settings_lines)
            
            # Process each table
            for idx, table in enumerate(page_tables):
                if table and len(table) > 2:  # At least header + 2 data rows
                    # Check if this is a real table (has multiple columns)
                    if len(table[0]) >= 2:
                        tables.append({
                            'page_num': page_num,
                            'table_idx': idx,
                            'rows': table,
                            'row_count': len(table),
                            'extraction_method': 'pdfplumber'
                        })
        
        # Check table quality - if text is badly split, try OCR
        if tables and self.use_ocr_fallback and self.ocr_available:
            quality_score = self._assess_table_quality(tables)
            if quality_score < 0.5:  # Poor quality threshold
                logger.info(f"   Tables found but quality low ({quality_score:.2f}), trying OCR...")
                ocr_tables = self._extract_with_ocr(pdf, page_range)
                if ocr_tables:
                    logger.info(f"   OCR extracted {len(ocr_tables)} table(s)")
                    # Replace poor quality tables with OCR tables
                    tables = ocr_tables
        
        # If no tables found and OCR is enabled, try OCR extraction
        if not tables and self.use_ocr_fallback and self.ocr_available:
            logger.info("   No tables found with pdfplumber, trying OCR...")
            ocr_tables = self._extract_with_ocr(pdf, page_range)
            if ocr_tables:
                logger.info(f"   OCR extracted {len(ocr_tables)} table(s)")
                tables.extend(ocr_tables)
        
        return tables
    
    def _assess_table_quality(self, tables: List[Dict[str, Any]]) -> float:
        """Assess quality of extracted tables.
        
        Returns score 0-1, where:
        - 1.0 = Perfect quality
        - <0.5 = Poor quality (split words, broken structure)
        
        Args:
            tables: List of table dictionaries
        
        Returns:
            Quality score between 0 and 1
        """
        if not tables:
            return 0.0
        
        total_issues = 0
        total_checks = 0
        
        for table in tables[:2]:  # Check first 2 tables
            rows = table.get('rows', [])
            
            # Check first 20 rows for issues
            for row in rows[:20]:
                if not row or len(row) < 3:
                    continue
                
                # Check first few columns for label/text content
                for i, cell in enumerate(row[:4]):
                    if cell and isinstance(cell, str):
                        cell = cell.strip()
                        if len(cell) > 1:
                            total_checks += 1
                            
                            # Check for split word patterns
                            # 1. Words that end mid-word without punctuation
                            if len(cell) > 3 and cell[-1].isalpha():
                                # Check if next cell starts with lowercase (continuation)
                                if i + 1 < len(row) and row[i+1]:
                                    next_cell = str(row[i+1]).strip()
                                    if next_cell and len(next_cell) > 0:
                                        if next_cell[0].islower() or next_cell in ['d', 'me', 'ed', 'e', 'r', 't']:
                                            total_issues += 1
                            
                            # 2. Common split patterns
                            split_patterns = [
                                'ende', 'inco', 'asse', 'liabi', 'equi',  # Common financial terms
                                'year ende', 'interest inco', 'net inco',
                                'Total asse', 'Total liabi'
                            ]
                            for pattern in split_patterns:
                                if pattern in cell.lower():
                                    total_issues += 1
                                    break
                            
                            # 3. Very short words in label positions (columns 1-3)
                            if i < 3 and 1 < len(cell) <= 3 and cell.isalpha():
                                # Single letters or short fragments
                                if cell.lower() in ['d', 'e', 'me', 'ed', 'r', 't', 'te', 'ty']:
                                    total_issues += 1
        
        if total_checks == 0:
            return 0.5  # Neutral score if can't assess
        
        # Score based on issue ratio
        issue_ratio = total_issues / total_checks
        quality_score = max(0, 1 - (issue_ratio * 2))  # Penalize issues more heavily
        
        return quality_score
    
    def _extract_with_ocr(self, pdf, page_range: List[int]) -> List[Dict[str, Any]]:
        """Extract tables using OCR as fallback.
        
        Args:
            pdf: pdfplumber PDF object
            page_range: List of page numbers [start, end]
        
        Returns:
            List of table dictionaries extracted via OCR
        """
        try:
            import pytesseract
            from PIL import Image
            from pdf2image import convert_from_path
            import re
            
            tables = []
            
            # Get PDF path from pdf object
            pdf_path = pdf.stream.name if hasattr(pdf.stream, 'name') else None
            if not pdf_path:
                logger.warning("Cannot get PDF path for OCR")
                return []
            
            # Convert specific pages to images
            first_page = page_range[0] + 1  # pdf2image uses 1-based indexing
            last_page = page_range[1] + 1
            
            # Load poppler path from config if available
            poppler_path = None
            try:
                from config.ocr_config import POPPLER_PATH
                poppler_path = POPPLER_PATH
            except ImportError:
                pass
            
            images = convert_from_path(
                pdf_path,
                first_page=first_page,
                last_page=last_page,
                dpi=300,  # High DPI for better OCR accuracy
                poppler_path=poppler_path
            )
            
            for idx, image in enumerate(images):
                page_num = page_range[0] + idx
                
                # Perform OCR
                ocr_text = pytesseract.image_to_string(image, config='--psm 6')
                
                # Parse OCR text into table structure
                table_rows = self._parse_ocr_to_table(ocr_text)
                
                if table_rows and len(table_rows) > 2:
                    tables.append({
                        'page_num': page_num,
                        'table_idx': 0,
                        'rows': table_rows,
                        'row_count': len(table_rows),
                        'extraction_method': 'ocr'
                    })
            
            return tables
            
        except Exception as e:
            logger.error(f"OCR extraction failed: {str(e)}")
            return []
    
    def _parse_ocr_to_table(self, ocr_text: str) -> List[List[str]]:
        """Parse OCR text into table structure.
        
        Args:
            ocr_text: Raw text from OCR
        
        Returns:
            List of rows, each row is a list of cell values
        """
        import re
        
        lines = ocr_text.split('\n')
        table_rows = []
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            
            # Try method 1: Split by 2+ spaces (preserves columns)
            cells = re.split(r'\s{2,}', line)
            cells = [c.strip() for c in cells if c.strip()]
            
            # If only 1 cell, try method 2: Look for financial numbers and split around them
            if len(cells) == 1 and re.search(r'[\d,]+', line):
                # Find all numbers (potentially column data)
                # Pattern: number with commas
                numbers = re.findall(r'[\d,]+', line)
                if len(numbers) >= 2:  # Multiple numbers = likely table row
                    # Extract label (text before first number)
                    first_num_pos = line.find(numbers[0])
                    label = line[:first_num_pos].strip()
                    
                    # Create row: label + all numbers
                    cells = [label] + numbers if label else numbers
            
            # Also handle note numbers like "10 284"
            cells = [c for c in cells if c.strip()]
            
            # Include rows that have financial data structure
            if len(cells) >= 3:  # Need at least label + 2 values
                has_numbers = any(re.search(r'[\d,]+', cell) for cell in cells)
                has_keywords = any(
                    keyword in line.lower() 
                    for keyword in ['income', 'expense', 'asset', 'liabilit', 
                                    'cash', 'bank', 'group', 'note', 'total',
                                    'year ended', 'december', 'lkr', 'page']
                )
                
                if has_numbers or has_keywords:
                    table_rows.append(cells)
        
        return table_rows
