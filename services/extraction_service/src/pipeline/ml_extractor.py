"""
Unified ML-Based Financial Statement Extractor
Extracts financial data from ANY annual report PDF using machine learning
"""

import logging
import pdfplumber
import camelot
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict
from sentence_transformers import SentenceTransformer
from rapidfuzz import fuzz
import re
import sys

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from config.target_schema_bank import TARGET_FIELDS, STATEMENT_FIELDS, MANDATORY_SECTIONS

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MLFinancialExtractor:
    """
    Machine Learning-based extractor that works with any annual report format.
    Uses NLP and fuzzy matching to intelligently extract financial statements.
    """
    
    def __init__(self):
        """Initialize the ML-based extractor."""
        logger.info("="*80)
        logger.info("🤖 INITIALIZING ML-BASED FINANCIAL EXTRACTOR")
        logger.info("="*80)
        
        # Load sentence transformer for semantic similarity
        try:
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("✅ Loaded NLP model for semantic matching")
        except Exception as e:
            logger.warning(f"⚠️ Could not load transformer model: {e}")
            self.model = None
        
        # Pre-compute embeddings for target fields
        self.field_embeddings = self._compute_field_embeddings()
        
        # Statement detection keywords
        self.statement_keywords = {
            "Income_Statement": [
                "income statement", "statement of comprehensive income",
                "statement of profit or loss", "profit and loss", 
                "income statement note"
            ],
            "Financial Position Statement": [
                "statement of financial position",
                "assets and liabilities", "financial position note"
            ],
            "Cash Flow Statement": [
                "statement of cash flows", "cash flow statement",
                "cash flows from operating", "operating activities"
            ]
        }
        
        logger.info("✅ ML Extractor initialized successfully")
    
    def _compute_field_embeddings(self) -> Dict[str, Any]:
        """Pre-compute embeddings for all target fields."""
        if not self.model:
            return {}
        
        embeddings = {}
        for statement_type, fields in STATEMENT_FIELDS.items():
            embeddings[statement_type] = {}
            for field in fields:
                # Create variations of the field name for better matching
                variations = [
                    field,
                    field.lower(),
                    field.replace('_', ' '),
                    field.replace('-', ' ')
                ]
                # Compute embedding as mean of variations
                field_embeddings = self.model.encode(variations)
                embeddings[statement_type][field] = np.mean(field_embeddings, axis=0)
        
        return embeddings
    
    def extract_from_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """
        Extract all financial statements from a PDF annual report.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Dictionary with extracted data in the target schema format
        """
        logger.info(f"\n{'='*80}")
        logger.info(f"📄 EXTRACTING FROM: {Path(pdf_path).name}")
        logger.info(f"{'='*80}\n")
        
        pdf_path = Path(pdf_path)
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")
        
        # Initialize result structure
        result = {
            "Bank": {"Year1": {}, "Year2": {}},
            "Group": {"Year1": {}, "Year2": {}}
        }
        
        try:
            # Step 1: Find statement pages
            statement_pages = self._find_statement_pages(pdf_path)
            logger.info(f"✅ Found statement pages: {statement_pages}")
            
            # Step 2: Extract each statement type
            for statement_type in MANDATORY_SECTIONS:
                if statement_type in statement_pages:
                    pages = statement_pages[statement_type]
                    logger.info(f"\n🔍 Extracting: {statement_type} from pages {pages}")
                    
                    extracted_data = self._extract_statement(pdf_path, pages, statement_type)
                    
                    # Store in result structure
                    for entity in ["Bank", "Group"]:
                        for year in ["Year1", "Year2"]:
                            if statement_type not in result[entity][year]:
                                result[entity][year][statement_type] = {}
                            result[entity][year][statement_type].update(
                                extracted_data.get(entity, {}).get(year, {})
                            )
                    
                    logger.info(f"✅ Extracted {statement_type}")
                else:
                    logger.warning(f"⚠️ Could not find pages for: {statement_type}")
            
            # Step 3: Extract Subsidiary Chart (if present)
            result['subsidiary_chart'] = self._extract_subsidiary_chart(pdf_path)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error during extraction: {e}", exc_info=True)
            return result

    def _extract_subsidiary_chart(self, pdf_path: Path) -> Dict[str, Any]:
        """
        Scan for and extract subsidiary flowchart if present.
        """
        logger.info("🔍 Scanning for Subsidiary Flowchart...")
        chart_data = {"nodes": [], "edges": []}
        
        try:
            from src.extractor.chart_extractor import ChartExtractor
            extractor = ChartExtractor()
            
            with pdfplumber.open(pdf_path) as pdf:
                # Scan first 150 pages
                for page_num in range(min(len(pdf.pages), 150)):
                    try:
                        page = pdf.pages[page_num]
                        text = page.extract_text() or ""
                        text_upper = text.upper()
                        
                        # Trigger condition
                        if "NOTES TO THE FINANCIAL STATEMENTS" in text_upper and "SUBSIDIARY" in text_upper:
                            logger.info(f"✅ Found Subsidiary Chart on page {page_num + 1}")
                            chart_data = extractor.extract_from_page(page)
                            
                            if chart_data["nodes"]:
                                logger.info(f"   ✓ Extracted {len(chart_data['nodes'])} nodes and {len(chart_data['edges'])} edges")
                                return chart_data
                                
                    except Exception as e:
                        continue
                        
        except Exception as e:
            logger.error(f"Error extracting subsidiary chart: {e}")
            
        return chart_data
    
    def _find_statement_pages(self, pdf_path: Path) -> Dict[str, List[int]]:
        """
        Intelligently find pages containing each financial statement.
        Uses ML-based text analysis and keyword matching.
        """
        logger.info("🔍 Scanning PDF to locate financial statements...")
        
        statement_pages = {}
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                total_pages = len(pdf.pages)
                logger.info(f"📖 Total pages: {total_pages}")
                
                # For large PDFs, focus on first 150 pages (financial statements are usually at the start)
                scan_limit = min(total_pages, 150)
                logger.info(f"📄 Scanning first {scan_limit} pages...")
                
                # Scan each page to find statement starting pages
                for page_num in range(scan_limit):
                    try:
                        # Skip if we already found all 3 statements
                        if len(statement_pages) >= 3:
                            logger.info(f"✅ Found all {len(statement_pages)} statements, stopping scan")
                            break
                        
                        page = pdf.pages[page_num]
                        
                        # Add timeout protection for slow pages
                        try:
                            text = page.extract_text() or ""
                        except (KeyboardInterrupt, SystemExit):
                            raise
                        except Exception as e:
                            logger.debug(f"Could not extract text from page {page_num}: {e}")
                            continue
                        
                        text_lower = text.lower()
                        
                        # Skip pages without financial data
                        if not self._is_statement_page(text):
                            continue
                        
                        # Check each statement type
                        for statement_type, keywords in self.statement_keywords.items():
                            if statement_type in statement_pages:
                                continue  # Already found
                            
                            # Look at first 800 characters for title
                            first_part = text_lower[:800]
                            
                            # Check if this page is the start of this statement
                            found = False
                            for keyword in keywords:
                                # Check if keyword is in first part (likely the title)
                                if keyword in first_part:
                                    found = True
                                    break
                            
                            if found:
                                statement_pages[statement_type] = [page_num]
                                logger.info(f"✅ Found '{statement_type}' starting at page {page_num + 1}")
                                
                                # Add continuation pages (next 1-2 pages that have data)
                                for offset in range(1, 3):
                                    next_page_num = page_num + offset
                                    if next_page_num < total_pages:
                                        try:
                                            next_page = pdf.pages[next_page_num]
                                            next_text = next_page.extract_text() or ""
                                        except:
                                            continue
                                        
                                        # Check if it's a continuation (has numbers but no new statement title)
                                        is_continuation = (
                                            self._is_statement_page(next_text) and
                                            not any(kw in next_text[:800].lower() 
                                                   for other_keywords in self.statement_keywords.values() 
                                                   for kw in other_keywords[:1])
                                        )
                                        
                                        if is_continuation:
                                            statement_pages[statement_type].append(next_page_num)
                                            logger.info(f"   - Added continuation page {next_page_num + 1}")
                                        else:
                                            break  # No more continuation pages
                                
                                break  # Found this statement, move to next page
                                
                    except (KeyboardInterrupt, SystemExit):
                        raise
                    except Exception as e:
                        logger.debug(f"Error processing page {page_num}: {e}")
                        continue
        
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception as e:
            logger.error(f"Error scanning PDF: {e}")
        
        return statement_pages
    
    def _is_statement_page(self, text: str) -> bool:
        """Check if a page contains financial statement data."""
        # Look for financial indicators
        indicators = [
            r'\d{1,3}(?:,\d{3})+',  # Numbers with commas
            r'Rs\.?\s*\d',  # Currency symbols
            r'\d+\.\d+',  # Decimals
            r'20\d{2}',  # Years
            r'Note\s+\d',  # Note references
        ]
        
        matches = sum(1 for pattern in indicators if re.search(pattern, text))
        return matches >= 3
    
    def _extract_statement(
        self, 
        pdf_path: Path, 
        pages: List[int], 
        statement_type: str
    ) -> Dict[str, Any]:
        """
        Extract a specific financial statement from given pages.
        Uses ML-based field matching and focuses on GROUP columns.
        """
        result = {
            "Bank": {"Year1": {}, "Year2": {}},
            "Group": {"Year1": {}, "Year2": {}}
        }
        
        target_fields = STATEMENT_FIELDS[statement_type]
        
        try:
            # Extract tables from all pages using multiple methods
            all_rows = []
            
            # Extract using pdfplumber (works well for most annual reports)
            logger.info("📊 Extracting tables from pages...")
            with pdfplumber.open(pdf_path) as pdf:
                for page_num in pages:
                    try:
                        page = pdf.pages[page_num]
                        
                        # Extract tables
                        tables = page.extract_tables()
                        logger.info(f"   Page {page_num + 1}: Found {len(tables)} tables")
                        
                        for table_idx, table in enumerate(tables):
                            if not table or len(table) < 2:
                                continue
                            
                            # Parse table rows
                            rows = self._parse_table_with_group_detection(table, statement_type)
                            if rows:
                                all_rows.extend(rows)
                                logger.info(f"      Table {table_idx + 1}: Extracted {len(rows)} rows")
                    
                    except Exception as e:
                        logger.warning(f"Error extracting from page {page_num + 1}: {e}")
                        continue
            
            # Try Camelot as backup if pdfplumber didn't get enough
            if len(all_rows) < 10:
                try:
                    logger.info("📊 Trying Camelot for better extraction...")
                    tables = camelot.read_pdf(
                        str(pdf_path),
                        pages=','.join(str(p + 1) for p in pages),
                        flavor='lattice',
                        strip_text='\n'
                    )
                    
                    for table in tables:
                        if not table.df.empty:
                            rows = self._parse_table_with_group_detection(
                                table.df.values.tolist(), 
                                statement_type
                            )
                            all_rows.extend(rows)
                
                except Exception as e:
                    logger.debug(f"Camelot backup failed: {e}")
            
            logger.info(f"📊 Total: {len(all_rows)} rows extracted from all tables")
            
            # Match rows to target fields using ML
            matched_count = 0
            for row in all_rows:
                field_name = row.get('field', '')
                if not field_name or len(field_name) < 3:
                    continue
                
                # Find best matching target field
                best_match, score = self._find_best_field_match(field_name, target_fields, statement_type)
                
                if score > 50:  # Lower threshold to catch more fields
                    # Extract values for Group columns
                    group_values = row.get('group_values', [])
                    
                    if group_values and len(group_values) > 0:
                        # Store in Group sections (focusing on Group as per requirements)
                        if len(group_values) >= 2:
                            result["Group"]["Year2"][best_match] = group_values[0]  # Current year (first col)
                            result["Group"]["Year1"][best_match] = group_values[1]  # Previous year (second col)
                        elif len(group_values) == 1:
                            result["Group"]["Year2"][best_match] = group_values[0]
                        
                        matched_count += 1
                        if matched_count <= 20:  # Log first 20 matches
                            logger.info(f"   ✓ '{field_name[:40]}...' -> '{best_match}' (score: {score:.0f})")
            
            logger.info(f"✅ Successfully matched {matched_count} fields to target schema")
            
        except Exception as e:
            logger.error(f"Error extracting statement: {e}", exc_info=True)
        
        return result
    
    def _parse_table_with_group_detection(self, table: List[List[str]], statement_type: str) -> List[Dict[str, Any]]:
        """
        Parse a table and detect Group columns intelligently.
        Returns rows with field names and Group values.
        """
        if not table or len(table) < 2:
            return []
        
        rows = []
        
        # Find header row and identify Group column indices
        header_row_idx = 0
        group_col_indices = []
        
        # Check first few rows for header
        for i in range(min(3, len(table))):
            row = table[i]
            row_text = ' '.join(str(cell).lower() for cell in row if cell)
            
            if 'group' in row_text:
                header_row_idx = i
                # Find which columns contain "Group"
                for col_idx, cell in enumerate(row):
                    if cell and 'group' in str(cell).lower():
                        group_col_indices.append(col_idx)
                break
        
        # If no Group columns found in header, try to detect by position
        # Usually: Column 0 = Description, Columns 1-2 = Bank, Columns 3-4 = Group
        if not group_col_indices and len(table[0]) >= 4:
            group_col_indices = [len(table[0]) - 2, len(table[0]) - 1]  # Last 2 columns
        
        logger.debug(f"Detected Group columns at indices: {group_col_indices}")
        
        # Parse data rows (skip header)
        for row_idx in range(header_row_idx + 1, len(table)):
            row = table[row_idx]
            
            if not row or len(row) == 0:
                continue
            
            # First cell is the field name
            field_name = str(row[0]).strip() if row[0] else ""
            
            # Skip empty or header-like rows
            if not field_name or field_name.lower() in ['', 'nan', 'note', 'group', 'bank']:
                continue
            
            # Skip rows that look like sub-headers
            if len(field_name) < 3 or field_name.isupper():
                continue
            
            # Extract Group values
            group_values = []
            for col_idx in group_col_indices:
                if col_idx < len(row):
                    value = self._extract_number(str(row[col_idx]))
                    if value is not None:
                        group_values.append(value)
            
            # Only include rows with at least one value
            if group_values:
                rows.append({
                    'field': field_name,
                    'group_values': group_values
                })
        
        return rows
    
    def _parse_table_rows(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Parse a DataFrame into structured rows."""
        rows = []
        
        for idx, row in df.iterrows():
            # First column is usually the field name
            field_name = str(row.iloc[0] if len(row) > 0 else '').strip()
            
            if not field_name or field_name == 'nan':
                continue
            
            # Remaining columns are values
            values = []
            for i in range(1, len(row)):
                val = str(row.iloc[i]).strip()
                if val and val != 'nan':
                    values.append(val)
            
            if values:
                rows.append({
                    'field': field_name,
                    'values': values,
                    'raw_row': row.tolist()
                })
        
        return rows
    
    def _parse_table_with_columns(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Parse a DataFrame with smart column detection.
        Identifies Bank vs Group columns and extracts accordingly.
        """
        rows = []
        
        if df.empty:
            return rows
        
        # Try to identify header row with "Group" and year information
        group_col_indices = []
        bank_col_indices = []
        
        # Check first few rows for headers
        for header_row_idx in range(min(3, len(df))):
            header_row = df.iloc[header_row_idx]
            header_text = ' '.join([str(x).lower() for x in header_row if str(x) != 'nan'])
            
            # Look for Group column indicators
            for col_idx in range(len(header_row)):
                col_text = str(header_row.iloc[col_idx]).lower()
                
                if 'group' in col_text:
                    # Found group column header
                    # Next columns after this are likely Group year columns
                    for i in range(col_idx + 1, min(col_idx + 4, len(header_row))):
                        if col_idx not in group_col_indices and i not in group_col_indices:
                            group_col_indices.append(i)
                
                elif 'bank' in col_text or 'company' in col_text:
                    # Bank columns
                    for i in range(col_idx + 1, min(col_idx + 4, len(header_row))):
                        if i not in bank_col_indices:
                            bank_col_indices.append(i)
        
        # If we couldn't identify Group columns, use heuristic: last 2-3 columns are often Group
        if not group_col_indices and len(df.columns) > 3:
            group_col_indices = list(range(len(df.columns) - 2, len(df.columns)))
        
        logger.debug(f"Identified Group columns: {group_col_indices}")
        
        # Parse data rows (skip first few header rows)
        start_row = 1
        for idx in range(len(df)):
            row = df.iloc[idx]
            field_name = str(row.iloc[0]).strip()
            
            # Skip header rows and empty rows
            if not field_name or field_name == 'nan' or len(field_name) < 2:
                continue
            
            # Skip rows that look like headers
            field_lower = field_name.lower()
            if any(x in field_lower for x in ['group', 'bank', 'company', 'note', '20', 'year', 'rs']):
                # But keep if it's a legitimate field name
                if not any(x in field_lower for x in ['income', 'expense', 'profit', 'loss', 'asset', 'liability', 'cash', 'flow']):
                    continue
            
            # Extract Group values
            group_values = []
            for col_idx in group_col_indices:
                if col_idx < len(row):
                    val = str(row.iloc[col_idx]).strip()
                    if val and val != 'nan':
                        number = self._extract_number(val)
                        if number is not None:
                            group_values.append(number)
            
            if group_values:
                rows.append({
                    'field': field_name,
                    'group_values': group_values,
                    'raw_row': row.tolist()
                })
        
        return rows
    
    def _find_best_field_match(
        self, 
        text: str, 
        target_fields: List[str],
        statement_type: str = None
    ) -> Tuple[str, float]:
        """
        Find the best matching target field for given text.
        Uses both semantic similarity and fuzzy string matching.
        """
        text = text.strip().lower()
        
        if not text:
            return "", 0.0
        
        best_match = ""
        best_score = 0.0
        
        # Method 1: Semantic similarity (if model available)
        if self.model and self.field_embeddings and statement_type:
            text_embedding = self.model.encode([text])[0]
            
            for field in target_fields:
                if field in self.field_embeddings.get(statement_type, {}):
                    field_embedding = self.field_embeddings[statement_type][field]
                    similarity = np.dot(text_embedding, field_embedding)
                    similarity = (similarity + 1) / 2 * 100  # Normalize to 0-100
                    
                    if similarity > best_score:
                        best_score = similarity
                        best_match = field
        
        # Method 2: Fuzzy string matching (always use as backup)
        for field in target_fields:
            # Try multiple matching methods
            scores = [
                fuzz.token_set_ratio(text, field.lower()),
                fuzz.partial_ratio(text, field.lower()),
                fuzz.ratio(text, field.lower())
            ]
            score = max(scores)
            
            # Boost score if key words match
            text_words = set(text.split())
            field_words = set(field.lower().split())
            common_words = text_words & field_words
            if common_words:
                score += len(common_words) * 5
            
            if score > best_score:
                best_score = score
                best_match = field
        
        return best_match, best_score
    
    def _extract_values_from_row(self, row: Dict[str, Any]) -> List[float]:
        """Extract numeric values from a row."""
        values = []
        
        for val_str in row.get('values', []):
            # Clean and extract number
            number = self._extract_number(val_str)
            if number is not None:
                values.append(number)
        
        return values
    
    def _extract_number(self, text: str) -> Optional[float]:
        """Extract a number from text."""
        # Remove common prefixes/suffixes
        text = re.sub(r'Rs\.?|USD|\$|€|£', '', text)
        text = re.sub(r'[()]', '', text)  # Remove parentheses
        text = text.strip()
        
        # Handle negative numbers in parentheses
        is_negative = '(' in text or ')' in text or text.startswith('-')
        
        # Extract number
        match = re.search(r'[\d,]+\.?\d*', text)
        if match:
            try:
                number = float(match.group().replace(',', ''))
                return -number if is_negative else number
            except:
                pass
        
        return None
    
    def _store_values(
        self, 
        result: Dict[str, Any], 
        field_name: str, 
        values: List[float]
    ):
        """Store extracted values in the result structure."""
        # Heuristic: First values are usually Bank, later values are Group
        # First 2 values are usually Year1 and Year2 for Bank
        # Next 2 values are Year1 and Year2 for Group
        
        if len(values) >= 4:
            result["Bank"]["Year1"][field_name] = values[0]
            result["Bank"]["Year2"][field_name] = values[1]
            result["Group"]["Year1"][field_name] = values[2]
            result["Group"]["Year2"][field_name] = values[3]
        elif len(values) >= 2:
            result["Bank"]["Year1"][field_name] = values[0]
            result["Bank"]["Year2"][field_name] = values[1]
        elif len(values) == 1:
            result["Bank"]["Year1"][field_name] = values[0]
    
    def save_results(self, data: Dict[str, Any], output_path: str):
        """Save extraction results to JSON file."""
        import json
        from datetime import datetime
        
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Add metadata
        output_data = {
            "extraction_date": datetime.now().isoformat(),
            "extractor_version": "ML-v1.0",
            "data": data
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Results saved to: {output_path}")
