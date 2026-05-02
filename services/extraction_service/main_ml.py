#!/usr/bin/env python
"""
Main entry point for ML-Powered Financial Statement Extractor
Works with ANY annual report format!
"""

import sys
import os
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from src.pipeline.extract_ml import MLExtractionPipeline
from src.utils.logger import setup_logger, get_logger

setup_logger("ml_extractor", "logs")
logger = get_logger(__name__)


def print_banner():
    """Print welcome banner."""
    print("\n" + "="*80)
    print("   🤖 ML-POWERED FINANCIAL STATEMENT EXTRACTOR")
    print("   ✅ Works with ANY bank annual report format")
    print("   ✅ Intelligent document classification")
    print("   ✅ Smart field matching with NLP")
    print("="*80 + "\n")


def list_available_pdfs():
    """List available PDF files in data/raw directory."""
    raw_dir = Path("data/raw")
    pdfs = []
    
    if raw_dir.exists():
        for subdir in raw_dir.iterdir():
            if subdir.is_dir():
                for pdf in subdir.glob("*.pdf"):
                    pdfs.append(pdf)
    
    return sorted(pdfs)


def interactive_mode():
    """Run extractor in interactive mode."""
    print_banner()
    
    pdfs = list_available_pdfs()
    
    if not pdfs:
        print("❌ No PDF files found in data/raw directory")
        print("   Please add PDF files to data/raw/<bank_name>/")
        return
    
    print("📁 Available PDF files:\n")
    for idx, pdf in enumerate(pdfs, 1):
        size_mb = pdf.stat().st_size / (1024 * 1024)
        print(f"   {idx}. {pdf.parent.name}/{pdf.name} ({size_mb:.1f} MB)")
    
    print("\n" + "-"*80)
    choice = input("\nSelect PDF number (or press Enter for all): ").strip()
    
    if not choice:
        # Process all PDFs
        print(f"\n🚀 Processing {len(pdfs)} PDFs...\n")
        for pdf in pdfs:
            process_pdf(pdf)
    else:
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(pdfs):
                process_pdf(pdfs[idx])
            else:
                print(f"❌ Invalid selection. Please choose 1-{len(pdfs)}")
        except ValueError:
            print("❌ Invalid input. Please enter a number.")


def process_pdf(pdf_path: Path):
    """Process a single PDF file."""
    logger.info("="*80)
    logger.info(f"📄 Processing: {pdf_path.name}")
    logger.info("="*80)
    
    try:
        # Initialize ML pipeline
        pipeline = MLExtractionPipeline()
        
        # Extract data
        result = pipeline.extract(str(pdf_path))
        
        if result and result.get("data"):
            logger.info("\n" + "="*80)
            logger.info("✅ EXTRACTION COMPLETED SUCCESSFULLY")
            logger.info("="*80)
            
            # Show summary
            for entity in ["Bank", "Group"]:
                for year in ["Year1", "Year2"]:
                    data = result["data"][entity][year]
                    total = sum(len(stmt) for stmt in data.values())
                    logger.info(f"   {entity} {year}: {total} fields extracted")
                    
                    # Show breakdown by statement
                    for stmt_type, fields in data.items():
                        if fields:
                            logger.info(f"      - {stmt_type}: {len(fields)} fields")
            
            print("\n✅ Extraction complete!\n")
        else:
            logger.error("\n" + "="*80)
            logger.error("❌ EXTRACTION FAILED - No data extracted")
            logger.error("="*80)
            print("\n❌ Extraction failed - check logs for details\n")
            
    except Exception as e:
        logger.error(f"\n❌ EXTRACTION FAILED: {e}", exc_info=True)
        print(f"\n❌ Error: {e}\n")


def batch_mode(pdf_paths: list):
    """Process multiple PDFs in batch mode."""
    print_banner()
    print(f"🚀 BATCH MODE: Processing {len(pdf_paths)} files\n")
    
    for pdf_path in pdf_paths:
        process_pdf(Path(pdf_path))
        print("\n" + "-"*80 + "\n")


def main():
    """Main entry point."""
    if len(sys.argv) > 1:
        # Command line mode - process specified PDF(s)
        pdf_paths = sys.argv[1:]
        batch_mode(pdf_paths)
    else:
        # Interactive mode
        interactive_mode()


if __name__ == "__main__":
    main()
