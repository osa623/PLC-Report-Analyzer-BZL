"""OCR configuration for Poppler and Tesseract paths."""

# Tesseract OCR executable path
TESSERACT_PATH =  ( r"D:\stock_app\tess\tesseract.exe" or r"C:\Program Files\Tesseract-OCR\tesseract.exe" )

# Poppler utilities path (for pdf2image)
# Update this to your actual Poppler installation path
POPPLER_PATH = r"F:\poppler-25.12.0\Library\bin"

# OCR Settings
OCR_CONFIG = {
    'dpi': 300,  # Image resolution (higher = better quality, slower)
    'language': 'eng',  # Tesseract language code
    'confidence_threshold': 60,  # Minimum confidence percentage
    'preprocess': True,  # Apply image enhancement
    'timeout': 30,  # Seconds before OCR times out per page
}
