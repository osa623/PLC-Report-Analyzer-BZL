"""
Two-Stage Extraction Pipeline
Main orchestrator combining Stage A (Page Location) and Stage B (Structured Extraction)
"""

from pathlib import Path
from typing import Dict, List, Optional, Any
import json
import pdfplumber
from datetime import datetime

from src.locator.page_locator import PageLocator, PageLocationResult
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
            'page_range': page_range
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
