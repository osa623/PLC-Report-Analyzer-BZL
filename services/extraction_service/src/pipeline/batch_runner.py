"""Batch runner for processing multiple PDFs."""

from pathlib import Path
from typing import List, Dict, Any
from src.pipeline.extract import ExtractionPipeline
from src.utils.logger import setup_logger, get_logger
from src.storage.save_json import save_json
from datetime import datetime

setup_logger("batch_runner", "logs")
logger = get_logger(__name__)


class BatchRunner:
    """Run extraction on multiple PDF files."""
    
    def __init__(self, config_path: str = "config/settings.yaml"):
        """
        Initialize batch runner.
        
        Args:
            config_path: Path to configuration file
        """
        self.pipeline = ExtractionPipeline(config_path)
        logger.info("Batch runner initialized")
    
    def run_batch(
        self, 
        input_directory: str, 
        output_summary: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Run batch extraction on all PDFs in directory.
        
        Args:
            input_directory: Directory containing PDF files
            output_summary: Whether to save a summary report
        
        Returns:
            List of results
        """
        logger.info(f"Starting batch extraction from: {input_directory}")
        
        # Get all PDF files
        pdf_dir = Path(input_directory)
        if not pdf_dir.exists():
            logger.error(f"Directory not found: {input_directory}")
            return []
        
        pdf_files = list(pdf_dir.glob("*.pdf"))
        logger.info(f"Found {len(pdf_files)} PDF files")
        
        results = []
        successful = 0
        failed = 0
        
        # Process each PDF
        for i, pdf_file in enumerate(pdf_files, 1):
            logger.info(f"\n{'='*60}")
            logger.info(f"Processing {i}/{len(pdf_files)}: {pdf_file.name}")
            logger.info(f"{'='*60}")
            
            try:
                result = self.pipeline.extract_from_pdf(str(pdf_file))
                
                if 'error' in result:
                    logger.error(f"Extraction failed: {result['error']}")
                    failed += 1
                else:
                    logger.info(f"✓ Successfully extracted data from {pdf_file.name}")
                    successful += 1
                
                results.append({
                    'file': pdf_file.name,
                    'status': 'success' if 'error' not in result else 'failed',
                    'result': result
                })
                
            except Exception as e:
                logger.error(f"Error processing {pdf_file.name}: {str(e)}")
                failed += 1
                results.append({
                    'file': pdf_file.name,
                    'status': 'failed',
                    'error': str(e)
                })
        
        # Generate summary
        summary = {
            'batch_date': datetime.now().isoformat(),
            'total_files': len(pdf_files),
            'successful': successful,
            'failed': failed,
            'success_rate': f"{(successful/len(pdf_files)*100):.1f}%" if pdf_files else "0%",
            'results': results
        }
        
        logger.info(f"\n{'='*60}")
        logger.info("BATCH EXTRACTION SUMMARY")
        logger.info(f"{'='*60}")
        logger.info(f"Total files: {summary['total_files']}")
        logger.info(f"Successful: {summary['successful']}")
        logger.info(f"Failed: {summary['failed']}")
        logger.info(f"Success rate: {summary['success_rate']}")
        logger.info(f"{'='*60}\n")
        
        # Save summary
        if output_summary:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            summary_path = f"data/processed/batch_summary_{timestamp}.json"
            save_json(summary, summary_path)
            logger.info(f"Summary saved to: {summary_path}")
        
        return results


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python batch_runner.py <pdf_directory>")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    
    runner = BatchRunner()
    runner.run_batch(input_dir)
