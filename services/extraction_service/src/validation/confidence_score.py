"""Confidence score calculation module."""

from typing import Dict, Any, List
from src.utils.logger import get_logger

logger = get_logger(__name__)


class ConfidenceScorer:
    """Calculate confidence scores for extracted data."""
    
    def __init__(self):
        """Initialize confidence scorer."""
        logger.info("Initialized ConfidenceScorer")
    
    def calculate_field_confidence(
        self, 
        field_name: str, 
        value: Any, 
        metadata: Dict[str, Any]
    ) -> float:
        """
        Calculate confidence score for a single field.
        
        Args:
            field_name: Name of the field
            value: Extracted value
            metadata: Additional metadata (OCR confidence, matching score, etc.)
        
        Returns:
            Confidence score (0.0 to 1.0)
        """
        confidence = 0.0
        
        # Base confidence if value exists
        if value is not None:
            confidence = 0.5
        else:
            return 0.0
        
        # Add confidence from OCR if available
        ocr_confidence = metadata.get('ocr_confidence', 0)
        if ocr_confidence > 0:
            confidence += (ocr_confidence / 100) * 0.2  # Max 0.2 boost
        
        # Add confidence from fuzzy matching if available
        match_score = metadata.get('match_score', 0)
        if match_score > 0:
            confidence += (match_score / 100) * 0.2  # Max 0.2 boost
        
        # Add confidence if value is reasonable (non-zero)
        if isinstance(value, (int, float)) and value != 0:
            confidence += 0.1
        
        # Cap at 1.0
        confidence = min(confidence, 1.0)
        
        return round(confidence, 2)
    
    def calculate_statement_confidence(
        self, 
        data: Dict[str, Any], 
        metadata: Dict[str, Dict[str, Any]]
    ) -> float:
        """
        Calculate overall confidence for a statement.
        
        Args:
            data: Extracted data for the statement
            metadata: Metadata for each field
        
        Returns:
            Overall confidence score (0.0 to 1.0)
        """
        if not data:
            return 0.0
        
        field_confidences = []
        
        for field_name, value in data.items():
            field_metadata = metadata.get(field_name, {})
            confidence = self.calculate_field_confidence(
                field_name, value, field_metadata
            )
            field_confidences.append(confidence)
        
        # Average confidence
        if field_confidences:
            avg_confidence = sum(field_confidences) / len(field_confidences)
        else:
            avg_confidence = 0.0
        
        return round(avg_confidence, 2)
    
    def calculate_completeness(
        self, 
        extracted_data: Dict[str, Any], 
        expected_fields: List[str]
    ) -> float:
        """
        Calculate completeness score based on expected fields.
        
        Args:
            extracted_data: Extracted data
            expected_fields: List of expected field names
        
        Returns:
            Completeness score (0.0 to 1.0)
        """
        if not expected_fields:
            return 1.0
        
        found_fields = 0
        for field in expected_fields:
            if field in extracted_data and extracted_data[field] is not None:
                found_fields += 1
        
        completeness = found_fields / len(expected_fields)
        return round(completeness, 2)
    
    def calculate_overall_confidence(
        self, 
        all_data: Dict[str, Dict[str, Any]], 
        all_metadata: Dict[str, Dict[str, Dict[str, Any]]],
        validation_results: Dict[str, bool]
    ) -> Dict[str, Any]:
        """
        Calculate overall confidence scores for all statements.
        
        Args:
            all_data: All extracted data
            all_metadata: All metadata
            validation_results: Validation results
        
        Returns:
            Dictionary with confidence scores
        """
        scores = {}
        
        for statement_type, data in all_data.items():
            metadata = all_metadata.get(statement_type, {})
            
            # Statement confidence
            statement_confidence = self.calculate_statement_confidence(data, metadata)
            
            # Validation boost
            validation_passed = validation_results.get(statement_type, False)
            if validation_passed:
                statement_confidence = min(statement_confidence + 0.1, 1.0)
            
            scores[statement_type] = {
                'confidence': statement_confidence,
                'field_count': len(data),
                'validated': validation_passed
            }
        
        # Overall confidence
        if scores:
            overall = sum(s['confidence'] for s in scores.values()) / len(scores)
            scores['overall'] = round(overall, 2)
        else:
            scores['overall'] = 0.0
        
        logger.info(f"Calculated confidence scores: Overall={scores.get('overall', 0)}")
        
        return scores
