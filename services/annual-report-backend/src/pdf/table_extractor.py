"""Table extraction module for extracting structured data from PDFs."""

import pdfplumber
import pandas as pd
from pathlib import Path
from typing import List, Dict, Any, Optional
from src.utils.logger import get_logger
from src.utils.helpers import clean_text, extract_numbers
import re

logger = get_logger(__name__)


class TableExtractor:
    """Extract tables from PDF documents."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize table extractor.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config or {}
        self.method = self.config.get('method', 'pdfplumber')
        logger.info(f"Initialized Table Extractor with method: {self.method}")
    
    def extract_tables_pdfplumber(
        self, 
        pdf_path: str, 
        page_num: int
    ) -> List[pd.DataFrame]:
        """
        Extract tables from a specific page using pdfplumber.
        
        Args:
            pdf_path: Path to PDF file
            page_num: Page number (0-indexed)
        
        Returns:
            List of DataFrames containing table data
        """
        tables = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                if 0 <= page_num < len(pdf.pages):
                    page = pdf.pages[page_num]
                    page_tables = page.extract_tables()
                    
                    for i, table in enumerate(page_tables):
                        if table and len(table) > 0:
                            # Convert to DataFrame
                            # For financial statements, first row is often data, not headers
                            # Use numeric column indices instead
                            df = pd.DataFrame(table)
                            
                            # Clean the DataFrame
                            df = self.clean_table(df)
                            
                            if not df.empty:
                                tables.append(df)
                                logger.info(
                                    f"Extracted table {i+1} from page {page_num+1}: "
                                    f"{df.shape[0]} rows x {df.shape[1]} columns"
                                )
            
            return tables
            
        except Exception as e:
            logger.error(f"Error extracting tables with pdfplumber: {str(e)}")
            return []
    
    def extract_tables_from_pages(
        self, 
        pdf_path: str, 
        page_numbers: List[int]
    ) -> Dict[int, List[pd.DataFrame]]:
        """
        Extract tables from multiple pages.
        
        Args:
            pdf_path: Path to PDF file
            page_numbers: List of page numbers (0-indexed)
        
        Returns:
            Dictionary mapping page numbers to lists of DataFrames
        """
        all_tables = {}
        
        for page_num in page_numbers:
            tables = self.extract_tables_pdfplumber(pdf_path, page_num)
            if tables:
                all_tables[page_num] = tables
        
        total_tables = sum(len(tables) for tables in all_tables.values())
        logger.info(f"Extracted {total_tables} tables from {len(all_tables)} pages")
        
        return all_tables
    
    def clean_table(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean extracted table data.
        
        Args:
            df: Raw DataFrame
        
        Returns:
            Cleaned DataFrame
        """
        try:
            # Remove completely empty rows and columns
            df = df.dropna(how='all').dropna(axis=1, how='all')
            
            # Clean text in all cells
            for col in df.columns:
                try:
                    if pd.api.types.is_object_dtype(df[col]):
                        df[col] = df[col].apply(
                            lambda x: clean_text(str(x)) if pd.notna(x) else None
                        )
                except:
                    pass
            
            # Remove rows where all values are None or empty strings
            df = df[df.apply(lambda row: row.notna().any(), axis=1)]
            
            return df
            
        except Exception as e:
            logger.error(f"Error cleaning table: {str(e)}")
            return df
    
    def identify_financial_table(self, df: pd.DataFrame) -> Optional[str]:
        """
        Identify the type of financial table.
        
        Args:
            df: DataFrame to analyze
        
        Returns:
            Table type or None
        """
        try:
            # Convert DataFrame to string for keyword matching
            table_text = ' '.join([
                ' '.join(map(str, df.columns)),
                ' '.join(df.fillna('').astype(str).values.flatten())
            ]).lower()
            
            # Check for Income Statement indicators
            income_keywords = [
                'revenue', 'income', 'expense', 'profit', 'loss',
                'interest income', 'interest expense', 'net income'
            ]
            if any(keyword in table_text for keyword in income_keywords):
                if 'profit' in table_text or 'income' in table_text:
                    return 'income_statement'
            
            # Check for Balance Sheet indicators
            balance_keywords = [
                'assets', 'liabilities', 'equity', 'capital',
                'total assets', 'total liabilities'
            ]
            if any(keyword in table_text for keyword in balance_keywords):
                return 'balance_sheet'
            
            # Check for Cash Flow indicators
            cashflow_keywords = [
                'cash flow', 'operating activities', 'investing activities',
                'financing activities', 'cash generated'
            ]
            if any(keyword in table_text for keyword in cashflow_keywords):
                return 'cash_flow'
            
            return None
            
        except Exception as e:
            logger.error(f"Error identifying financial table: {str(e)}")
            return None
    
    def extract_key_value_from_table(
        self, 
        df: pd.DataFrame, 
        key_column: int = 0, 
        value_column: int = -1
    ) -> Dict[str, Any]:
        """
        Extract key-value pairs from a table.
        
        Args:
            df: DataFrame containing the table
            key_column: Index of column containing keys (names)
            value_column: Index of column containing values (numbers)
        
        Returns:
            Dictionary of key-value pairs
        """
        data = {}
        
        try:
            # Get column names
            columns = df.columns.tolist()
            
            if not columns or len(columns) == 0:
                return data
            
            key_col = columns[key_column]
            value_col = columns[value_column]
            
            for _, row in df.iterrows():
                key = row[key_col]
                value = row[value_col]
                
                if pd.notna(key) and key:
                    key_str = clean_text(str(key))
                    
                    # Extract numeric value
                    if pd.notna(value):
                        numeric_value = extract_numbers(str(value))
                        if numeric_value is not None:
                            data[key_str] = numeric_value
            
            logger.info(f"Extracted {len(data)} key-value pairs from table")
            return data
            
        except Exception as e:
            logger.error(f"Error extracting key-value from table: {str(e)}")
            return {}
    
    def save_table(self, df: pd.DataFrame, output_path: str, format: str = 'csv'):
        """
        Save table to file.
        
        Args:
            df: DataFrame to save
            output_path: Path to save file
            format: Output format ('csv', 'excel', 'json')
        """
        try:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            if format == 'csv':
                df.to_csv(output_path, index=False, encoding='utf-8')
            elif format == 'excel':
                df.to_excel(output_path, index=False)
            elif format == 'json':
                df.to_json(output_path, orient='records', indent=2)
            
            logger.info(f"Saved table to: {output_path}")
            
        except Exception as e:
            logger.error(f"Error saving table: {str(e)}")
    
    def extract_multi_column_values(self, df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
        """
        Extract values from tables with multiple year columns.
        
        Args:
            df: DataFrame with multiple value columns
        
        Returns:
            Dictionary with structure: {item_name: {year1: value1, year2: value2}}
        """
        data = {}

        try:
            if df.empty or len(df.columns) < 2:
                return data

            # Identify item column and value columns
            item_column = df.columns[0]
            value_columns = df.columns[1:]

            # Prefer columns that contain 'group' in header
            group_cols = [col for col in value_columns if 'group' in str(col).lower()]
            if group_cols:
                selected_value_columns = group_cols
            else:
                # Fallback: use the last two numeric-like columns
                selected_value_columns = list(value_columns)[-2:]

            # Helper to get a year/label from column header
            def header_to_label(col):
                col_text = str(col)
                m = re.search(r'(19|20)\d{2}', col_text)
                if m:
                    return m.group(0)
                return clean_text(col_text)

            for _, row in df.iterrows():
                item_name = row[item_column]

                if pd.notna(item_name) and item_name:
                    item_name_clean = clean_text(str(item_name))
                    data[item_name_clean] = {}

                    for col in selected_value_columns:
                        value = row[col] if col in df.columns else None
                        if pd.notna(value):
                            numeric_value = extract_numbers(str(value))
                            if numeric_value is not None:
                                label = header_to_label(col)
                                data[item_name_clean][label] = numeric_value

            logger.info(f"Extracted multi-column values for {len(data)} items (using columns: {selected_value_columns})")
            return data

        except Exception as e:
            logger.error(f"Error extracting multi-column values: {str(e)}")
            return {}
