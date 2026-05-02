"""OCR module for extracting text from image-based PDFs."""

import cv2
import numpy as np
from pdf2image import convert_from_path
from PIL import Image
import pytesseract
from pathlib import Path
from typing import Optional, List, Dict, Any
from src.utils.logger import get_logger

logger = get_logger(__name__)


class OCRProcessor:
    """Process OCR on PDF images."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize OCR processor.
        
        Args:
            config: OCR configuration dictionary
        """
        self.config = config or {}
        self.dpi = self.config.get('dpi', 300)
        self.language = self.config.get('language', 'eng')
        self.confidence_threshold = self.config.get('confidence_threshold', 60)
        self.preprocess = self.config.get('preprocess', True)
        
        logger.info(f"Initialized OCR processor with DPI={self.dpi}, language={self.language}")
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess image for better OCR results.
        
        Args:
            image: Input image as numpy array
        
        Returns:
            Preprocessed image
        """
        try:
            # Convert to grayscale
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image
            
            # Apply denoising
            denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
            
            # Apply adaptive thresholding
            thresh = cv2.adaptiveThreshold(
                denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
            
            # Deskew if needed
            coords = np.column_stack(np.where(thresh > 0))
            if len(coords) > 0:
                angle = cv2.minAreaRect(coords)[-1]
                if angle < -45:
                    angle = 90 + angle
                if abs(angle) > 0.5:  # Only deskew if angle is significant
                    (h, w) = thresh.shape[:2]
                    center = (w // 2, h // 2)
                    M = cv2.getRotationMatrix2D(center, angle, 1.0)
                    thresh = cv2.warpAffine(
                        thresh, M, (w, h),
                        flags=cv2.INTER_CUBIC,
                        borderMode=cv2.BORDER_REPLICATE
                    )
            
            return thresh
            
        except Exception as e:
            logger.warning(f"Error in image preprocessing: {str(e)}")
            return image
    
    def extract_text_from_image(self, image: Image.Image, preprocess: bool = True) -> str:
        """
        Extract text from a PIL Image using Tesseract.
        
        Args:
            image: PIL Image object
            preprocess: Whether to preprocess the image
        
        Returns:
            Extracted text
        """
        try:
            # Convert PIL Image to numpy array
            img_array = np.array(image)
            
            # Preprocess if enabled
            if preprocess and self.preprocess:
                img_array = self.preprocess_image(img_array)
                image = Image.fromarray(img_array)
            
            # Configure Tesseract
            custom_config = f'--oem 3 --psm 6 -l {self.language}'
            
            # Extract text
            text = pytesseract.image_to_string(image, config=custom_config)
            
            return text
            
        except Exception as e:
            logger.error(f"Error extracting text from image: {str(e)}")
            return ""
    
    def extract_text_with_confidence(self, image: Image.Image) -> Dict[str, Any]:
        """
        Extract text with confidence scores.
        
        Args:
            image: PIL Image object
        
        Returns:
            Dictionary with text and confidence data
        """
        try:
            # Convert PIL Image to numpy array
            img_array = np.array(image)
            
            # Preprocess if enabled
            if self.preprocess:
                img_array = self.preprocess_image(img_array)
                image = Image.fromarray(img_array)
            
            # Get detailed OCR data
            custom_config = f'--oem 3 --psm 6 -l {self.language}'
            ocr_data = pytesseract.image_to_data(
                image, 
                config=custom_config, 
                output_type=pytesseract.Output.DICT
            )
            
            # Filter by confidence threshold
            filtered_text = []
            confidences = []
            
            for i, conf in enumerate(ocr_data['conf']):
                if int(conf) >= self.confidence_threshold:
                    text = ocr_data['text'][i].strip()
                    if text:
                        filtered_text.append(text)
                        confidences.append(int(conf))
            
            full_text = ' '.join(filtered_text)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            return {
                'text': full_text,
                'confidence': avg_confidence,
                'word_count': len(filtered_text),
                'low_confidence_words': sum(1 for c in confidences if c < 80)
            }
            
        except Exception as e:
            logger.error(f"Error extracting text with confidence: {str(e)}")
            return {
                'text': '',
                'confidence': 0,
                'word_count': 0,
                'low_confidence_words': 0
            }
    
    def pdf_to_images(self, pdf_path: str, start_page: int = 0, 
                     end_page: Optional[int] = None) -> List[Image.Image]:
        """
        Convert PDF pages to images.
        
        Args:
            pdf_path: Path to PDF file
            start_page: Starting page number (0-indexed)
            end_page: Ending page number (0-indexed), None for all pages
        
        Returns:
            List of PIL Images
        """
        try:
            logger.info(f"Converting PDF to images (DPI={self.dpi})")
            
            images = convert_from_path(
                pdf_path,
                dpi=self.dpi,
                first_page=start_page + 1,  # convert_from_path uses 1-indexed pages
                last_page=end_page + 1 if end_page else None
            )
            
            logger.info(f"Converted {len(images)} pages to images")
            return images
            
        except Exception as e:
            logger.error(f"Error converting PDF to images: {str(e)}")
            return []
    
    def extract_text_from_pdf(self, pdf_path: str, page_num: Optional[int] = None) -> str:
        """
        Extract text from PDF using OCR.
        
        Args:
            pdf_path: Path to PDF file
            page_num: Specific page number (0-indexed), None for all pages
        
        Returns:
            Extracted text
        """
        try:
            if page_num is not None:
                # Process single page
                images = self.pdf_to_images(pdf_path, page_num, page_num)
                if images:
                    return self.extract_text_from_image(images[0])
                return ""
            else:
                # Process all pages
                images = self.pdf_to_images(pdf_path)
                text = ""
                for i, image in enumerate(images):
                    logger.info(f"Processing page {i + 1}/{len(images)} with OCR")
                    page_text = self.extract_text_from_image(image)
                    text += page_text + "\n"
                return text
                
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {str(e)}")
            return ""
    
    def extract_text_from_pdf_with_confidence(
        self, 
        pdf_path: str, 
        page_num: Optional[int] = None
    ) -> Dict[int, Dict[str, Any]]:
        """
        Extract text from PDF with confidence scores for each page.
        
        Args:
            pdf_path: Path to PDF file
            page_num: Specific page number (0-indexed), None for all pages
        
        Returns:
            Dictionary mapping page numbers to text and confidence data
        """
        try:
            results = {}
            
            if page_num is not None:
                # Process single page
                images = self.pdf_to_images(pdf_path, page_num, page_num)
                if images:
                    results[page_num] = self.extract_text_with_confidence(images[0])
            else:
                # Process all pages
                images = self.pdf_to_images(pdf_path)
                for i, image in enumerate(images):
                    logger.info(f"Processing page {i + 1}/{len(images)} with OCR")
                    results[i] = self.extract_text_with_confidence(image)
            
            return results
            
        except Exception as e:
            logger.error(f"Error extracting text with confidence from PDF: {str(e)}")
            return {}
    
    def is_image_based_pdf(self, pdf_path: str, sample_pages: int = 3) -> bool:
        """
        Determine if PDF is image-based (requiring OCR).
        
        Args:
            pdf_path: Path to PDF file
            sample_pages: Number of pages to sample
        
        Returns:
            True if PDF is image-based, False otherwise
        """
        try:
            from src.pdf.loader import PDFLoader
            
            loader = PDFLoader(pdf_path)
            loader.get_pdf_info()
            
            # Sample first few pages
            total_pages = min(sample_pages, loader.total_pages)
            text_length = 0
            
            for i in range(total_pages):
                text = loader.extract_text_pdfplumber(i)
                text_length += len(text.strip())
            
            # If very little text extracted, it's likely image-based
            avg_text_per_page = text_length / total_pages if total_pages > 0 else 0
            
            logger.info(f"Average text per page: {avg_text_per_page}")
            return avg_text_per_page < 100  # Threshold for image-based PDF
            
        except Exception as e:
            logger.error(f"Error checking if PDF is image-based: {str(e)}")
            return False
