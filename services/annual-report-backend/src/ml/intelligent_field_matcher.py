"""
Intelligent Field Matcher using NLP and Fuzzy Matching
Maps extracted text fields to target schema fields using semantic similarity
"""

from typing import List, Dict, Tuple, Optional
from difflib import SequenceMatcher
import re
from collections import defaultdict

class IntelligentFieldMatcher:
    """Matches extracted fields to target schema using ML techniques"""
    
    def __init__(self, target_schema: Dict[str, List[str]]):
        """
        Initialize matcher with target schema
        
        Args:
            target_schema: Dictionary mapping statement types to field lists
        """
        self.target_schema = target_schema
        self.field_aliases = self._build_field_aliases()
        self.min_similarity = 0.6
        
    def _build_field_aliases(self) -> Dict[str, List[str]]:
        """Build common aliases and variations for each target field"""
        aliases = {}
        
        # Common variations and synonyms
        variations = {
            "income": ["revenue", "revenues", "income", "incomes"],
            "expense": ["expenses", "expenditure", "costs", "cost"],
            "profit": ["profit", "surplus", "earnings", "gain"],
            "loss": ["loss", "losses", "deficit"],
            "assets": ["asset", "assets"],
            "liabilities": ["liability", "liabilities"],
            "equity": ["equity", "capital"],
            "cash": ["cash", "liquid funds"],
            "operating": ["operations", "operational", "operating"],
            "interest": ["interest", "interests"],
            "fee": ["fee", "fees"],
            "commission": ["commission", "commissions"],
            "tax": ["tax", "taxes", "taxation"],
            "net": ["net", "nett"],
            "gross": ["gross"],
            "total": ["total", "sum", "aggregate"]
        }
        
        for statement_type, fields in self.target_schema.items():
            for field in fields:
                field_lower = field.lower()
                aliases[field] = [field_lower]
                
                # Add variations
                for key, vars in variations.items():
                    if key in field_lower:
                        for var in vars:
                            alias = field_lower.replace(key, var)
                            if alias not in aliases[field]:
                                aliases[field].append(alias)
                                
        return aliases
    
    def match_field(self, extracted_text: str, statement_type: str) -> Tuple[Optional[str], float]:
        """
        Match extracted text to the best target field
        
        Args:
            extracted_text: Text extracted from PDF
            statement_type: Type of financial statement
            
        Returns:
            Tuple of (matched_field, confidence_score)
        """
        if statement_type not in self.target_schema:
            return None, 0.0
            
        extracted_clean = self._clean_text(extracted_text)
        target_fields = self.target_schema[statement_type]
        
        best_match = None
        best_score = 0.0
        
        for target_field in target_fields:
            score = self._calculate_similarity(extracted_clean, target_field)
            
            if score > best_score:
                best_score = score
                best_match = target_field
                
        if best_score < self.min_similarity:
            return None, best_score
            
        return best_match, best_score
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text for matching"""
        if not text:
            return ""
            
        # Convert to lowercase
        text = text.lower()
        
        # Remove special characters but keep spaces and slashes
        text = re.sub(r'[^\w\s/()-]', '', text)
        
        # Normalize whitespace
        text = ' '.join(text.split())
        
        # Remove common prefixes/suffixes
        text = re.sub(r'\b(note|notes|total|sub-total)\b', '', text)
        text = text.strip()
        
        return text
    
    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """
        Calculate semantic similarity between two texts
        Uses multiple techniques for robust matching
        """
        text1_clean = self._clean_text(text1)
        text2_clean = self._clean_text(text2)
        
        if not text1_clean or not text2_clean:
            return 0.0
        
        # 1. Exact match
        if text1_clean == text2_clean:
            return 1.0
            
        # 2. One contains the other
        if text1_clean in text2_clean or text2_clean in text1_clean:
            return 0.95
            
        # 3. Check aliases
        if text2 in self.field_aliases:
            for alias in self.field_aliases[text2]:
                if text1_clean == alias or text1_clean in alias or alias in text1_clean:
                    return 0.9
        
        # 4. Fuzzy string matching
        ratio = SequenceMatcher(None, text1_clean, text2_clean).ratio()
        
        # 5. Token-based matching
        tokens1 = set(text1_clean.split())
        tokens2 = set(text2_clean.split())
        
        if tokens1 and tokens2:
            token_overlap = len(tokens1 & tokens2) / max(len(tokens1), len(tokens2))
            # Combine fuzzy and token matching
            score = (ratio * 0.6) + (token_overlap * 0.4)
        else:
            score = ratio
            
        return score
    
    def match_multiple_fields(self, extracted_fields: List[str], 
                             statement_type: str) -> Dict[str, Tuple[str, float]]:
        """
        Match multiple extracted fields to target schema
        
        Args:
            extracted_fields: List of extracted field names
            statement_type: Type of financial statement
            
        Returns:
            Dictionary mapping target fields to (extracted_field, confidence)
        """
        matches = {}
        used_extracted = set()
        
        # First pass: find high-confidence matches
        for extracted in extracted_fields:
            target_field, confidence = self.match_field(extracted, statement_type)
            
            if target_field and confidence >= 0.8:
                if target_field not in matches or confidence > matches[target_field][1]:
                    matches[target_field] = (extracted, confidence)
                    used_extracted.add(extracted)
        
        # Second pass: match remaining fields with lower threshold
        for extracted in extracted_fields:
            if extracted in used_extracted:
                continue
                
            target_field, confidence = self.match_field(extracted, statement_type)
            
            if target_field and confidence >= self.min_similarity:
                if target_field not in matches:
                    matches[target_field] = (extracted, confidence)
                    
        return matches
    
    def suggest_missing_fields(self, matched_fields: List[str], 
                              statement_type: str) -> List[str]:
        """
        Identify important fields that are missing from extraction
        
        Args:
            matched_fields: List of successfully matched fields
            statement_type: Type of financial statement
            
        Returns:
            List of missing important fields
        """
        if statement_type not in self.target_schema:
            return []
            
        all_target_fields = set(self.target_schema[statement_type])
        matched_set = set(matched_fields)
        missing = all_target_fields - matched_set
        
        # Priority fields that should always be present
        priority_keywords = {
            "Income_Statement": ["total", "profit", "income", "revenue", "tax"],
            "Financial_Position_Statement": ["total assets", "total liabilities", "equity"],
            "Cash_Flow_Statement": ["net cash", "operating activities", "investing activities"]
        }
        
        priority_missing = []
        if statement_type in priority_keywords:
            for field in missing:
                field_lower = field.lower()
                if any(kw in field_lower for kw in priority_keywords[statement_type]):
                    priority_missing.append(field)
                    
        return priority_missing
