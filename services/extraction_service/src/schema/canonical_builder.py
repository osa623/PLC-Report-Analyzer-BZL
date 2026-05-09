"""
Canonical Builder
Builds canonical JSON output matching target schema
"""

from typing import Dict, Any, Optional


class CanonicalBuilder:
    """Build canonical JSON output from extraction results."""
    
    def __init__(self):
        """Initialize canonical builder."""
        self.template = {
            'Bank': {
                'Year1': {
                    'Income_Statement': {},
                    'Financial Position Statement': {},
                    'Cash Flow Statement': {}
                },
                'Year2': {
                    'Income_Statement': {},
                    'Financial Position Statement': {},
                    'Cash Flow Statement': {}
                }
            },
            'Group': {
                'Year1': {
                    'Income_Statement': {},
                    'Financial Position Statement': {},
                    'Cash Flow Statement': {}
                },
                'Year2': {
                    'Income_Statement': {},
                    'Financial Position Statement': {},
                    'Cash Flow Statement': {}
                }
            }
        }
    
    def build(self, extraction_results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build canonical output from extraction results.
        
        Args:
            extraction_results: Stage B extraction results with statement data
        
        Returns:
            Canonical JSON matching target_schema_bank.py structure:
            {Bank: {Year1: {statements}, Year2: {statements}}, 
             Group: {Year1: {statements}, Year2: {statements}}}
        """
        import copy
        from datetime import datetime
        
        output = copy.deepcopy(self.template)
        
        # Determine years from the data
        all_years = set()
        for statement_type, statement_data in extraction_results.items():
            if isinstance(statement_data, dict):
                column_info = statement_data.get('column_info', {})
                year_cols = column_info.get('year_cols', {})
                all_years.update(year_cols.values())
        
        # Sort years to determine Year1 (newer) and Year2 (older)
        sorted_years = sorted(list(all_years), reverse=True)  # Descending: [2024, 2023]
        year_mapping = {}
        if len(sorted_years) >= 2:
            year_mapping[sorted_years[0]] = 'Year1'  # 2024 -> Year1 (current year)
            year_mapping[sorted_years[1]] = 'Year2'  # 2023 -> Year2 (previous year)
        elif len(sorted_years) == 1:
            year_mapping[sorted_years[0]] = 'Year1'
        
        # Process each statement
        for statement_type, statement_data in extraction_results.items():
            if not isinstance(statement_data, dict):
                continue
            
            rows = statement_data.get('rows', [])
            
            for row in rows:
                canonical_label = row.get('canonical_label')
                if not canonical_label:
                    continue
                
                values = row.get('values', {})
                
                # Distribute values to Bank/Group and Year1/Year2
                for value_key, value in values.items():
                    # Parse key like "Bank_2024" or "Group_2023"
                    parts = value_key.split('_')
                    if len(parts) != 2:
                        continue
                    
                    entity = parts[0]  # 'Bank' or 'Group'
                    year = int(parts[1]) if parts[1].isdigit() else None
                    
                    if not year or entity not in ['Bank', 'Group']:
                        continue
                    
                    # Map actual year to Year1/Year2
                    year_label = year_mapping.get(year)
                    if not year_label:
                        continue
                    
                    # Set value in output structure
                    if year_label in output[entity] and statement_type in output[entity][year_label]:
                        output[entity][year_label][statement_type][canonical_label] = value
        
        # Add metadata with year information for clarity
        metadata = {
            'extraction_date': datetime.now().strftime('%Y-%m-%d'),
            'schema_version': '1.0',
            'years': {
                'Year1': sorted_years[0] if len(sorted_years) >= 1 else None,
                'Year2': sorted_years[1] if len(sorted_years) >= 2 else None
            }
        }
        
        # Create clean output without empty sections
        clean_output = {
            'metadata': metadata,
            'Bank': {},
            'Group': {}
        }
        
        # Only include years that have data
        for entity in ['Bank', 'Group']:
            for year in ['Year1', 'Year2']:
                year_data = output[entity][year]
                # Check if any statement has data
                has_data = any(len(stmt_data) > 0 for stmt_data in year_data.values())
                if has_data:
                    clean_output[entity][year] = year_data
        
        return clean_output
