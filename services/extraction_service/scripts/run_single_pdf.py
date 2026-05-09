#!/usr/bin/env python
"""Script to extract data from a single PDF file."""

import sys
import argparse
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.pipeline.extract import ExtractionPipeline
from src.storage.save_json import save_json
from src.utils.logger import setup_logger, get_logger

setup_logger("ai_extractor", "logs")
logger = get_logger(__name__)


def main():
    """Main function."""
    parser = argparse.ArgumentParser(
        description="Extract financial data from a bank's PDF annual report"
    )
    parser.add_argument(
        "pdf_path",
        type=str,
        help="Path to the PDF file"
    )
    parser.add_argument(
        "--company",
        type=str,
        help="Company name (optional, will use filename if not provided)"
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Output JSON file path (optional)"
    )
    parser.add_argument(
        "--config",
        type=str,
        default="config/settings.yaml",
        help="Path to config file (default: config/settings.yaml)"
    )
    
    args = parser.parse_args()
    
    # Validate PDF path
    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        logger.error(f"PDF file not found: {args.pdf_path}")
        sys.exit(1)
    
    logger.info(f"Starting extraction for: {pdf_path.name}")
    logger.info(f"Company: {args.company or 'Auto-detect'}")
    
    # Initialize pipeline
    pipeline = ExtractionPipeline(args.config)
    
    # Extract data
    result = pipeline.extract_from_pdf(str(pdf_path), args.company)
    
    # Check result
    if 'error' in result:
        logger.error(f"Extraction failed: {result['error']}")
        sys.exit(1)
    
    logger.info("\n" + "="*60)
    logger.info("EXTRACTION RESULTS")
    logger.info("="*60)
    logger.info(f"Company: {result['company_name']}")
    logger.info(f"Period: {result.get('period', {}).get('text', 'N/A')}")
    logger.info(f"Currency: {result.get('currency', 'N/A')}")
    logger.info(f"Unit: {result.get('unit', 'N/A')}")
    logger.info(f"\nStatements extracted:")
    for statement in result.get('data', {}).keys():
        field_count = len(result['data'][statement])
        logger.info(f"  - {statement}: {field_count} fields")
    
    logger.info(f"\nConfidence Scores:")
    for key, value in result.get('confidence', {}).items():
        if isinstance(value, dict):
            logger.info(f"  - {key}: {value.get('confidence', 'N/A')}")
        else:
            logger.info(f"  - {key}: {value}")
    
    logger.info(f"\nValidation Results:")
    for key, value in result.get('validation', {}).items():
        status = "✓ PASSED" if value else "✗ FAILED"
        logger.info(f"  - {key}: {status}")
    
    logger.info("="*60 + "\n")
    
    # Save to custom output path if specified
    if args.output:
        save_json(result, args.output)
        logger.info(f"Results saved to: {args.output}")
    
    logger.info("Extraction completed successfully!")


if __name__ == "__main__":
    main()
