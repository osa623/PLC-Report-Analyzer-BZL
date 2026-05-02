"""
ML-Powered Financial Statement Extraction Pipeline
Uses machine learning for intelligent document understanding and field matching
"""

from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
import re
import pandas as pd
import pdfplumber

from src.pdf.loader import PDFLoader
from src.pdf.ocr import OCRProcessor  
from src.pdf.table_extractor import TableExtractor
from src.extraction.currency_detector import detect_currency_and_unit
from src.extraction.period_detector import detect_period
from src.extraction.normalizer import ValueNormalizer
from src.storage.save_json import save_extraction_result
from config.target_schema_bank import STATEMENT_FIELDS, MANDATORY_SECTIONS, TARGET_FIELDS
from config.term_mapping_bank import TERM_MAPPING
from src.utils.logger import get_logger
from src.utils.helpers import load_config, extract_numbers

# Import ML components
from src.ml.document_classifier import DocumentClassifier
from src.ml.intelligent_field_matcher import IntelligentFieldMatcher

logger = get_logger(__name__)


class MLExtractionPipeline:
    """ML-powered extraction pipeline that works with any annual report format."""
    
    def __init__(self, config_path: str = "config/settings.yaml"):
        self.config = load_config(config_path)
        self.ocr_processor = OCRProcessor()
        self.table_extractor = TableExtractor(self.config.get('table_extraction', {}))
        self.normalizer = ValueNormalizer()
        
        # Initialize ML components
        self.document_classifier = DocumentClassifier()
        self.field_matcher = IntelligentFieldMatcher(STATEMENT_FIELDS)
        
        logger.info("="*80)
        logger.info("🤖 ML-POWERED FINANCIAL STATEMENT EXTRACTOR INITIALIZED")
        logger.info("✅ Works with ANY bank annual report format")
        logger.info("✅ Intelligent document classification")
        logger.info("✅ Smart field matching with NLP")
        logger.info("="*80)
    
    def extract(self, pdf_path: str) -> Dict[str, Any]:
        """
        Extract financial data from any annual report PDF.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Structured financial data matching TARGET_FIELDS schema
        """
        logger.info(f"\n📄 Processing PDF: {Path(pdf_path).name}")
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                total_pages = len(pdf.pages)
                logger.info(f"📊 Total pages: {total_pages}")
                
                # Step 1: Find statement pages using ML classifier
                statement_pages = self._find_statement_pages_ml(pdf)
                
                # Step 2: Extract tables from identified pages
                extracted_data = self._extract_all_statements(pdf, statement_pages)
                
                # Step 3: Structure data according to target schema
                structured_data = self._structure_data(extracted_data)
                
                # Step 4: Save results
                output_path = self._save_results(pdf_path, structured_data)
                
                logger.info(f"✅ Extraction complete! Saved to: {output_path}")
                return structured_data
                
        except Exception as e:
            logger.error(f"❌ Extraction failed: {e}", exc_info=True)
            raise
    
    def _find_statement_pages_ml(self, pdf) -> Dict[str, List[int]]:
        """
        Use ML classifier to find pages containing each statement type.
        """
        logger.info("\n🔍 STEP 1: Finding statement pages with ML classifier...")
        
        pages_text = {}
        total_pages = len(pdf.pages)
        
        # Extract text from all pages with error handling
        for page_num in range(total_pages):
            try:
                page = pdf.pages[page_num]
                
                # Try to extract text with timeout
                try:
                    text = page.extract_text(layout=False, x_tolerance=2, y_tolerance=2) or ""
                except Exception as extract_error:
                    logger.warning(f"   ⚠️  Page {page_num + 1}: Text extraction failed, trying table extraction")
                    # Fallback: try to extract from tables
                    try:
                        tables = page.extract_tables()
                        text = "\n".join([" ".join([str(cell) for cell in row]) for table in (tables or []) for row in table])
                    except:
                        text = ""
                
                pages_text[page_num] = text
                
                if (page_num + 1) % 10 == 0:
                    logger.info(f"   Analyzed {page_num + 1}/{total_pages} pages...")
            except Exception as e:
                logger.warning(f"   ⚠️  Page {page_num + 1} processing failed: {e}")
                pages_text[page_num] = ""
        
        # Classify pages
        logger.info("   Running ML classification...")
        page_ranges = self.document_classifier.find_statement_pages(pages_text)
        validated_ranges = self.document_classifier.validate_statement_sequence(page_ranges)
        
        # Log results
        for stmt_type, pages in validated_ranges.items():
            if pages:
                logger.info(f"   ✅ {stmt_type}: Pages {pages}")
            else:
                logger.warning(f"   ⚠️  {stmt_type}: Not found")
        
        return validated_ranges
    
    def _extract_all_statements(self, pdf, statement_pages: Dict[str, List[int]]) -> Dict[str, Any]:
        """
        Extract tables and data from all identified statement pages.
        """
        logger.info("\n📊 STEP 2: Extracting tables from identified pages...")
        
        extracted = {}
        
        for stmt_type, pages in statement_pages.items():
            if not pages:
                logger.warning(f"   ⚠️  Skipping {stmt_type} - no pages found")
                extracted[stmt_type] = {}
                continue
            
            logger.info(f"   Extracting {stmt_type} from pages {pages}...")
            
            # Extract tables from all relevant pages
            all_tables = []
            for page_num in pages:
                try:
                    page = pdf.pages[page_num]
                    tables = self.table_extractor.extract_tables(page)
                    
                    if tables:
                        logger.info(f"      Page {page_num + 1}: Found {len(tables)} tables")
                        all_tables.extend(tables)
                    else:
                        logger.warning(f"      Page {page_num + 1}: No tables found")
                        
                except Exception as e:
                    logger.error(f"      ❌ Page {page_num + 1} extraction failed: {e}")
            
            # Parse tables with intelligent field matching
            extracted[stmt_type] = self._parse_tables_with_ml(all_tables, stmt_type)
        
        return extracted
    
    def _parse_tables_with_ml(self, tables: List[Any], stmt_type: str) -> Dict[str, Any]:
        """
        Parse tables using ML-powered field matching and dynamic entity detection.
        """
        if not tables:
            return {}
        
        # We need to determine the schema dynamically based on the tables found.
        # But we need a base structure to return. 
        # For now, we'll try to stick to a superset or detect from the first table.
        
        # Let's accumulate data in a flexible dict first
        flexible_result = {} 
        
        for table in tables:
            try:
                # Convert table to DataFrame
                df = pd.DataFrame(table[1:], columns=table[0] if table else [])
                
                if df.empty or len(df.columns) < 2:
                    continue
                
                # Detect structure: first column is field names
                field_col = df.columns[0]
                value_cols = df.columns[1:]
                
                logger.info(f"      Parsing table header: {list(value_cols)}")
                
                # Detect Entity Columns and Labels
                # e.g. standalone_cols, group_cols, standalone_label ('Bank' or 'Company')
                standalone_cols, group_cols, standalone_label = self._identify_entity_columns(list(value_cols))
                
                # Ensure keys exist
                if standalone_label not in flexible_result:
                     flexible_result[standalone_label] = {"Year1": {}, "Year2": {}}
                if "Group" not in flexible_result:
                     flexible_result["Group"] = {"Year1": {}, "Year2": {}}

                # Process each row
                for idx, row in df.iterrows():
                    field_name = str(row[field_col]).strip()
                    
                    if not field_name or len(field_name) < 3:
                        continue
                    
                    # Match field to target schema using ML
                    matched_field, confidence = self.field_matcher.match_field(field_name, stmt_type)
                    
                    if matched_field and confidence >= 0.6:
                        # Extract Standalone values (Bank/Company)
                        if standalone_cols:
                            year1_val = self._extract_value(row, standalone_cols[0])
                            if year1_val:
                                flexible_result[standalone_label]["Year1"][matched_field] = year1_val
                            
                            if len(standalone_cols) > 1:
                                year2_val = self._extract_value(row, standalone_cols[1])
                                if year2_val:
                                    flexible_result[standalone_label]["Year2"][matched_field] = year2_val
                        
                        # Extract Group values
                        if group_cols:
                            year1_val = self._extract_value(row, group_cols[0])
                            if year1_val:
                                flexible_result["Group"]["Year1"][matched_field] = year1_val
                            
                            if len(group_cols) > 1:
                                year2_val = self._extract_value(row, group_cols[1])
                                if year2_val:
                                    flexible_result["Group"]["Year2"][matched_field] = year2_val
                        
                        if confidence >= 0.8:
                            logger.debug(f"         ✅ '{field_name}' → '{matched_field}' (confidence: {confidence:.2f}) ({standalone_label}/Group)")
            
            except Exception as e:
                logger.error(f"      ❌ Table parsing error: {e}", exc_info=True)
        
        # Ensure default structure if empty
        if not flexible_result:
            return {
                "Bank": {"Year1": {}, "Year2": {}},
                "Group": {"Year1": {}, "Year2": {}}
            }
            
        return flexible_result

    def _identify_entity_columns(self, columns: List[str]) -> Tuple[List[str], List[str], str]:
        """
        Identify which columns belong to the Standalone entity (Bank/Company) vs Group.
        Returns: (standalone_cols, group_cols, standalone_label)
        """
        standalone_cols = []
        group_cols = []
        standalone_label = "Bank" # Default
        
        # Check for "Company" keyword to switch mode
        has_company = any('company' in str(c).lower() for c in columns)
        if has_company:
            standalone_label = "Company"
        
        for col in columns:
            col_lower = str(col).lower()
            
            if 'bank' in col_lower:
                standalone_cols.append(col)
                if not has_company:
                    standalone_label = "Bank"
            elif 'company' in col_lower:
                standalone_cols.append(col)
                standalone_label = "Company"
            elif 'group' in col_lower:
                group_cols.append(col)
            else:
                # Fallback based on existing lists
                if len(standalone_cols) < 2:
                    standalone_cols.append(col)
                else:
                    group_cols.append(col)
        
        return standalone_cols, group_cols, standalone_label
        
    # Deprecated but keeping for compatibility if called elsewhere? 
    # Actually safe to remove if I update the caller above.
    def _identify_bank_group_columns(self, columns: List[str]) -> Tuple[List[str], List[str]]:
         s, g, _ = self._identify_entity_columns(columns)
         return s, g
    
    def _extract_value(self, row: pd.Series, column: str) -> Optional[str]:
        """
        Extract and normalize a value from a table cell.
        """
        try:
            value = str(row[column]).strip()
            
            # Clean and normalize
            value = re.sub(r'[^\d.,()-]', '', value)
            
            if not value or value in ['-', '—', 'None', 'nan']:
                return None
            
            # Remove parentheses (negative numbers)
            is_negative = '(' in value
            value = value.replace('(', '').replace(')', '')
            
            # Remove commas
            value = value.replace(',', '')
            
            if is_negative and not value.startswith('-'):
                value = '-' + value
            
            return value if value else None
            
        except Exception as e:
            logger.debug(f"Value extraction error: {e}")
            return None
    
    def _structure_data(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Structure extracted data to match TARGET_FIELDS schema.
        Dynamically handles different entities (Bank, Company, Group).
        """
        logger.info("\n🏗️  STEP 3: Structuring data to target schema...")
        
        # 1. Collect all detected Entities (e.g. Bank, Group, Company)
        detected_entities = set(["Bank", "Group"]) # Default set
        for stmt_type, stmt_data in extracted_data.items():
            if isinstance(stmt_data, dict):
                detected_entities.update(stmt_data.keys())
        
        # 2. Initialize structure dynamically
        data_structure = {}
        for entity in detected_entities:
             data_structure[entity] = {"Year1": {}, "Year2": {}}

        structured = {
            "metadata": {
                "extraction_date": datetime.now().isoformat(),
                "schema_version": "1.1", # Version bump for dynamic entities
                "extractor": "ML-Powered Extractor"
            },
            "data": data_structure
        }
        
        # 3. Copy extracted data to structured format
        for stmt_type in MANDATORY_SECTIONS:
            if stmt_type in extracted_data:
                stmt_data = extracted_data[stmt_type]
                
                # Iterate over ALL found entities in this statement result
                for entity in stmt_data.keys():
                    if entity not in structured["data"]:
                        # Should have been initialized but just in case
                        structured["data"][entity] = {"Year1": {}, "Year2": {}}

                    for year in ["Year1", "Year2"]:
                        if year in stmt_data[entity]:
                            if stmt_type not in structured["data"][entity][year]:
                                structured["data"][entity][year][stmt_type] = {}
                            
                            structured["data"][entity][year][stmt_type].update(
                                stmt_data[entity][year]
                            )
        
        # Log statistics
        for entity in structured["data"].keys():
            for year in ["Year1", "Year2"]:
                 # Check if year dictionary exists
                if year in structured["data"][entity]:
                    total_fields = sum(
                        len(stmt.keys())
                        for stmt in structured["data"][entity][year].values()
                    )
                    logger.info(f"   {entity} {year}: {total_fields} fields extracted")
        
        return structured
    
    def _save_results(self, pdf_path: str, data: Dict[str, Any]) -> str:
        """
        Save extraction results to JSON file.
        """
        logger.info("\n💾 STEP 4: Saving results...")
        
        # Generate output filename
        pdf_name = Path(pdf_path).stem
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"{pdf_name}_{timestamp}.json"
        
        output_dir = Path("data/processed/statement_jsons")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_path = output_dir / output_filename
        
        import json
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"   ✅ Saved to: {output_path}")
        return str(output_path)


def extract_financial_data(pdf_path: str) -> Dict[str, Any]:
    """
    Main entry point for ML-powered extraction.
    
    Args:
        pdf_path: Path to annual report PDF
        
    Returns:
        Structured financial data
    """
    pipeline = MLExtractionPipeline()
    return pipeline.extract(pdf_path)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python extract_ml.py <pdf_path>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    result = extract_financial_data(pdf_path)
    print("\n✅ Extraction complete!")
