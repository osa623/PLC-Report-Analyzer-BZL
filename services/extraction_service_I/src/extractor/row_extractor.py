"""
Row Extractor
Extracts rows from tables with label mapping and value normalization.
"""

from typing import List, Dict, Any
from .numeric_normalizer import NumericNormalizer
from ..mapper.mapping_engine import MappingEngine


class RowExtractor:
    """Extract and process rows from table data."""
    
    def __init__(self):
        """Initialize row extractor."""
        self.normalizer = NumericNormalizer()
        self.mapper = MappingEngine()
    
    def extract_rows(
        self,
        table_data: Dict[str, Any],
        column_info: Dict,
        statement_type: str
    ) -> List[Dict[str, Any]]:
        """
        Extract rows from table with label mapping and value extraction.
        
        Args:
            table_data: Table data dictionary with 'rows'
            column_info: Column interpretation (entity_cols, year_cols)
            statement_type: Type of financial statement
        
        Returns:
            List of extracted row dictionaries
        """
        rows = table_data.get('rows', [])
        if len(rows) < 3:
            return []
        
        # Skip header rows (first 2-3 rows)
        data_rows = rows[3:]
        
        extracted_rows = []
        
        for row in data_rows:
            if not row or len(row) < 2:
                continue
            
            # First column is the label
            label = str(row[0]).strip() if row[0] else ''
            if not label or len(label) < 3:
                continue
            
            # Map label to canonical form
            mapped = self.mapper.map_label(label, statement_type)
            if not mapped or mapped.confidence < 0.5:
                continue
            
            # Extract values for each column
            row_data = {
                'original_label': label,
                'canonical_label': mapped.canonical_key,
                'confidence': mapped.confidence,
                'values': {}
            }
            
            # Extract values for Bank/Group and Year columns
            entity_cols = column_info.get('entity_cols', {})
            year_cols = column_info.get('year_cols', {})
            
            for col_idx in range(1, len(row)):
                value_str = str(row[col_idx]).strip() if row[col_idx] else ''
                if not value_str or value_str in ['-', '—', 'N/A']:
                    continue
                
                # Normalize the value
                normalized = self.normalizer.normalize(value_str)
                
                # Extract the numeric value from NumericValue dataclass
                if hasattr(normalized, 'normalized_value'):
                    numeric_value = normalized.normalized_value
                else:
                    numeric_value = normalized
                
                # Determine entity and year for this column
                entity = entity_cols.get(col_idx, 'Unknown')
                year = year_cols.get(col_idx, 'Unknown')
                
                key = f"{entity}_{year}"
                row_data['values'][key] = numeric_value
            
            if row_data['values']:
                extracted_rows.append(row_data)
        
        return extracted_rows
