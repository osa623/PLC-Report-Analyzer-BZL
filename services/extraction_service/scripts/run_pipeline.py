"""
Main CLI Entry Point for Two-Stage Extraction Pipeline
Updated to use the new refactored architecture
"""

import sys
import argparse
from pathlib import Path

# Add parent directory to path so we can import src
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.pipeline.two_stage_pipeline import TwoStagePipeline
from src.utils.logger import setup_logger, get_logger

setup_logger("extraction_pipeline", "logs")
logger = get_logger(__name__)


def print_banner():
    """Print welcome banner."""
    print("\n" + "="*80)
    print("   🚀 TWO-STAGE FINANCIAL STATEMENT EXTRACTION PIPELINE")
    print("   📄 Stage A: Intelligent Page Location")
    print("   📊 Stage B: Structured Data Extraction")
    print("   ✅ Validation & Confidence Scoring")
    print("   📋 Review Payload Generation")
    print("="*80 + "\n")


def main():
    """Main entry point."""
    print_banner()
    
    # Parse arguments
    parser = argparse.ArgumentParser(
        description="Extract financial statements from annual reports"
    )
    parser.add_argument(
        "pdf_path",
        type=str,
        help="Path to PDF file"
    )
    parser.add_argument(
        "--no-intermediates",
        action="store_true",
        help="Don't save intermediate results"
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.5,
        help="Minimum confidence threshold for page location (default: 0.5)"
    )
    
    args = parser.parse_args()
    
    # Validate PDF path
    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        logger.error(f"PDF file not found: {pdf_path}")
        sys.exit(1)
    
    if not pdf_path.suffix.lower() == '.pdf':
        logger.error(f"File must be a PDF: {pdf_path}")
        sys.exit(1)
    
    # Create pipeline with configuration
    config = {
        'min_page_confidence': args.min_confidence,
        'fuzzy_threshold': 85.0,
        'validation_tolerance': 0.01
    }
    
    pipeline = TwoStagePipeline(config)
    
    # Execute extraction
    try:
        result = pipeline.extract(
            str(pdf_path),
            save_intermediates=not args.no_intermediates
        )
        
        # Print summary
        print("\n" + "="*80)
        print("EXTRACTION SUMMARY")
        print("="*80)
        print(f"Status: {result['overall_status']}")
        
        if result['stage_a_results']:
            print("\nStage A Results:")
            for stmt_type, candidates in result['stage_a_results'].items():
                if candidates:
                    best = candidates[0]
                    pages = f"{best['page_range'][0]+1}-{best['page_range'][1]+1}"
                    conf = f"{best['confidence']:.0%}"
                    print(f"  {stmt_type}: Pages {pages} (confidence: {conf})")
        
        if result['overall_status'] == 'NEEDS_REVIEW':
            print("\n⚠️  MANUAL REVIEW REQUIRED")
            print("   Check the review payload for details.")
        elif result['overall_status'] == 'SUCCESS':
            print("\n✅ EXTRACTION SUCCESSFUL")
        else:
            print(f"\n❌ EXTRACTION FAILED: {result.get('error', 'Unknown error')}")
        
        print("="*80 + "\n")
        
        return 0 if result['overall_status'] != 'FAILED' else 1
    
    except Exception as e:
        logger.error(f"Extraction failed: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
