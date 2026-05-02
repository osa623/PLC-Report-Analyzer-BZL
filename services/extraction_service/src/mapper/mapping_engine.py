"""
Mapping Engine - Cascading Row Label Mapping
Orchestrates multi-level matching strategy
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

from config.target_schema_bank import STATEMENT_FIELDS
from config.term_mapping_bank import TERM_MAPPING


@dataclass
class MappingResult:
    """Result of mapping a row label."""
    original_label: str
    canonical_key: Optional[str]
    confidence: float
    match_method: str  # 'exact', 'synonym', 'fuzzy', 'semantic', 'none'
    match_score: float = 1.0


class MappingEngine:
    """
    Cascading mapping engine for row labels.
    
    Strategy:
    1. Exact match (after normalization)
    2. Synonym dictionary lookup
    3. Fuzzy matching (edit distance)
    4. Semantic/LLM matching (optional)
    """
    
    def __init__(self, fuzzy_threshold: float = 85.0):
        """
        Initialize mapping engine.
        
        Args:
            fuzzy_threshold: Minimum fuzzy match score (0-100)
        """
        self.fuzzy_threshold = fuzzy_threshold
        self.term_mapping = TERM_MAPPING
        self.statement_fields = STATEMENT_FIELDS
        
        # Build reverse lookup for all canonical keys
        self.all_canonical_keys = set()
        for fields in self.statement_fields.values():
            self.all_canonical_keys.update(fields)
    
    def map_label(
        self,
        label: str,
        statement_type: str
    ) -> MappingResult:
        """
        Map a single row label to canonical key.
        
        Args:
            label: Raw label from extracted table
            statement_type: Type of statement (for context)
        
        Returns:
            MappingResult with best match
        """
        from rapidfuzz import fuzz
        
        # Normalize label
        normalized_label = self._normalize_label(label)
        
        # Get target fields for this statement
        target_fields = self.statement_fields.get(statement_type, [])
        
        # Strategy 1: Exact match
        for canonical_key in target_fields:
            if self._normalize_label(canonical_key) == normalized_label:
                return MappingResult(
                    original_label=label,
                    canonical_key=canonical_key,
                    confidence=1.0,
                    match_method='exact',
                    match_score=100.0
                )
        
        # Strategy 2: Synonym lookup
        for canonical_key, synonyms in self.term_mapping.items():
            if canonical_key in target_fields:
                for synonym in synonyms:
                    if self._normalize_label(synonym) == normalized_label:
                        return MappingResult(
                            original_label=label,
                            canonical_key=canonical_key,
                            confidence=0.95,
                            match_method='synonym',
                            match_score=95.0
                        )
        
        # Strategy 3: Fuzzy matching
        best_fuzzy_match = None
        best_fuzzy_score = 0.0
        
        for canonical_key in target_fields:
            score = fuzz.ratio(normalized_label, self._normalize_label(canonical_key))
            
            if score > best_fuzzy_score:
                best_fuzzy_score = score
                best_fuzzy_match = canonical_key
            
            # Also check against synonyms
            if canonical_key in self.term_mapping:
                for synonym in self.term_mapping[canonical_key]:
                    score = fuzz.ratio(normalized_label, self._normalize_label(synonym))
                    if score > best_fuzzy_score:
                        best_fuzzy_score = score
                        best_fuzzy_match = canonical_key
        
        if best_fuzzy_score >= self.fuzzy_threshold:
            return MappingResult(
                original_label=label,
                canonical_key=best_fuzzy_match,
                confidence=best_fuzzy_score / 100.0,
                match_method='fuzzy',
                match_score=best_fuzzy_score
            )
        
        # Strategy 4: Semantic matching (stub - would use LLM/embeddings)
        # TODO: Implement semantic matching
        
        # No match found
        return MappingResult(
            original_label=label,
            canonical_key=None,
            confidence=0.0,
            match_method='none',
            match_score=0.0
        )
    
    def _normalize_label(self, label: str) -> str:
        """Normalize label for matching."""
        # Lowercase
        normalized = label.lower()
        
        # Remove extra whitespace
        normalized = ' '.join(normalized.split())
        
        # Remove special characters
        normalized = normalized.replace('/', ' ')
        normalized = normalized.replace('-', ' ')
        normalized = normalized.replace('_', ' ')
        
        # Remove punctuation at end
        normalized = normalized.rstrip('.,;:')
        
        return normalized
    
    def map_all_labels(
        self,
        labels: List[str],
        statement_type: str
    ) -> List[MappingResult]:
        """Map multiple labels."""
        return [self.map_label(label, statement_type) for label in labels]
