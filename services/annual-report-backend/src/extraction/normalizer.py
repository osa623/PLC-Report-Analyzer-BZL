"""Value normalizer module."""

import re
import pandas as pd
from typing import Optional, Any, Dict, List, Tuple
from src.utils.logger import get_logger

logger = get_logger(__name__)


class ValueNormalizer:
    """Normalize extracted values."""
    
    def __init__(self, target_currency: str = 'LKR', target_unit: str = 'thousands'):
        """
        Initialize value normalizer.
        
        Args:
            target_currency: Target currency for normalization
            target_unit: Target unit for normalization
        """
        self.target_currency = target_currency
        self.target_unit = target_unit
        
        self.unit_multipliers = {
            'ones': 1,
            'thousands': 1_000,
            'millions': 1_000_000,
            'billions': 1_000_000_000
        }
        
        logger.info(f"Initialized ValueNormalizer: {target_currency} {target_unit}")
    
    def normalize_value(
        self, 
        value: float, 
        source_unit: Optional[str] = None
    ) -> Optional[float]:
        """
        Normalize value to target unit.
        
        Args:
            value: Value to normalize
            source_unit: Unit of source value
        
        Returns:
            Normalized value
        """
        if value is None:
            return None
        
        try:
            if source_unit and source_unit in self.unit_multipliers:
                # Convert to ones
                value_in_ones = value * self.unit_multipliers[source_unit]
                
                # Convert to target unit
                normalized = value_in_ones / self.unit_multipliers[self.target_unit]
                
                return round(normalized, 2)
            
            # If no source unit specified, assume it's already in target unit
            return round(value, 2)
            
        except Exception as e:
            logger.error(f"Error normalizing value: {str(e)}")
            return value
    
    def normalize_dataset(
        self, 
        data: dict, 
        source_unit: Optional[str] = None
    ) -> dict:
        """
        Normalize all values in a dataset.
        
        Args:
            data: Dictionary of field names to values
            source_unit: Unit of source values
        
        Returns:
            Normalized dataset
        """
        normalized = {}
        
        for key, value in data.items():
            if isinstance(value, (int, float)):
                normalized[key] = self.normalize_value(value, source_unit)
            else:
                normalized[key] = value
        
        logger.info(f"Normalized {len(normalized)} values")
        return normalized


class StrictFinancialExtractor:
    """Strict extraction: separates Bank/Group, maps Year1/Year2 per ARCHITECTURE.md."""
    
    def __init__(self, fuzzy_threshold: float = 85.0):
        from config.target_schema_bank import TARGET_FIELDS
        self.fuzzy_threshold = fuzzy_threshold
        self.target_fields = TARGET_FIELDS
        logger.info(f"StrictFinancialExtractor initialized (threshold={fuzzy_threshold})")
    
    def identify_entity_columns(self, df: pd.DataFrame) -> Dict[str, List[str]]:
        """Identify Bank vs Group columns."""
        columns, bank_cols, group_cols = df.columns.tolist(), [], []
        for col in columns:
            col_lower = str(col).lower()
            if any(s in col_lower for s in ['description', 'particular', 'item', '']):
                continue
            if 'bank' in col_lower and 'group' not in col_lower:
                bank_cols.append(col)
            elif 'group' in col_lower or 'consolidated' in col_lower:
                group_cols.append(col)
        return {'Bank': bank_cols, 'Group': group_cols}
    
    def map_columns_to_years(self, columns: List[str]) -> Dict[str, str]:
        """Map columns to Year1 (recent) and Year2 (previous)."""
        column_years = [(col, int(m.group())) for col in columns if (m := re.search(r'20\d{2}', str(col)))]
        column_years.sort(key=lambda x: x[1], reverse=True)
        return {col: 'Year1' if idx == 0 else 'Year2' for idx, (col, _) in enumerate(column_years[:2])}
    
    def extract_from_table(self, df: pd.DataFrame, statement_name: str) -> Dict:
        """Extract from table with Bank/Group + Year1/Year2 separation."""
        from src.utils.helpers import fuzzy_match, extract_numbers
        
        entity_cols = self.identify_entity_columns(df)
        bank_mapping = self.map_columns_to_years(entity_cols.get('Bank', []))
        group_mapping = self.map_columns_to_years(entity_cols.get('Group', []))
        
        result = {'Bank': {'Year1': {}, 'Year2': {}}, 'Group': {'Year1': {}, 'Year2': {}}}
        schema_fields = self.target_fields.get('Year1', {}).get(statement_name, [])
        
        if not schema_fields:
            return result
        
        for _, row in df.iterrows():
            item = str(row.iloc[0]).strip()
            if not item or item.lower() in ['', 'nan', 'none']:
                continue
            
            best_match, best_score = None, 0
            for field in schema_fields:
                if (score := fuzzy_match(item, field)) > best_score:
                    best_score, best_match = score, field
            
            if best_match and best_score >= self.fuzzy_threshold:
                for col, year in bank_mapping.items():
                    if col in row.index and (val := self._extract_num(row[col])) is not None:
                        result['Bank'][year][best_match] = val
                for col, year in group_mapping.items():
                    if col in row.index and (val := self._extract_num(row[col])) is not None:
                        result['Group'][year][best_match] = val
        return result
    
    def extract(self, sections_data: Dict) -> Tuple[Dict, Dict]:
        """Main extraction: returns (bank_data, group_data)."""
        merged = {'Bank': {'Year1': {}, 'Year2': {}}, 'Group': {'Year1': {}, 'Year2': {}}}
        
        for statement, tables in sections_data.items():
            for table_df in tables:
                extracted = self.extract_from_table(table_df, statement)
                for entity in ['Bank', 'Group']:
                    for year in ['Year1', 'Year2']:
                        merged[entity][year].update(extracted.get(entity, {}).get(year, {}))
        
        return self._populate_schema(merged, 'Bank'), self._populate_schema(merged, 'Group')
    
    def _populate_schema(self, data: Dict, entity: str) -> Dict:
        """Populate complete schema with nulls for missing fields."""
        output = {}
        for year in ['Year1', 'Year2']:
            output[year] = {}
            for stmt, fields in self.target_fields.get('Year1', {}).items():
                output[year][stmt] = {f: data.get(entity, {}).get(year, {}).get(f) for f in fields}
        return output
    
    def _extract_num(self, value: Any) -> Optional[float]:
        """Extract numeric value from cell."""
        from src.utils.helpers import extract_numbers
        if pd.isna(value) or str(value).strip().lower() in ['', '-', 'n/a', 'nil']:
            return None
        nums = extract_numbers(str(value).strip())
        return nums[0] if nums else None
