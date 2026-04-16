"""
ML-based Document Classifier
Identifies financial statement types from PDF pages using NLP and pattern recognition
"""

import re
from typing import List, Dict, Tuple
from collections import Counter
import numpy as np

class DocumentClassifier:
    """Classifies document pages into financial statement types using ML techniques"""
    
    # Statement type indicators with weighted importance
    STATEMENT_SIGNATURES = {
        "Income_Statement": {
            "primary_keywords": [
                "income statement", "statement of comprehensive income", 
                "profit and loss", "statement of income", "statement of profit"
            ],
            "secondary_keywords": [
                "gross income", "interest income", "net interest income",
                "operating income", "profit before tax", "earnings per share",
                "revenue", "total income", "fee and commission"
            ],
            "exclusion_keywords": ["balance sheet", "cash flow", "equity"]
        },
        "Financial_Position_Statement": {
            "primary_keywords": [
                "statement of financial position",
                "statement of position", "financial position"
            ],
            "secondary_keywords": [
                "total assets", "total liabilities", "total equity",
                "loans and advances", "due to depositors", "property plant and equipment",
                "intangible assets", "deferred tax", "subordinated"
            ],
            "exclusion_keywords": ["cash flow", "income", "profit", "revenue"]
        },
        "Cash_Flow_Statement": {
            "primary_keywords": [
                "statement of cash flows", "cash flow statement",
                "statement of cash flow", "cashflow statement"
            ],
            "secondary_keywords": [
                "cash flows from operating", "cash flows from investing",
                "cash flows from financing", "net cash generated",
                "operating activities", "investing activities", "financing activities"
            ],
            "exclusion_keywords": ["balance sheet", "income statement"]
        }
    }
    
    def __init__(self):
        """Initialize the classifier"""
        self.min_confidence = 0.6
        
    def classify_page(self, text: str, page_num: int) -> Tuple[str, float]:
        """
        Classify a page into a financial statement type
        
        Args:
            text: Extracted text from the page
            page_num: Page number for context
            
        Returns:
            Tuple of (statement_type, confidence_score)
        """
        if not text or len(text.strip()) < 50:
            return None, 0.0
            
        text_lower = text.lower()
        scores = {}
        
        for statement_type, signatures in self.STATEMENT_SIGNATURES.items():
            score = self._calculate_score(text_lower, signatures)
            scores[statement_type] = score
            
        # Get best match
        if not scores:
            return None, 0.0
            
        best_type = max(scores, key=scores.get)
        best_score = scores[best_type]
        
        if best_score < self.min_confidence:
            return None, best_score
            
        return best_type, best_score
    
    def _calculate_score(self, text: str, signatures: Dict) -> float:
        """Calculate confidence score for a statement type"""
        score = 0.0
        
        # Check primary keywords (high weight)
        primary_matches = sum(1 for kw in signatures["primary_keywords"] 
                             if kw in text)
        if primary_matches > 0:
            score += 0.5
            
        # Check secondary keywords (medium weight)
        secondary_matches = sum(1 for kw in signatures["secondary_keywords"] 
                               if kw in text)
        secondary_score = min(secondary_matches / len(signatures["secondary_keywords"]), 0.4)
        score += secondary_score
        
        # Penalty for exclusion keywords
        exclusion_matches = sum(1 for kw in signatures["exclusion_keywords"] 
                               if kw in text)
        if exclusion_matches > 0:
            score -= 0.2 * exclusion_matches
            
        return max(0.0, min(1.0, score))
    
    def find_statement_pages(self, pages_text: Dict[int, str]) -> Dict[str, List[int]]:
        """
        Find all pages for each statement type
        
        Args:
            pages_text: Dictionary mapping page numbers to extracted text
            
        Returns:
            Dictionary mapping statement types to list of page numbers
        """
        results = {
            "Income_Statement": [],
            "Financial_Position_Statement": [],
            "Cash_Flow_Statement": []
        }
        
        for page_num, text in pages_text.items():
            stmt_type, confidence = self.classify_page(text, page_num)
            
            if stmt_type and confidence >= self.min_confidence:
                results[stmt_type].append((page_num, confidence))
        
        # Sort by confidence and return page numbers
        for stmt_type in results:
            results[stmt_type] = [page for page, conf in 
                                 sorted(results[stmt_type], key=lambda x: x[1], reverse=True)]
            
        return results
    
    def validate_statement_sequence(self, page_ranges: Dict[str, List[int]]) -> Dict[str, List[int]]:
        """
        Validate and refine page ranges to ensure logical sequences
        
        Args:
            page_ranges: Initial page ranges for each statement
            
        Returns:
            Validated and refined page ranges
        """
        validated = {}
        
        for stmt_type, pages in page_ranges.items():
            if not pages:
                validated[stmt_type] = []
                continue
                
            # Group consecutive pages
            sequences = self._group_consecutive(pages)
            
            # Take the longest sequence (most likely to be complete)
            if sequences:
                validated[stmt_type] = max(sequences, key=len)
            else:
                validated[stmt_type] = pages[:2]  # Fallback to first 2 pages
                
        return validated
    
    def _group_consecutive(self, pages: List[int]) -> List[List[int]]:
        """Group consecutive page numbers into sequences"""
        if not pages:
            return []
            
        sequences = []
        current_seq = [pages[0]]
        
        for i in range(1, len(pages)):
            if pages[i] == current_seq[-1] + 1:
                current_seq.append(pages[i])
            else:
                sequences.append(current_seq)
                current_seq = [pages[i]]
                
        sequences.append(current_seq)
        return sequences
