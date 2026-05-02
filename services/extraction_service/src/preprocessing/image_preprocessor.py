import cv2
import numpy as np
from PIL import Image
import logging

logger = logging.getLogger(__name__)

class ImagePreprocessor:
    """
    Enhances images for Tesseract OCR.
    Techniques: Rescaling, Grayscaling, Thresholding, Denoising.
    """
    
    @staticmethod
    def preprocess_for_ocr(image_path: str) -> Image.Image:
        try:
            # Load with OpenCV
            img = cv2.imread(image_path)
            if img is None:
                raise ValueError("Could not load image")

            # 1. Rescale (Upsample) - Crucial for small financial text
            # doubling the size often helps Tesseract resolve digits 
            scale_percent = 200 # percent of original size
            width = int(img.shape[1] * scale_percent / 100)
            height = int(img.shape[0] * scale_percent / 100)
            dim = (width, height)
            
            img = cv2.resize(img, dim, interpolation = cv2.INTER_CUBIC)

            # 2. Convert to Grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # 3. Apply Thresholding (Binarization)
            # Otsu's thresholding automatically finds the best value to separate text from background
            # This kills background colors/stripes common in tables
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            # 4. (Optional) Denoise if needed
            # For strict tables, sometimes simple threshold is best. 
            # Denoising can blur edges. Let's stick to sharp binary.

            # Convert back to PIL Image for Tesseract
            pil_img = Image.fromarray(thresh)
            return pil_img
            
        except Exception as e:
            logger.error(f"Preprocessing failed for {image_path}: {e}")
            logger.warning("Falling back to original image.")
            return Image.open(image_path)
