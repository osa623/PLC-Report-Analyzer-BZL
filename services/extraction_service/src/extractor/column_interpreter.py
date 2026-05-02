"""
Column Interpreter
Interprets table columns to identify:
- Bank vs Group columns
- Year1 vs Year2 columns
- Note columns
- Description/label columns
"""

import re
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum


class ColumnType(Enum):
    """Types of columns in financial statements."""
    DESCRIPTION = "description"  # Row labels
    NOTE = "note"  # Note references
    BANK_YEAR1 = "bank_year1"
    GROUP_YEAR1 = "group_year1"
    GROUP_YEAR2 = "group_year2"
    PAGE = "page"  # Page number
    UNKNOWN = "unknown"


@dataclass
class ColumnInfo:
    """Information about a column."""
    index: int
    column_type: ColumnType
    header_text: str
    confidence: float
    year: Optional[int] = None  # Extracted year (e.g., 2023)
    entity: Optional[str] = None  # 'Bank' or 'Group'


class ColumnInterpreter:
    """Interpret table columns to identify their semantic meaning."""
    
    def __init__(self):
        """Initialize column interpreter with patterns."""
        # Patterns for detecting Bank/Group
        self.bank_patterns = [
            r'\bbank\b',
            r'\bcompany\b',
            r'\bentity\b',
        ]
        
        self.group_patterns = [
            r'\bgroup\b',
            r'\bconsolidated\b',
        ]
        
        # Pattern for years
        self.year_pattern = r'\b(20\d{2})\b'

        # Patterns for page numbers
        self.page_patterns = [
            r'\bpage\b',
            r'\bpg\b',
        ]
        
        # Patterns for notes
        self.note_patterns = [
            r'\bnote\b',
            r'\bnotes?\b',
            r'\bref\b',
        ]
        
        # Patterns for description/label columns
        self.description_patterns = [
            r'\bparticulars\b',
            r'\bdescription\b',
            r'\bdetails\b',
            r'\bitems?\b',
        ]
    
    def interpret_columns(
        self,
        table_rows: List[List[str]],
        data_sample: Optional[List[List[str]]] = None
    ) -> Dict[str, Any]:
        """
        Interpret columns from table rows to identify Bank/Group and Year columns.
        
        Args:
            table_rows: All table rows including headers
            data_sample: Optional sample data rows
        
        Returns:
            Dict with 'columns' list containing ColumnInfo objects
        """
        if not table_rows or len(table_rows) < 2:
            return {'columns': []}
        
        # Use first few rows as headers (financial statements often have multi-line headers)
        header_rows = table_rows[:min(3, len(table_rows))]
        data_sample = data_sample or table_rows[3:8] if len(table_rows) > 3 else []
        
        # Determine number of columns
        num_columns = max(len(row) for row in table_rows)
        
        # Combine header rows for each column
        combined_headers = []
        for col_idx in range(num_columns):
            # Collect all header text for this column
            col_headers = []
            for row in header_rows:
                if col_idx < len(row):
                    cell = str(row[col_idx]).strip()
                    if cell:
                        col_headers.append(cell)
            
            combined = ' '.join(col_headers)
            combined_headers.append(combined)
        
        # Interpret each column
        column_info = {}
        
        for col_idx, header_text in enumerate(combined_headers):
            info = self._interpret_single_column(
                col_idx,
                header_text,
                data_sample
            )
            column_info[col_idx] = info
        
        # Post-process: resolve ambiguities and assign Year1/Year2
        column_info = self._resolve_year_ordering(column_info)
        
        # Convert to list format for API response
        columns_list = [
            {
                'index': info.index,
                'column_type': info.column_type,
                'header_text': info.header_text,
                'confidence': info.confidence,
                'year': info.year,
                'entity': info.entity
            }
            for info in column_info.values()
        ]
        
        return {
            'columns': columns_list,
            'column_info': column_info  # Keep original for internal use
        }
    
    def _interpret_single_column(
        self,
        col_idx: int,
        header_text: str,
        data_sample: Optional[List[List[str]]]
    ) -> ColumnInfo:
        """
        Interpret a single column.
        
        Args:
            col_idx: Column index
            header_text: Combined header text for this column
            data_sample: Optional data sample
        
        Returns:
            ColumnInfo object
        """
        header_lower = header_text.lower()
        
        # Check for description/label column
        for pattern in self.description_patterns:
            if re.search(pattern, header_lower):
                return ColumnInfo(
                    index=col_idx,
                    column_type=ColumnType.DESCRIPTION,
                    header_text=header_text,
                    confidence=0.9
                )
        
        # First column is often description if no explicit header
        if col_idx == 0 and not any(
            re.search(pattern, header_lower) 
            for pattern in self.bank_patterns + self.group_patterns
        ):
            # Check if data looks like descriptions (text, not numbers)
            if data_sample:
                is_numeric = self._column_is_numeric(col_idx, data_sample)
                if not is_numeric:
                    return ColumnInfo(
                        index=col_idx,
                        column_type=ColumnType.DESCRIPTION,
                        header_text=header_text,
                        confidence=0.7
                    )
        
        # Check for note column
        for pattern in self.note_patterns:
            if re.search(pattern, header_lower):
                return ColumnInfo(
                    index=col_idx,
                    column_type=ColumnType.NOTE,
                    header_text=header_text,
                    confidence=0.9
                )
        
        # Check for page column
        for pattern in self.page_patterns:
            if re.search(pattern, header_lower):
                return ColumnInfo(
                    index=col_idx,
                    column_type=ColumnType.PAGE,
                    header_text=header_text,
                    confidence=0.9
                )
        
        # Check for Bank/Group and Year
        is_bank = any(re.search(p, header_lower) for p in self.bank_patterns)
        is_group = any(re.search(p, header_lower) for p in self.group_patterns)
        
        # Extract year
        year_match = re.search(self.year_pattern, header_text)
        year = int(year_match.group(1)) if year_match else None
        
        # Determine entity
        if is_bank and not is_group:
            entity = 'Bank'
        elif is_group and not is_bank:
            entity = 'Group'
        elif is_bank and is_group:
            # Both mentioned - check which comes first
            bank_pos = min(
                (header_lower.find(p.strip(r'\b')) for p in self.bank_patterns 
                 if p.strip(r'\b') in header_lower),
                default=9999
            )
            group_pos = min(
                (header_lower.find(p.strip(r'\b')) for p in self.group_patterns 
                 if p.strip(r'\b') in header_lower),
                default=9999
            )
            entity = 'Bank' if bank_pos < group_pos else 'Group'
        else:
            entity = None
        
        # If we identified entity or year, this is a value column
        if entity or year:
            # Column type will be resolved after we know year ordering
            return ColumnInfo(
                index=col_idx,
                column_type=ColumnType.UNKNOWN,  # Will be resolved
                header_text=header_text,
                confidence=0.8 if (entity and year) else 0.6,
                year=year,
                entity=entity
            )
        
        # Check if column contains numeric data
        if data_sample:
            is_numeric = self._column_is_numeric(col_idx, data_sample)
            if is_numeric:
                # It's a value column, but we don't know entity/year yet
                return ColumnInfo(
                    index=col_idx,
                    column_type=ColumnType.UNKNOWN,
                    header_text=header_text,
                    confidence=0.5,
                    year=None,
                    entity=None
                )
        
        # Unknown
        return ColumnInfo(
            index=col_idx,
            column_type=ColumnType.UNKNOWN,
            header_text=header_text,
            confidence=0.3
        )
    
    def _column_is_numeric(
        self,
        col_idx: int,
        data_sample: List[List[str]]
    ) -> bool:
        """
        Check if a column contains primarily numeric data.
        
        Args:
            col_idx: Column index
            data_sample: Sample of data rows
        
        Returns:
            True if column is primarily numeric
        """
        numeric_count = 0
        total_count = 0
        
        for row in data_sample:
            if col_idx < len(row):
                cell = str(row[col_idx]).strip()
                if cell:
                    total_count += 1
                    # Check if looks like a number
                    # (digits, commas, periods, brackets, dashes)
                    if re.search(r'[\d,.\(\)\-]', cell):
                        numeric_count += 1
        
        if total_count == 0:
            return False
        
        return (numeric_count / total_count) >= 0.7
    
    def _resolve_year_ordering(
        self,
        column_info: Dict[int, ColumnInfo]
    ) -> Dict[int, ColumnInfo]:
        """
        Resolve Year1 vs Year2 for columns.
        
        Year1 = most recent year
        Year2 = previous year
        
        Args:
            column_info: Initial column interpretation
        
        Returns:
            Updated column_info with Year1/Year2 resolved
        """
        # Extract all years found
        years_found = set()
        for info in column_info.values():
            if info.year:
                years_found.add(info.year)
        
        if len(years_found) >= 2:
            years_sorted = sorted(years_found, reverse=True)
            year1 = years_sorted[0]  # Most recent
            year2 = years_sorted[1]  # Previous
        elif len(years_found) == 1:
            # Only one year found explicitly
            year1 = list(years_found)[0]
            year2 = year1 - 1  # Assume previous year
        else:
            # No years found - use column position
            # Typically: Year1 appears before Year2 (left to right)
            year1 = None
            year2 = None
        
        # Update column types
        for col_idx, info in column_info.items():
            if info.column_type == ColumnType.UNKNOWN:
                # Try to determine Bank/Group if not already set
                if not info.entity:
                    # Use heuristic: columns tend to be in order Bank, Group
                    # or first numeric columns are Bank
                    info.entity = self._infer_entity(col_idx, column_info)
                
                # Determine Year1 vs Year2
                if info.year:
                    is_year1 = (info.year == year1)
                else:
                    # Use column position: typically Year1 before Year2
                    is_year1 = self._infer_year_from_position(col_idx, column_info)
                
                # Set column type
                if info.entity == 'Bank':
                    info.column_type = ColumnType.BANK_YEAR1 if is_year1 else ColumnType.BANK_YEAR2
                elif info.entity == 'Group':
                    info.column_type = ColumnType.GROUP_YEAR1 if is_year1 else ColumnType.GROUP_YEAR2
                else:
                    # Still unknown
                    info.column_type = ColumnType.UNKNOWN
        
        return column_info
    
    def _infer_entity(
        self,
        col_idx: int,
        column_info: Dict[int, ColumnInfo]
    ) -> Optional[str]:
        """Infer entity (Bank/Group) from context."""
        # Collect known entities
        entities_before = []
        for idx in range(col_idx):
            if idx in column_info and column_info[idx].entity:
                entities_before.append(column_info[idx].entity)
        
        # If previous columns are Bank, likely Bank
        # Else could be Group
        # Typical pattern: Bank Year1, Bank Year2, Group Year1, Group Year2
        # or: Bank Year1, Group Year1, Bank Year2, Group Year2
        
        if 'Bank' in entities_before and 'Group' not in entities_before:
            # We've seen Bank but not Group yet - could be Group now
            return 'Group'
        elif 'Bank' not in entities_before:
            # Haven't seen Bank yet - likely Bank
            return 'Bank'
        else:
            # Mixed - check pattern
            return None
    
    def _infer_year_from_position(
        self,
        col_idx: int,
        column_info: Dict[int, ColumnInfo]
    ) -> bool:
        """Infer if column is Year1 (True) or Year2 (False) from position."""
        # Count how many value columns we've seen before this one
        value_cols_before = 0
        for idx in range(col_idx):
            if idx in column_info:
                col_type = column_info[idx].column_type
                if col_type in [
                    ColumnType.BANK_YEAR1,
                    ColumnType.BANK_YEAR2,
                    ColumnType.GROUP_YEAR1,
                    ColumnType.GROUP_YEAR2,
                    ColumnType.UNKNOWN
                ]:
                    value_cols_before += 1
        
        # Typical pattern: odd positions (1st, 3rd) are Year1
        #                  even positions (2nd, 4th) are Year2
        return (value_cols_before % 2) == 0
    
    def get_columns_by_type(
        self,
        column_info: Dict[int, ColumnInfo],
        column_type: ColumnType
    ) -> List[int]:
        """Get list of column indices matching a specific type."""
        return [
            idx for idx, info in column_info.items()
            if info.column_type == column_type
        ]
    
    def get_value_column_mapping(
        self,
        column_info: Dict[int, ColumnInfo]
    ) -> Dict[str, int]:
        """
        Get mapping of semantic names to column indices.
        
        Returns:
            Dictionary like:
            {
                'Bank_Year1': 1,
                'Bank_Year2': 2,
                'Group_Year1': 3,
                'Group_Year2': 4
            }
        """
        mapping = {}
        
        for col_type in [
            ColumnType.BANK_YEAR1,
            ColumnType.BANK_YEAR2,
            ColumnType.GROUP_YEAR1,
            ColumnType.GROUP_YEAR2
        ]:
            cols = self.get_columns_by_type(column_info, col_type)
            if cols:
                # Use first matching column
                key = col_type.value.replace('_', '_').title().replace(' ', '')
                # Convert to format like Bank_Year1
                key_parts = key.split('_')
                if len(key_parts) >= 2:
                    key = f"{key_parts[0].capitalize()}_{key_parts[1].capitalize()}"
                else:
                    key = col_type.name
                
                mapping[col_type.name.replace('_', ' ').title().replace(' ', '_')] = cols[0]
        
        return mapping
