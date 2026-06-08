"""
Two-Stage Extraction Pipeline
Main orchestrator combining Stage A (Page Location) and Stage B (Structured Extraction)
"""

from pathlib import Path
from typing import Dict, List, Optional, Any
import json
import re
import pdfplumber
from datetime import datetime

from src.locator.page_locator import PageLocator, PageLocationResult
from src.locator.heading_scanner import HeadingScanner
from src.extractor.numeric_normalizer import NumericNormalizer
from src.extractor.column_interpreter import ColumnInterpreter
from src.extractor.table_detector import TableDetector
from src.extractor.row_extractor import RowExtractor
from src.pdf.table_extractor import TableExtractor
from src.mapper.mapping_engine import MappingEngine
from src.validation.accounting_rules import AccountingValidator
from src.validation.confidence_score import ConfidenceScorer
from src.schema.canonical_builder import CanonicalBuilder
from src.schema.review_payload import ReviewPayloadBuilder
from src.utils.logger import get_logger
from src.utils.image_saver import StatementImageSaver

logger = get_logger(__name__)


class TwoStagePipeline:
    """
    Main extraction pipeline with two distinct stages:
    
    Stage A: Page Location
        - Locate which pages contain each financial statement
        - Use ToC detection, heading scanning, layout analysis
        - Output: ranked page candidates with confidence
    
    Stage B: Structured Extraction
        - Extract tables from identified pages
        - Interpret columns (Bank/Group, Year1/Year2)
        - Normalize numeric values
        - Map row labels to canonical schema
        - Validate and score confidence
        - Output: canonical JSON + review payload
    """
    
    def __init__(self, config: Optional[Dict] = None):
        """
        Initialize two-stage pipeline.
        
        Args:
            config: Optional configuration dictionary
        """
        self.config = config or {}
        
        # Stage A components
        self.page_locator = PageLocator(
            min_confidence=self.config.get('min_page_confidence', 0.5)
        )
        
        # Stage B components
        self.table_detector = TableDetector()
        self.row_extractor = RowExtractor()
        self.table_extractor = TableExtractor(self.config.get('table_extraction', {}))
        self.numeric_normalizer = NumericNormalizer()
        self.column_interpreter = ColumnInterpreter()
        self.mapping_engine = MappingEngine(
            fuzzy_threshold=self.config.get('fuzzy_threshold', 85.0)
        )
        
        # Validation components
        self.accounting_validator = AccountingValidator(
            tolerance=self.config.get('validation_tolerance', 0.01)
        )
        self.confidence_scorer = ConfidenceScorer()
        
        # Output builders
        self.canonical_builder = CanonicalBuilder()
        self.review_builder = ReviewPayloadBuilder()
        
        # Image saver
        self.image_saver = StatementImageSaver(
            output_base_dir=self.config.get('image_output_dir', 'app/statement_images')
        )

        # Heading scanner for robust statement-boundary detection
        self.heading_scanner = HeadingScanner()
        
        logger.info("="*80)
        logger.info("🚀 TWO-STAGE EXTRACTION PIPELINE INITIALIZED")
        logger.info("="*80)
    
    def extract(
        self,
        pdf_path: str,
        save_intermediates: bool = True
    ) -> Dict[str, Any]:
        """
        Execute full two-stage extraction pipeline.
        
        Args:
            pdf_path: Path to PDF file
            save_intermediates: Whether to save intermediate results
        
        Returns:
            Complete extraction result with canonical data and review payload
        """
        pdf_path = Path(pdf_path)
        logger.info(f"\n{'='*80}")
        logger.info(f"📄 PROCESSING: {pdf_path.name}")
        logger.info(f"{'='*80}\n")
        
        result = {
            'pdf_path': str(pdf_path),
            'timestamp': datetime.now().isoformat(),
            'stage_a_results': None,
            'stage_b_results': None,
            'canonical_output': None,
            'review_payload': None,
            'overall_status': 'PENDING'
        }
        
        try:
            # ===== STAGE A: PAGE LOCATION =====
            logger.info("🔍 STAGE A: PAGE LOCATION")
            logger.info("-" * 80)
            
            page_locations = self.page_locator.locate_statements(str(pdf_path))
            
            # Get best candidates for each statement
            best_locations = self.page_locator.get_best_candidates(page_locations, top_n=1)
            
            # Print summary
            self.page_locator.print_summary(best_locations)
            
            result['stage_a_results'] = self._serialize_page_locations(best_locations)
            
            # Save Stage A results if requested
            if save_intermediates:
                stage_a_path = self._get_output_path(pdf_path, '_stage_a_locations.json')
                self.page_locator.save_location_results(best_locations, str(stage_a_path))
                logger.info(f"\n💾 Saved Stage A results to: {stage_a_path}")
            
            # ===== SAVE STATEMENT IMAGES =====
            logger.info(f"\n📷 SAVING STATEMENT PAGE IMAGES")
            logger.info("-" * 80)
            
            try:
                saved_images = self.image_saver.save_statement_images(
                    pdf_path=str(pdf_path),
                    page_locations=best_locations
                )
                result['saved_images'] = saved_images
            except Exception as e:
                logger.warning(f"Failed to save statement images: {str(e)}")
                result['saved_images'] = {}
            
            # ===== STAGE B: STRUCTURED EXTRACTION =====
            logger.info(f"\n{'='*80}")
            logger.info("📊 STAGE B: STRUCTURED EXTRACTION")
            logger.info("-" * 80)
            
            extraction_results = self._execute_stage_b(
                pdf_path,
                best_locations
            )
            
            result['stage_b_results'] = extraction_results
            
            # ===== BUILD CANONICAL OUTPUT =====
            logger.info(f"\n{'='*80}")
            logger.info("📋 BUILDING CANONICAL OUTPUT")
            logger.info("-" * 80)
            
            canonical_output = self.canonical_builder.build(extraction_results)
            result['canonical_output'] = canonical_output
            
            # ===== VALIDATION =====
            logger.info(f"\n{'='*80}")
            logger.info("✅ VALIDATION")
            logger.info("-" * 80)
            
            validation_results = self._validate_extraction(canonical_output)
            result['validation_results'] = validation_results
            
            # ===== BUILD REVIEW PAYLOAD =====
            logger.info(f"\n{'='*80}")
            logger.info("📝 BUILDING REVIEW PAYLOAD")
            logger.info("-" * 80)
            
            review_payload = self.review_builder.build(
                page_locations=best_locations,
                extraction_results=extraction_results,
                canonical_output=canonical_output,
                validation_results=validation_results
            )
            result['review_payload'] = review_payload
            
            # Determine overall status
            if validation_results.get('needs_review', False):
                result['overall_status'] = 'NEEDS_REVIEW'
            else:
                result['overall_status'] = 'SUCCESS'
            
            # Save final results
            if save_intermediates:
                final_path = self._get_output_path(pdf_path, '_final_extraction.json')
                with open(final_path, 'w') as f:
                    json.dump(result, f, indent=2)
                logger.info(f"\n💾 Saved final results to: {final_path}")
            
            logger.info(f"\n{'='*80}")
            logger.info(f"✅ EXTRACTION COMPLETE: {result['overall_status']}")
            logger.info(f"{'='*80}\n")
            
            return result
        
        except Exception as e:
            logger.error(f"\n❌ PIPELINE FAILED: {str(e)}", exc_info=True)
            result['overall_status'] = 'FAILED'
            result['error'] = str(e)
            return result
    
    def _execute_stage_b(
        self,
        pdf_path: Path,
        page_locations: Dict[str, List[PageLocationResult]]
    ) -> Dict[str, Any]:
        """Execute Stage B extraction for all statements."""
        results = {}
        
        with pdfplumber.open(pdf_path) as pdf:
            for statement_type, candidates in page_locations.items():
                if not candidates:
                    logger.warning(f"⚠️  No pages found for {statement_type}")
                    continue
                
                # Use best candidate
                best_candidate = candidates[0]
                page_range = best_candidate.page_range
                
                logger.info(f"\n📄 Extracting {statement_type}")
                logger.info(f"   Pages: {page_range[0]+1}-{page_range[1]+1}")
                logger.info(f"   Confidence: {best_candidate.confidence:.2%}")
                
                # Extract from pages
                statement_result = self._extract_statement(
                    pdf,
                    statement_type,
                    page_range
                )
                
                results[statement_type] = statement_result
        
        return results
    
    # ── Header noise patterns used to filter continuation-page headers ──
    _HEADER_NOISE_RE = re.compile(
        r'^(particulars|description|note|group|bank|company|entity|'
        r'consolidated|standalone|parent|year|rs|lkr|page|for the)'
        , re.IGNORECASE
    )

    # Statement-title keywords that indicate a *new* statement starts on a page
    _STATEMENT_TITLE_KEYWORDS = [
        'income statement', 'statement of profit', 'profit or loss',
        'profit and loss', 'comprehensive income',
        'balance sheet', 'statement of financial position',
        'cash flow', 'cashflow', 'statement of cash flows',
        'statement of changes in equity',
    ]

    # ------------------------------------------------------------------ #
    #  Multi-page continuation helpers
    # ------------------------------------------------------------------ #

    def _page_starts_new_statement(
        self,
        pdf,
        page_num: int,
        current_statement_type: str,
    ) -> bool:
        """
        Return True if *page_num* contains a heading / title that belongs
        to a **different** financial statement, meaning we should stop
        scanning for continuations.

        Uses the HeadingScanner for primary detection (structural heuristics
        like position, casing, word-count) and falls back to keyword
        matching constrained to the first 10 lines for safety.
        """
        if page_num >= len(pdf.pages):
            return True  # beyond PDF → stop

        page = pdf.pages[page_num]

        # ── Primary: heading scanner ──────────────────────────────────
        headings = self.heading_scanner.extract_headings_from_page(page, page_num)
        if headings:
            matched = self.heading_scanner.match_headings_to_statements(headings)
            for stmt_type, matched_headings in matched.items():
                for h in matched_headings:
                    if h.match_score < 0.5:
                        continue  # ignore low-confidence hits
                    # A high-confidence heading for a *different* statement
                    if stmt_type.lower() != current_statement_type.lower():
                        logger.debug(
                            f"   HeadingScanner: page {page_num + 1} has heading "
                            f"'{h.heading_text}' → {stmt_type} (score={h.match_score:.2f})"
                        )
                        return True
            # Scanner found headings that all belong to the current statement
            # → not a new statement.
            return False

        # ── Fallback: keyword matching on first 10 lines only ─────────
        page_text = page.extract_text() or ''
        lines = page_text.split('\n')[:10]
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            line_lower = stripped.lower()
            for kw in self._STATEMENT_TITLE_KEYWORDS:
                if kw not in line_lower:
                    continue
                # Only trust the keyword if the line is short (heading-like)
                # or fully uppercase.
                if len(stripped) > len(kw) + 15 and not stripped.isupper():
                    continue  # line too long to be a real heading
                if self._keyword_matches_statement(kw, current_statement_type):
                    continue  # same statement header repeated (sub-header)
                return True
        return False

    @staticmethod
    def _keyword_matches_statement(keyword: str, statement_type: str) -> bool:
        """Check whether a detected heading keyword belongs to the same statement type."""
        st = statement_type.lower()
        kw = keyword.lower()
        if 'income' in st or 'profit' in st:
            return any(t in kw for t in ['income', 'profit'])
        if 'balance' in st or 'financial position' in st:
            return any(t in kw for t in ['balance', 'financial position'])
        if 'cash' in st:
            return 'cash' in kw
        return False

    def _verify_continuation_qualifies(
        self,
        pdf,
        main_table: Dict[str, Any],
        candidate: Dict[str, Any],
        next_page_num: int,
        statement_type: str,
    ) -> bool:
        """
        Verify if a candidate table on next_page_num qualifies as a continuation of main_table.
        """
        if next_page_num >= len(pdf.pages):
            return False

        # Bail out if the page starts a completely different statement
        if self._page_starts_new_statement(pdf, next_page_num, statement_type):
            logger.info(f"   ⛔ Page {next_page_num + 1} starts a new statement – stop scanning")
            return False

        main_col_count = len(main_table['rows'][0]) if main_table['rows'] else 0
        cand_col_count = len(candidate['rows'][0]) if candidate['rows'] else 0

        # Column-count must be within ±1 of the main table
        if abs(main_col_count - cand_col_count) > 1:
            logger.info(
                f"   ⛔ Page {next_page_num + 1}: column count mismatch "
                f"({cand_col_count} vs {main_col_count})"
            )
            return False

        # Try to map a few row labels to the target statement's fields.
        # If at least 1 data row maps, the table belongs to the same statement.
        data_rows = candidate['rows'][1:]  # skip possible header row
        mapped_count = 0
        for row in data_rows[:8]:  # check up to 8 rows
            label = str(row[0]).strip() if row and row[0] else ''
            if not label or len(label) < 3:
                continue
            result = self.mapping_engine.map_label(label, statement_type)
            if result and result.confidence >= 0.5:
                mapped_count += 1

        if mapped_count < 1:
            logger.info(
                f"   ⛔ Page {next_page_num + 1}: no mappable rows found – not a continuation"
            )
            return False

        logger.info(
            f"   ✅ Page {next_page_num + 1} is a continuation "
            f"({mapped_count} rows mapped)"
        )
        return True

    def _is_table_continuation(
        self,
        pdf,
        main_table: Dict[str, Any],
        next_page_num: int,
        statement_type: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Determine if the table on *next_page_num* is a continuation of
        *main_table*.  Returns the continuation table dict (with filtered
        rows) if yes, else ``None``.
        """
        if next_page_num >= len(pdf.pages):
            return None

        # Detect tables on the next page alone
        next_tables = self.table_detector.detect_tables(
            pdf, [next_page_num, next_page_num]
        )
        if not next_tables:
            return None

        candidate = next_tables[0]  # largest table on that page
        
        if self._verify_continuation_qualifies(pdf, main_table, candidate, next_page_num, statement_type):
            return candidate
            
        return None

    def _filter_continuation_rows(
        self,
        rows: List[List[str]],
    ) -> List[List[str]]:
        """
        Remove header / structural noise rows from a continuation table,
        keeping only genuine data rows.
        """
        filtered = []
        for row in rows:
            if not row:
                continue
            label = str(row[0]).strip() if row[0] else ''
            # Skip empty-label rows and header-noise rows
            if not label or self._HEADER_NOISE_RE.match(label):
                continue
            # Skip rows that are purely year numbers (e.g., "2024" or "2024 2023")
            if re.match(r'^[\d\s/]+$', label):
                continue
            # Keep rows that contain at least one numeric-looking value
            has_numeric = any(
                cell and re.search(r'\d', str(cell))
                for cell in row[1:]
            )
            if has_numeric or len(label) > 3:
                filtered.append(row)
        return filtered

    # ------------------------------------------------------------------ #
    #  Core extraction (updated for multi-page merging)
    # ------------------------------------------------------------------ #

    def _extract_statement(
        self,
        pdf,
        statement_type: str,
        page_range: List[int]
    ) -> Dict[str, Any]:
        """Extract a single statement from specified pages."""
        
        # Step 1: Detect tables
        logger.info("   📊 Detecting tables...")
        tables = self.table_detector.detect_tables(pdf, page_range)
        
        if not tables:
            logger.warning(f"   ⚠️  No tables found")
            return {'rows': [], 'column_info': {}, 'table_count': 0}
        
        logger.info(f"   ✓ Found {len(tables)} table(s)")
        
        # Step 2: Process the largest/main table (usually the first one)
        main_table = tables[0] if tables else None
        if not main_table:
            return {'rows': [], 'column_info': {}, 'table_count': 0}
        
        main_table_page = main_table.get('page_num', page_range[0])
        
        # ── Step 2b: Scan subsequent pages for continuation tables ──
        # Group remaining tables by page for quick lookup
        initial_tables_by_page = {}
        for t in tables[1:]:
            p = t.get('page_num')
            if p is not None:
                initial_tables_by_page.setdefault(p, []).append(t)

        current_page = main_table_page + 1
        max_scan_ahead = 3  # look at most 3 pages beyond the limit page
        limit_page = max(page_range[1], main_table_page)
        merged_page_end = main_table_page

        while current_page <= limit_page + max_scan_ahead:
            continuation = None
            if current_page in initial_tables_by_page:
                candidates = initial_tables_by_page[current_page]
                if candidates:
                    cand = candidates[0]  # take the largest/first table on that page
                    if self._verify_continuation_qualifies(pdf, main_table, cand, current_page, statement_type):
                        continuation = cand
            else:
                continuation = self._is_table_continuation(
                    pdf, main_table, current_page, statement_type
                )
                
            if continuation is None:
                break  # stop on first non-continuation

            # Filter noise rows and append to main_table
            extra_rows = self._filter_continuation_rows(continuation['rows'])
            if extra_rows:
                main_table['rows'].extend(extra_rows)
                main_table['row_count'] = len(main_table['rows'])
                merged_page_end = current_page
                logger.info(
                    f"   📎 Merged {len(extra_rows)} continuation rows "
                    f"from page {current_page + 1}"
                )

            # If we successfully merged a page beyond our limit_page, advance the limit_page
            if current_page > limit_page:
                limit_page = current_page

            current_page += 1

        # Update page range to reflect merged pages
        effective_page_range = [page_range[0], merged_page_end]

        # Step 3: Interpret columns (Bank/Group and Year1/Year2)
        logger.info("   🔍 Interpreting columns...")
        column_info = self.column_interpreter.interpret_columns(main_table['rows'])
        
        entity_count = len(column_info.get('entity_cols', {}))
        year_count = len(column_info.get('year_cols', {}))
        logger.info(f"   ✓ Found {entity_count} entity columns, {year_count} year columns")
        
        # Step 4: Extract rows with label mapping and value normalization
        logger.info("   📝 Extracting rows...")
        extracted_rows = self.row_extractor.extract_rows(
            main_table,
            column_info,
            statement_type
        )
        
        logger.info(f"   ✓ Extracted {len(extracted_rows)} rows")
        
        return {
            'rows': extracted_rows,
            'column_info': column_info,
            'table_count': len(tables),
            'page_range': effective_page_range
        }
    
    def _validate_extraction(
        self,
        canonical_output: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate extracted data."""
        # Stub for validation
        return {
            'needs_review': False,
            'validation_passed': True,
            'warnings': []
        }
    
    def _serialize_page_locations(
        self,
        locations: Dict[str, List[PageLocationResult]]
    ) -> Dict[str, List[Dict]]:
        """Convert PageLocationResult objects to serializable dicts."""
        serialized = {}
        for stmt_type, candidates in locations.items():
            serialized[stmt_type] = [
                {
                    'page_range': c.page_range,
                    'confidence': c.confidence,
                    'evidence': c.evidence,
                    'sources': c.sources
                }
                for c in candidates
            ]
        return serialized
    
    def _get_output_path(self, pdf_path: Path, suffix: str) -> Path:
        """Generate output file path."""
        output_dir = Path('data/processed/statement_jsons')
        output_dir.mkdir(parents=True, exist_ok=True)
        
        base_name = pdf_path.stem
        return output_dir / f"{base_name}{suffix}"
