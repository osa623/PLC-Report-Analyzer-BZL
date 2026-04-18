"""
Statement Page Image Saver
Saves financial statement pages as images for each company
"""

from pathlib import Path
from typing import Dict, List
import logging
from pdf2image import convert_from_path

logger = logging.getLogger(__name__)


class StatementImageSaver:
    """Save statement pages as images organized by company."""
    
    def __init__(self, output_base_dir: str = "app/statement_images"):
        """
        Initialize image saver.
        
        Args:
            output_base_dir: Base directory for saving images
        """
        self.output_base_dir = Path(output_base_dir)
        self.output_base_dir.mkdir(parents=True, exist_ok=True)
    
    def save_statement_images(
        self,
        pdf_path: str,
        page_locations: Dict[str, List],
        company_name: str = None
    ) -> Dict[str, List[str]]:
        """
        Save statement pages as images.
        
        Args:
            pdf_path: Path to PDF file
            page_locations: Dictionary with statement names and PageLocationResult objects
            company_name: Name of company (derived from PDF name if not provided)
        
        Returns:
            Dictionary mapping statement names to saved image paths
        """
        pdf_path = Path(pdf_path)
        
        # Derive company name from PDF filename if not provided
        if not company_name:
            company_name = pdf_path.stem.upper()
        
        # Create company-specific directory
        company_dir = self.output_base_dir / company_name
        company_dir.mkdir(parents=True, exist_ok=True)
        
        saved_images = {}
        
        # Get Poppler path from config
        poppler_path = None
        try:
            from config.ocr_config import POPPLER_PATH
            poppler_path = POPPLER_PATH
        except ImportError:
            pass
        
        # Process each statement
        for statement_name, candidates in page_locations.items():
            if not candidates:
                continue
            
            # Get the best candidate (first one) - it's a PageLocationResult object
            best_candidate = candidates[0]
            
            # Extract page range from the PageLocationResult object
            if hasattr(best_candidate, 'page_range'):
                page_range = best_candidate.page_range
            else:
                logger.warning(f"Invalid candidate object for {statement_name}")
                continue
            
            if not page_range or len(page_range) < 2:
                logger.warning(f"Invalid page range for {statement_name}: {page_range}")
                continue
            
            start_page, end_page = page_range[0], page_range[1]
            
            try:
                logger.info(f"   Saving {statement_name} pages {start_page}-{end_page}")
                
                # Convert pages to images (pdf2image uses 1-based indexing)
                images = convert_from_path(
                    str(pdf_path),
                    first_page=start_page + 1,
                    last_page=end_page + 1,
                    dpi=200,  # Good quality for viewing, not too large
                    poppler_path=poppler_path
                )
                
                statement_images = []
                
                # Save each page
                for idx, image in enumerate(images):
                    page_num = start_page + idx
                    
                    # Create filename: income_statement_p225.png
                    statement_slug = statement_name.lower().replace(' ', '_')
                    image_filename = f"{statement_slug}_p{page_num}.png"
                    image_path = company_dir / image_filename
                    
                    # Save image
                    image.save(str(image_path), 'PNG')
                    statement_images.append(str(image_path))
                    
                    logger.info(f"      ✓ Saved page {page_num} -> {image_filename}")
                
                saved_images[statement_name] = statement_images
                
            except Exception as e:
                logger.error(f"Failed to save images for {statement_name}: {str(e)}")
                continue
        
        logger.info(f"   📁 All images saved to: {company_dir}")
        return saved_images
    
    def get_company_directory(self, company_name: str) -> Path:
        """Get the directory path for a specific company."""
        return self.output_base_dir / company_name.upper()
