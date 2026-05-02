"""
Page Locator - Stage A of Two-Stage Pipeline
Main orchestrator that combines ToC detection, heading scanning, and layout analysis
to locate financial statement pages with confidence scoring.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import pdfplumber

from .toc_detector import TOCDetector
from .heading_scanner import HeadingScanner
from .layout_analyzer import LayoutAnalyzer


@dataclass
class PageLocationResult:
    """Result of page location for a single statement."""
    statement_type: str
    page_range: List[int]  # [start_page, end_page] (0-indexed)
    confidence: float
    evidence: List[str]
    sources: List[str]  # ['toc', 'heading_scan', 'layout_analysis']
    metadata: Dict[str, Any]


class PageLocator:
    """
    Main orchestrator for Stage A: Page Location.
    
    Combines multiple strategies to find financial statement pages:
    1. Table of Contents detection
    2. Heading/title scanning
    3. Layout signal analysis
    
    Returns ranked candidates with confidence scores.
    """
    
    def __init__(self, min_confidence: float = 0.5):
        """
        Initialize Page Locator.
        
        Args:
            min_confidence: Minimum confidence threshold for candidates
        """
        self.min_confidence = min_confidence
        
        self.toc_detector = TOCDetector()
        self.heading_scanner = HeadingScanner()
        self.layout_analyzer = LayoutAnalyzer()
        
        self.statement_types = [
            'Income_Statement',
            'Financial Position Statement',
            'Cash Flow Statement'
        ]
    
    def locate_statements(
        self,
        pdf_path: str,
        strategies: Optional[List[str]] = None
    ) -> Dict[str, List[PageLocationResult]]:
        """
        Locate all financial statements in a PDF.
        
        Args:
            pdf_path: Path to PDF file
            strategies: List of strategies to use. Options: ['toc', 'heading', 'layout']
                       If None, uses all strategies.
        
        Returns:
            Dictionary mapping statement types to ranked candidates
        """
        if strategies is None:
            strategies = ['toc', 'heading', 'layout']
        
        results = {stmt: [] for stmt in self.statement_types}
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                total_pages = len(pdf.pages)
                
                # Collect candidates from each strategy
                all_candidates = {stmt: [] for stmt in self.statement_types}
                
                # Strategy 1: Table of Contents
                if 'toc' in strategies:
                    toc_results = self.toc_detector.get_statement_pages_from_toc(pdf)
                    for stmt_type, candidates in toc_results.items():
                        all_candidates[stmt_type].extend(candidates)
                    
                    # PERFORMANCE OPTIMIZATION: Early Exit if TOC is successful
                    # If we found high-confidence candidates for ALL statement types, stop here.
                    toc_success = True
                    for stmt_type in self.statement_types:
                        # Check if we have at least one high-confidence candidate
                        has_high_conf = any(c['confidence'] >= 0.9 for c in all_candidates[stmt_type])
                        if not has_high_conf:
                            toc_success = False
                            break
                    
                    if toc_success:
                        print("  [i] TOC detection successful for all statements. Skipping expensive scanning.")
                        # Return results immediately
                        return self._finalize_results(all_candidates, total_pages=total_pages)

                # Strategy 2: Heading Scanning
                if 'heading' in strategies:
                    # Optimize: Only scan first 100 pages and last 50 pages if mostly looking for statements
                    # This avoids scanning 500+ pages of notes
                    total_pages = len(pdf.pages)
                    scan_pages = list(range(min(100, total_pages)))
                    if total_pages > 150:
                        scan_pages.extend(range(total_pages - 50, total_pages))
                    
                    heading_results = self.heading_scanner.scan_pages_for_statements(pdf, page_range=scan_pages)
                    for stmt_type, candidates in heading_results.items():
                        all_candidates[stmt_type].extend(candidates)
                
                
                # Strategy 3: Layout Analysis
                # (This provides generic candidates, we'll match them later)
                layout_results = None
                if 'layout' in strategies:
                    # Reuse scan_pages from heading strategy if available, otherwise define it
                    if 'scan_pages' not in locals():
                        total_pages = len(pdf.pages)
                        scan_pages = list(range(min(100, total_pages)))
                        if total_pages > 150:
                            scan_pages.extend(range(total_pages - 50, total_pages))
                            
                    layout_results = self.layout_analyzer.identify_statement_pages_by_layout(pdf, page_range=scan_pages)
                
                # Use the helper to finalize results
                return self._finalize_results(all_candidates, layout_results, total_pages)
        
        except Exception as e:
            raise RuntimeError(f"Page location failed: {str(e)}")
    
    def _finalize_results(
        self, 
        all_candidates: Dict[str, List[Dict]], 
        layout_results: Optional[Dict] = None,
        total_pages: int = 0
    ) -> Dict[str, List[PageLocationResult]]:
        """
        Finalize candidates by merging, ranking, and converting to result objects.
        """
        results = {stmt: [] for stmt in self.statement_types}
        
        for stmt_type in self.statement_types:
            candidates = all_candidates[stmt_type]
            
            # CRITICAL: If ToC found results with high confidence, ONLY use ToC
            # ToC is most reliable, ignore other methods when ToC succeeds
            toc_candidates = [c for c in candidates if c.get('source') == 'toc']
            if toc_candidates:
                # Use ONLY ToC results when available
                candidates = toc_candidates
                print(f"  [i] Using ToC-based detection for {stmt_type} (most reliable)")
            
            # Merge overlapping candidates
            merged = self._merge_candidates(candidates, total_pages)
            
            # Boost confidence if layout analysis confirms
            if layout_results and 'generic_candidates' in layout_results:
                merged = self._boost_with_layout(merged, layout_results['generic_candidates'])
            
            # PRIORITIZE earlier pages when confidence is similar
            # Main statements typically appear in pages 200-350 for banks
            for candidate in merged:
                page_start = candidate['page_range'][0]
                
                # Boost if in typical statement range
                if 200 <= page_start <= 350:
                    candidate['confidence'] = min(candidate['confidence'] * 1.1, 0.99)
                # Penalize if too late in document (likely appendix/notes)
                elif page_start > 350:
                    candidate['confidence'] *= 0.85
            
            # Convert to PageLocationResult objects
            for candidate in merged:
                if candidate['confidence'] >= self.min_confidence:
                    result = PageLocationResult(
                        statement_type=stmt_type,
                        page_range=candidate['page_range'],
                        confidence=candidate['confidence'],
                        evidence=candidate.get('evidence_list', [candidate.get('evidence', '')]),
                        sources=candidate.get('sources', []),
                        metadata=candidate.get('metadata', {})
                    )
                    results[stmt_type].append(result)
            
            # Sort by confidence (highest first), then by page number (earlier first)
            results[stmt_type].sort(key=lambda x: (x.confidence, -x.page_range[0]), reverse=True)
            
        return results
        

    
    def _merge_candidates(
        self,
        candidates: List[Dict],
        total_pages: int
    ) -> List[Dict]:
        """
        Merge overlapping candidate page ranges and combine evidence.
        
        Args:
            candidates: List of candidate dictionaries
            total_pages: Total pages in PDF
        
        Returns:
            List of merged candidates
        """
        if not candidates:
            return []
        
        # Group by overlapping page ranges
        merged = []
        
        for candidate in candidates:
            page_range = candidate['page_range']
            
            # Check if overlaps with any existing merged candidate
            found_overlap = False
            for merged_candidate in merged:
                merged_range = merged_candidate['page_range']
                
                # Check overlap
                if self._ranges_overlap(page_range, merged_range):
                    # Merge: expand range and combine evidence
                    merged_candidate['page_range'] = [
                        min(page_range[0], merged_range[0]),
                        max(page_range[1], merged_range[1])
                    ]
                    
                    # Increase confidence when multiple sources agree
                    merged_candidate['confidence'] = min(
                        merged_candidate['confidence'] + 0.1,
                        0.95
                    )
                    
                    # Combine evidence
                    if 'evidence_list' not in merged_candidate:
                        merged_candidate['evidence_list'] = [merged_candidate.get('evidence', '')]
                    merged_candidate['evidence_list'].append(candidate.get('evidence', ''))
                    
                    # Track sources
                    if 'sources' not in merged_candidate:
                        merged_candidate['sources'] = []
                    source = candidate.get('source', 'unknown')
                    if source not in merged_candidate['sources']:
                        merged_candidate['sources'].append(source)
                    
                    found_overlap = True
                    break
            
            if not found_overlap:
                # Add as new candidate
                candidate['evidence_list'] = [candidate.get('evidence', '')]
                candidate['sources'] = [candidate.get('source', 'unknown')]
                merged.append(candidate)
        
        return merged
    
    def _ranges_overlap(self, range1: List[int], range2: List[int]) -> bool:
        """Check if two page ranges overlap."""
        return not (range1[1] < range2[0] or range2[1] < range1[0])
    
    def _boost_with_layout(
        self,
        candidates: List[Dict],
        layout_candidates: List[Dict]
    ) -> List[Dict]:
        """
        Boost confidence of candidates that overlap with high layout scores.
        
        Args:
            candidates: Statement-specific candidates
            layout_candidates: Generic high-scoring pages from layout analysis
        
        Returns:
            Candidates with boosted confidence
        """
        for candidate in candidates:
            cand_range = candidate['page_range']
            
            for layout_cand in layout_candidates:
                layout_range = layout_cand['page_range']
                
                if self._ranges_overlap(cand_range, layout_range):
                    # Boost confidence
                    boost = layout_cand['confidence'] * 0.15  # Up to 15% boost
                    candidate['confidence'] = min(
                        candidate['confidence'] + boost,
                        0.98
                    )
                    
                    # Add layout evidence
                    if 'evidence_list' not in candidate:
                        candidate['evidence_list'] = []
                    candidate['evidence_list'].append(
                        f"Layout analysis confirms (score: {layout_cand['confidence']})"
                    )
                    
                    if 'sources' not in candidate:
                        candidate['sources'] = []
                    if 'layout_analysis' not in candidate['sources']:
                        candidate['sources'].append('layout_analysis')
                    
                    break
        
        return candidates
    
    def save_location_results(
        self,
        results: Dict[str, List[PageLocationResult]],
        output_path: str
    ) -> None:
        """
        Save location results to JSON file.
        
        Args:
            results: Location results
            output_path: Path to save JSON
        """
        # Convert to serializable format
        serializable = {}
        for stmt_type, candidates in results.items():
            serializable[stmt_type] = [
                {
                    'statement_type': c.statement_type,
                    'page_range': c.page_range,
                    'confidence': c.confidence,
                    'evidence': c.evidence,
                    'sources': c.sources,
                    'metadata': c.metadata
                }
                for c in candidates
            ]
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w') as f:
            json.dump(serializable, f, indent=2)
    
    def get_best_candidates(
        self,
        results: Dict[str, List[PageLocationResult]],
        top_n: int = 1
    ) -> Dict[str, List[PageLocationResult]]:
        """
        Get top N candidates for each statement type.
        
        Args:
            results: Location results
            top_n: Number of top candidates to return per statement
        
        Returns:
            Dictionary with top candidates
        """
        best = {}
        for stmt_type, candidates in results.items():
            best[stmt_type] = candidates[:top_n]
        
        return best
    
    def print_summary(self, results: Dict[str, List[PageLocationResult]]) -> None:
        """Print a human-readable summary of location results."""
        print("\n" + "="*80)
        print("STAGE A: PAGE LOCATION RESULTS")
        print("="*80 + "\n")
        
        for stmt_type, candidates in results.items():
            print(f"\n{stmt_type}:")
            print("-" * 60)
            
            if not candidates:
                print("  ❌ No candidates found")
                continue
            
            for i, candidate in enumerate(candidates, 1):
                pages_str = f"{candidate.page_range[0]+1}-{candidate.page_range[1]+1}"
                conf_pct = int(candidate.confidence * 100)
                print(f"\n  Candidate #{i}:")
                print(f"    📄 Pages: {pages_str}")
                print(f"    ✅ Confidence: {conf_pct}%")
                print(f"    🔍 Sources: {', '.join(candidate.sources)}")
                print(f"    📋 Evidence:")
                for evidence in candidate.evidence:
                    print(f"       - {evidence}")
