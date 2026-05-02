#!/usr/bin/env python
"""Script to extract data from multiple PDF files."""

import sys
import argparse
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.pipeline.batch_runner import BatchRunner
from src.utils.logger import setup_logger, get_logger

setup_logger("batch_runner", "logs")
logger = get_logger(__name__)


def main():
    """Main function."""
    parser = argparse.ArgumentParser(
        description="Batch extract financial data from multiple bank PDF reports"
    )
    parser.add_argument(
        "input_directory",
        type=str,
        help="Directory containing PDF files"
    )
    parser.add_argument(
        "--config",
        type=str,
        default="config/settings.yaml",
        help="Path to config file (default: config/settings.yaml)"
    )
    parser.add_argument(
        "--no-summary",
        action="store_true",
        help="Don't save summary report"
    )
    
    args = parser.parse_args()
    
    # Validate directory
    input_dir = Path(args.input_directory)
    if not input_dir.exists():
        logger.error(f"Directory not found: {args.input_directory}")
        sys.exit(1)
    
    if not input_dir.is_dir():
        logger.error(f"Not a directory: {args.input_directory}")
        sys.exit(1)
    
    logger.info(f"Starting batch extraction from: {input_dir}")
    
    # Initialize batch runner
    runner = BatchRunner(args.config)
    
    # Run batch extraction
    results = runner.run_batch(
        str(input_dir),
        output_summary=not args.no_summary
    )
    
    if not results:
        logger.warning("No files were processed")
        sys.exit(1)
    
    logger.info("Batch extraction completed!")


if __name__ == "__main__":
    main()
