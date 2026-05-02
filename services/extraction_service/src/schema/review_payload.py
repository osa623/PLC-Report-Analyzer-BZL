"""
Review Payload Builder
Builds review payload for manual review UI
"""

from typing import Dict, Any, List


class ReviewPayloadBuilder:
    """Build review payload with all necessary information for human review."""
    
    def __init__(self):
        """Initialize review payload builder."""
        pass
    
    def build(
        self,
        page_locations: Dict[str, Any],
        extraction_results: Dict[str, Any],
        canonical_output: Dict[str, Any],
        validation_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Build complete review payload.
        
        Args:
            page_locations: Stage A page location results
            extraction_results: Stage B extraction results
            canonical_output: Canonical JSON output
            validation_results: Validation results
        
        Returns:
            Review payload with all metadata
        """
        payload = {
            'review_required': validation_results.get('needs_review', False),
            'confidence_summary': self._build_confidence_summary(extraction_results),
            'validation_summary': validation_results,
            'statement_details': {},
            'mapping_decisions': [],
            'extraction_warnings': []
        }
        
        # Add per-statement details
        for statement_type, locations in page_locations.items():
            if locations:
                best_location = locations[0] if isinstance(locations, list) else locations
                payload['statement_details'][statement_type] = {
                    'pages_used': best_location.get('page_range') if isinstance(best_location, dict) else None,
                    'location_confidence': best_location.get('confidence') if isinstance(best_location, dict) else None,
                    'extraction_status': extraction_results.get(statement_type, {}).get('status', 'PENDING')
                }
        
        return payload
    
    def _build_confidence_summary(self, extraction_results: Dict[str, Any]) -> Dict[str, Any]:
        """Build overall confidence summary."""
        return {
            'overall': 0.0,
            'by_statement': {}
        }
