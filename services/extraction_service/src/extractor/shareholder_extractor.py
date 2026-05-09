"""
Shareholder Extractor - Extract shareholder data and images from PDF pages
"""

import fitz  # PyMuPDF
import io
import base64
import re
from PIL import Image
import logging
from typing import List, Dict, Optional
import pdfplumber
import pandas as pd

# Try to import OCR libraries
try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except Exception:
    TESSERACT_AVAILABLE = False

# Try to import camelot, but don't fail if not available
try:
    import camelot
    CAMELOT_AVAILABLE = True
except Exception:
    CAMELOT_AVAILABLE = False

logger = logging.getLogger(__name__)


class ShareholderExtractor:
    """Extract shareholder information from PDF pages using OCR."""
    
    def __init__(self):
        """Initialize the extractor."""
        pass
    
    def extract_page_images(self, pdf_path: str, page_num: int, max_images: int = 8) -> List[Dict]:
        """
        Extract full page image from a PDF page.
        
        Args:
            pdf_path: Path to the PDF file
            page_num: Page number (1-indexed)
            max_images: Maximum number of images to extract (default 8)
        
        Returns:
            List of dicts with image_data (base64) and bbox - only full page images
        """
        images = []
        
        try:
            doc = fitz.open(pdf_path)
            page_idx = page_num - 1  # Convert to 0-indexed
            
            if page_idx < 0 or page_idx >= len(doc):
                logger.error(f"Page {page_num} out of range")
                return images
            
            page = doc[page_idx]
            
            # Extract ONLY full page as high-quality image
            pix = page.get_pixmap(matrix=fitz.Matrix(3, 3))  # 3x zoom for high quality
            img_data = pix.tobytes("png")
            img_base64 = base64.b64encode(img_data).decode('utf-8')
            
            images.append({
                'image_data': img_base64,
                'bbox': None,  # Full page
                'type': 'full_page',
                'width': pix.width,
                'height': pix.height,
                'page_num': page_num
            })
            
            doc.close()
            
            logger.info(f"Extracted full page image from page {page_num}")
            return images
            
        except Exception as e:
            logger.error(f"Error extracting images: {e}", exc_info=True)
            return images
    
    def _create_page_sections(self, pdf_path: str, page_num: int, num_sections: int) -> List[Dict]:
        """
        Divide page into sections and create images.
        
        Args:
            pdf_path: Path to PDF
            page_num: Page number (1-indexed)
            num_sections: Number of sections to create
        
        Returns:
            List of image dicts
        """
        sections = []
        
        try:
            doc = fitz.open(pdf_path)
            page_idx = page_num - 1
            page = doc[page_idx]
            
            page_rect = page.rect
            page_height = page_rect.height
            section_height = page_height / num_sections
            
            for i in range(num_sections):
                # Calculate section rectangle
                y0 = i * section_height
                y1 = (i + 1) * section_height
                clip_rect = fitz.Rect(page_rect.x0, y0, page_rect.x1, y1)
                
                # Render section
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clip_rect)
                img_data = pix.tobytes("png")
                img_base64 = base64.b64encode(img_data).decode('utf-8')
                
                sections.append({
                    'image_data': img_base64,
                    'bbox': [page_rect.x0, y0, page_rect.x1, y1],
                    'type': 'section',
                    'section_index': i,
                    'width': pix.width,
                    'height': pix.height
                })
            
            doc.close()
            return sections
            
        except Exception as e:
            logger.error(f"Error creating page sections: {e}")
            return sections
    
    def extract_table_from_page(self, pdf_path: str, page_num: int, bbox: Optional[List] = None) -> Dict:
        """
        Extract table data from a page using OCR on the page image.
        Returns data in format: {attribute: {year1: value1, year2: value2}}
        
        Args:
            pdf_path: Path to PDF
            page_num: Page number (1-indexed) 
            bbox: Optional bounding box [x0, y0, x1, y1]
        
        Returns:
            Dict with extracted table data in year-based format
        """
        try:
            logger.info(f"Extracting table from page {page_num} using OCR")
            
            # Try to extract with pdfplumber first (better for structured tables)
            df = self._extract_with_pdfplumber(pdf_path, page_num, bbox)
            
            if df is not None and not df.empty:
                logger.info(f"Successfully extracted table with pdfplumber")
                structured_data = self._parse_table_to_year_format(df)
                
                if structured_data:
                    return {
                        'success': True,
                        'attribute_count': len(structured_data),
                        'data': structured_data,
                        'page_num': page_num,
                        'raw_table': {
                            'method': 'pdfplumber',
                            'rows': len(df)
                        }
                    }
                
                # If year format parsing failed, try shareholder format parsing
                shareholder_data = self._parse_shareholder_table(df)
                if shareholder_data:
                    logger.info("Successfully extracted shareholder table with pdfplumber")
                    return {
                        'success': True,
                        'attribute_count': len(shareholder_data),
                        'data': shareholder_data,
                        'page_num': page_num,
                        'table_type': 'shareholder_list',
                        'raw_table': {
                            'method': 'pdfplumber_shareholder',
                            'rows': len(df)
                        }
                    }
            
            # Fallback to OCR if pdfplumber fails or returns no data
            logger.info("Falling back to OCR extraction")
            
            # Extract the page as image and run OCR
            ocr_text = self._extract_with_ocr(pdf_path, page_num, bbox)
            
            if not ocr_text or len(ocr_text.strip()) == 0:
                return {
                    'success': False,
                    'message': 'No text extracted from page',
                    'data': {}
                }
            
            # Parse OCR text into structured table format
            # First try year-based format (standard financial statements)
            structured_data = self._parse_ocr_text_to_year_format(ocr_text)
            
            if structured_data:
                return {
                    'success': True,
                    'attribute_count': len(structured_data),
                    'data': structured_data,
                    'page_num': page_num,
                    'raw_table': {
                        'text_length': len(ocr_text),
                        'lines': len(ocr_text.split('\n')),
                        'method': 'tesseract_ocr'
                    }
                }
            
            # If that fails, try shareholder text format
            shareholder_data = self._parse_ocr_shareholder_text(ocr_text)
            if shareholder_data:
                return {
                    'success': True,
                    'attribute_count': len(shareholder_data),
                    'data': shareholder_data,
                    'page_num': page_num,
                    'table_type': 'shareholder_list_ocr',
                    'raw_table': {
                        'text_length': len(ocr_text),
                        'lines': len(ocr_text.split('\n')),
                        'method': 'tesseract_ocr_shareholder'
                    }
                }
            
            # Return empty but successful if we extracted text but matched no pattern
            # This mimics behavior of year-parser returning empty result
            return {
                'success': True,
                'attribute_count': 0,
                'data': {},
                'page_num': page_num,
                'message': 'Text extracted but no structured table found'
            }
            
        except Exception as e:
            logger.error(f"Error extracting table: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'data': {}
            }
    
    def _extract_with_ocr(self, pdf_path: str, page_num: int, bbox: Optional[List] = None) -> str:
        """
        Extract text from page using Tesseract OCR.
        
        Returns:
            Extracted text string
        """
        try:
            if not TESSERACT_AVAILABLE:
                logger.error("Tesseract OCR is not available")
                return ""
            
            # Open PDF and get page as image
            doc = fitz.open(pdf_path)
            page_idx = page_num - 1
            
            if page_idx < 0 or page_idx >= len(doc):
                logger.error(f"Page {page_num} out of range")
                return ""
            
            page = doc[page_idx]
            
            # Render page at high resolution for better OCR
            matrix = fitz.Matrix(3, 3)  # 3x zoom
            
            if bbox:
                # Use bbox if provided [x0, y0, x1, y1]
                clip = fitz.Rect(bbox[0], bbox[1], bbox[2], bbox[3])
                pix = page.get_pixmap(matrix=matrix, clip=clip)
            else:
                pix = page.get_pixmap(matrix=matrix)
                
            img_data = pix.tobytes("png")
            
            # Convert to PIL Image
            img = Image.open(io.BytesIO(img_data))
            
            # Run OCR
            ocr_text = pytesseract.image_to_string(img, config='--psm 6')
            
            doc.close()
            
            logger.info(f"OCR extracted {len(ocr_text)} characters from page {page_num}")
            return ocr_text
            
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            return ""
    
    def _parse_ocr_text_to_year_format(self, text: str) -> Dict[str, Dict[str, str]]:
        """
        Parse OCR text into format: {attribute: {year1: value1, year2: value2}}
        
        Args:
            text: OCR extracted text
        
        Returns:
            Dict with attribute-year structure
        """
        result = {}
        
        try:
            lines = text.split('\n')
            
            # Find header line with years
            year_line_idx = -1
            years = []
            
            for idx, line in enumerate(lines):
                # Look for lines with multiple 4-digit years
                year_matches = re.findall(r'\b(19|20)\d{2}\b', line)
                if len(year_matches) >= 2:
                    year_line_idx = idx
                    years = year_matches
                    logger.info(f"Found year header at line {idx}: {years}")
                    break
            
            if year_line_idx == -1 or not years:
                logger.warning("Could not find year header in OCR text. Scanning for best header candidate.")
                
                # Scan first 10 lines for a line with multiple text parts
                best_header_idx = -1
                max_cols = 0
                
                for idx in range(min(10, len(lines))):
                    line = lines[idx].strip()
                    parts = re.split(r'\s{2,}|\t|\|', line)
                    parts = [p.strip() for p in parts if p.strip()]
                    
                    # Heuristic: headers usually have > 1 columns and are text
                    if len(parts) > 1 and not all(p.replace('.', '').isdigit() for p in parts):
                        if len(parts) > max_cols:
                            max_cols = len(parts)
                            best_header_idx = idx
                
                if best_header_idx != -1:
                    year_line_idx = best_header_idx
                    logger.info(f"Found generic header at line {year_line_idx}: {lines[year_line_idx]}")
                elif len(lines) > 0:
                    year_line_idx = 0
                    logger.warning("No good header found, defaulting to first line")
            
            # Process lines after year header
            for line_idx in range(year_line_idx + 1, len(lines)):
                line = lines[line_idx].strip()
                
                if not line or len(line) < 3:
                    continue
                
                # Split line by whitespace or common separators
                parts = re.split(r'\s{2,}|\t|\|', line)
                parts = [p.strip() for p in parts if p.strip()]
                
                if len(parts) < 2:
                    continue
                
                # First part is attribute name
                attribute_name = parts[0]
                
                # Skip if attribute looks like a number or year
                if re.match(r'^\d+$', attribute_name):
                    continue
                
                # Map remaining parts to years
                year_values = {}
                for i, year in enumerate(years):
                    value_idx = i + 1
                    if value_idx < len(parts):
                        value = parts[value_idx]
                        # Clean value
                        value = value.replace(',', '').strip()
                        if value and value != '-' and value != '':
                            value = value.replace(',', '').strip()
                        if value and value != '-' and value != '':
                            year_values[year] = parts[value_idx]  # Keep original format
                
                # If no years found, try to use headers as keys (if header row detected without years)
                if not years and year_line_idx >= 0:
                    # Get headers from the header line
                    header_line = lines[year_line_idx].strip()
                    headers = re.split(r'\s{2,}|\t|\|', header_line)
                    headers = [h.strip() for h in headers if h.strip()]
                    
                    # Skip first header if it matches attribute column
                    start_idx = 1 if len(headers) > 1 else 0
                    
                    for i in range(start_idx, len(headers)):
                        header_name = headers[i]
                        value_idx = i + 1 if start_idx == 1 else i
                        
                        if value_idx < len(parts):
                            value = parts[value_idx].strip()
                            value = value.replace(',', '').strip()
                        if value and value != '-' and value != '':
                            year_values[header_name] = value
                    
                    # If we have more parts than headers, add them as generic columns
                    if len(parts) > len(headers) + (1 if start_idx == 0 else 0):
                        extra_start = len(headers) + (0 if start_idx == 0 else 1)
                        for i in range(extra_start, len(parts)):
                            col_name = f"Column_{i+1}"
                            value = parts[i].strip()
                            if value:
                                year_values[col_name] = value
                
                if year_values:
                    result[attribute_name] = year_values
            
            logger.info(f"Parsed {len(result)} attributes from OCR text")
            return result
            
        except Exception as e:
            logger.error(f"Error parsing OCR text: {e}", exc_info=True)
            return result
    
    def _extract_with_pdfplumber(self, pdf_path: str, page_num: int, bbox: Optional[List] = None):
        """
        Extract table using pdfplumber (doesn't require Ghostscript).
        
        Returns:
            DataFrame or None if extraction fails
        """
        try:
            with pdfplumber.open(pdf_path) as pdf:
                if page_num < 1 or page_num > len(pdf.pages):
                    logger.error(f"Page {page_num} out of range")
                    return None
                
                page = pdf.pages[page_num - 1]  # Convert to 0-indexed
                
                # Apply cropping if bbox provided
                if bbox:
                    # pdfplumber expects [x0, top, x1, bottom]
                    # fitz/bbox usually [x0, y0, x1, y1] where y is from top
                    crop_box = (bbox[0], bbox[1], bbox[2], bbox[3])
                    try:
                        page = page.within_bbox(crop_box)
                    except Exception as e:
                        logger.warning(f"Could not crop page with bbox {bbox}: {e}")
                
                # Extract tables from the page
                tables = page.extract_tables()
                
                # If default extraction fails, try text-based extraction (good for borderless tables)
                if not tables:
                    logger.info("Default pdfplumber extraction failed, trying text-based strategy")
                    settings = {
                        "vertical_strategy": "text", 
                        "horizontal_strategy": "text",
                        "intersection_x_tolerance": 15
                    }
                    tables = page.extract_tables(table_settings=settings)
                
                if not tables or len(tables) == 0:
                    logger.warning("No tables found with pdfplumber")
                    return None
                
                # Use the first/largest table
                table_data = tables[0]
                
                # Convert to DataFrame
                df = pd.DataFrame(table_data)
                
                logger.info(f"Extracted table with {len(df)} rows using pdfplumber")
                return df
                
        except Exception as e:
            logger.error(f"pdfplumber extraction failed: {e}")
            return None
    
    def _extract_with_camelot(self, pdf_path: str, page_num: int):
        """
        Extract table using Camelot (requires Ghostscript).
        
        Returns:
            DataFrame or None if extraction fails
        """
        try:
            # Try lattice first for tables with borders
            tables = camelot.read_pdf(
                pdf_path,
                pages=str(page_num),
                flavor='lattice',
                strip_text='\\n'
            )
            
            if not tables:
                # Try stream flavor for borderless tables
                tables = camelot.read_pdf(
                    pdf_path,
                    pages=str(page_num),
                    flavor='stream',
                    strip_text='\\n'
                )
            
            if not tables or len(tables) == 0:
                logger.warning("No tables found with Camelot")
                return None
            
            df = tables[0].df
            logger.info(f"Extracted table with {len(df)} rows using Camelot")
            return df
            
        except Exception as e:
            logger.error(f"Camelot extraction failed: {e}")
            return None
    
    def _parse_table_to_year_format(self, df) -> Dict[str, Dict[str, str]]:
        """
        Parse DataFrame into format: {attribute: {year1: value1, year2: value2}}
        
        Args:
            df: Pandas DataFrame from Camelot
        
        Returns:
            Dict with attribute-year structure
        """
        result = {}
        
        try:
            if len(df) < 2:
                return result
            
            # Extract header row (assume first row contains years)
            header_row = df.iloc[0].tolist()
            
            # Clean and identify year columns
            year_columns = []
            for idx, col_val in enumerate(header_row):
                col_str = str(col_val).strip()
                # Try to find years (4-digit numbers or year patterns)
                if col_str and (col_str.isdigit() or re.search(r'\b(19|20)\d{2}\b', col_str)):
                    year_columns.append((idx, col_str))
            
            # If no year columns found, use column headers as-is
            if not year_columns:
                for idx in range(1, len(header_row)):
                    col_val = str(header_row[idx]).strip()
                    if col_val:
                        year_columns.append((idx, col_val))
            
            # Extract attribute rows
            for row_idx in range(1, len(df)):
                row = df.iloc[row_idx]
                
                # First column is typically the attribute name
                attribute_name = str(row.iloc[0]).strip()
                
                if not attribute_name or attribute_name == '' or attribute_name == 'nan':
                    continue
                
                # Extract values for each year
                year_values = {}
                for col_idx, year_label in year_columns:
                    if col_idx < len(row):
                        value = str(row.iloc[col_idx]).strip()
                        if value and value != 'nan':
                            year_values[year_label] = value
                
                # Only add if we have at least one value
                if year_values:
                    result[attribute_name] = year_values
            
            logger.info(f"Parsed {len(result)} attributes with year-based values")
            return result
            
        except Exception as e:
            logger.error(f"Error parsing table to year format: {e}", exc_info=True)
            return result

    def _parse_shareholder_table(self, df) -> Dict[str, Dict[str, str]]:
        """
        Parse DataFrame into shareholder format: {Name: {Shares: X, Percentage: Y}}
        """
        result = {}
        try:
            if len(df) < 2:
                return result

            # Clean dataframe: replace None with "" and strip strings
            df = df.applymap(lambda x: str(x).strip() if x is not None else "")
            
            # 1. Identify Header Row
            header_idx = -1
            name_col_idx = -1
            shares_col_idx = -1
            percent_col_idx = -1
            
            # keywords
            name_keywords = ['name', 'shareholder', 'institution', 'fund']
            shares_keywords = ['shares', 'no. of', 'holding', 'quantity', 'number']
            percent_keywords = ['%', 'percent', 'holding %', 'stake']
            
            # Scan first 5 rows for headers
            for idx in range(min(5, len(df))):
                row_values = [str(x).lower() for x in df.iloc[idx].tolist()]
                
                # Check for Name column
                for col_idx, val in enumerate(row_values):
                    if any(k in val for k in name_keywords):
                        name_col_idx = col_idx
                    if any(k in val for k in shares_keywords):
                        shares_col_idx = col_idx
                    if any(k in val for k in percent_keywords):
                        percent_col_idx = col_idx
                
                # If we found at least a name and (shares OR percent), treat as header
                if name_col_idx != -1 and (shares_col_idx != -1 or percent_col_idx != -1):
                    header_idx = idx
                    break
            
            # If no explicit header found, but we have 3+ columns, assume logic:
            # Col 0 = Name, Col 1 or 2 = Shares/Percent (heuristic)
            if header_idx == -1 and len(df.columns) >= 2:
                # Heuristic: Name is usually first text-heavy column
                # Shares/Percent are numeric columns
                header_idx = 0 # Assume first row might be data if no header
                name_col_idx = 0
                # Find likely numeric columns
                for col_idx in range(1, len(df.columns)):
                    # Check a few rows to see if they look numeric
                    is_numeric = True
                    sample_count = 0
                    for r in range(1, min(5, len(df))):
                        val = str(df.iloc[r, col_idx]).replace(',', '').replace('.', '').replace('%', '').strip()
                        if val:
                            sample_count += 1
                            if not val.isdigit():
                                is_numeric = False
                                break
                    
                    if is_numeric and sample_count > 0:
                        if shares_col_idx == -1:
                            shares_col_idx = col_idx
                        elif percent_col_idx == -1:
                            percent_col_idx = col_idx
            
            if name_col_idx == -1:
                return result # Cannot proceed without names
                
            # Iterate Data Rows
            start_row = header_idx + 1 if header_idx != -1 else 0
            
            for i in range(start_row, len(df)):
                row = df.iloc[i]
                
                # Extract Name
                if name_col_idx < len(row):
                    name = str(row[name_col_idx]).strip()
                else:
                    continue
                    
                # Skip numeric-only names (usually page numbers or index columns)
                if not name or name.replace('.', '').isdigit() or len(name) < 2:
                    continue
                    
                # Stop if we hit a "Total" row
                if 'total' in name.lower():
                    continue
                
                entry = {}
                
                # Extract Shares
                if shares_col_idx != -1 and shares_col_idx < len(row):
                    shares = str(row[shares_col_idx]).strip()
                    if shares:
                        entry['Shares'] = shares
                        
                # Extract Percentage
                if percent_col_idx != -1 and percent_col_idx < len(row):
                    percent = str(row[percent_col_idx]).strip()
                    if percent:
                        entry['Percentage'] = percent
                elif shares_col_idx != -1 and shares_col_idx + 1 < len(row): 
                     # Fallback: often percent is next to shares
                     possible_percent = str(row[shares_col_idx+1]).strip()
                     if '%' in possible_percent or (possible_percent.replace('.','').isdigit() and len(possible_percent) < 5):
                         entry['Percentage'] = possible_percent

                if entry:
                    result[name] = entry
                    
            logger.info(f"Parsed {len(result)} shareholders from table")
            return result
            
        except Exception as e:
            logger.error(f"Error parsing shareholder table: {e}")
            return result

    def _parse_ocr_shareholder_text(self, text: str) -> Dict[str, Dict[str, str]]:
        """
        Parse OCR text for shareholder patterns using regex.
        Typical line: "1. John Doe 1,000,000 10.5%"
        """
        result = {}
        try:
            lines = text.split('\n')
            
            # Regex to find lines ending with numbers/percentage
            # Matches: (Name text) (Space) (Number with commas/dots) (Space) (Optional Number/Percent)
            # Example: "Bank of Ceylon 12,400,300 12.34"
            pattern = r'^(?P<name>.*?)\s+(?P<shares>[\d,]+)\s+(?P<percent>[\d\.]+%?)$'
            
            for line in lines:
                line = line.strip()
                if not line or len(line) < 5:
                    continue
                    
                # Skip known headers
                if any(x in line.lower() for x in ['shareholder', 'name', 'shares', 'percentage', 'holding']):
                    continue
                
                match = re.search(pattern, line)
                if match:
                    name = match.group('name').strip()
                    # Remove leading numbering (e.g. "1. Name")
                    name = re.sub(r'^\d+[\.\)]\s*', '', name)
                    
                    if len(name) < 2 or 'total' in name.lower():
                        continue
                        
                    result[name] = {
                        'Shares': match.group('shares'),
                        'Percentage': match.group('percent')
                    }
                else:
                    # Looser pattern: Just Name and Shares
                    # "Bank of Ceylon 12,400,300"
                    pattern_simple = r'^(?P<name>.*?)\s+(?P<shares>[\d,]{3,})$'
                    match_simple = re.search(pattern_simple, line)
                    if match_simple:
                        name = match_simple.group('name').strip()
                        name = re.sub(r'^\d+[\.\)]\s*', '', name)
                        
                        shares = match_simple.group('shares')
                        
                        # Verify shares looks like a share count (has commas or is long)
                        if ',' in shares or len(shares) > 4:
                            if len(name) > 2 and 'total' not in name.lower():
                                result[name] = {'Shares': shares}

            logger.info(f"Parsed {len(result)} shareholders from OCR text")
            return result
            
        except Exception as e:
            logger.error(f"Error parsing shareholder text: {e}")
            return result
