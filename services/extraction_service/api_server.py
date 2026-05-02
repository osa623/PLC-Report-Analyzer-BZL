"""
Flask API Server for Financial Data Extractor
Provides endpoints for PDF management and statement extraction
"""

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import os
import sys
import shutil
import requests
import json
import concurrent.futures
from dotenv import load_dotenv
from datetime import datetime
from pathlib import Path
import logging
import fitz  # PyMuPDF
from PIL import Image
import io
import json
import pandas as pd
from datetime import datetime
import re
from typing import Optional, Dict, List
import pdfplumber

# Load environment variables
load_dotenv()
from src.extractor.shareholder_extractor import ShareholderExtractor
from src.locator.toc_detector import TOCDetector
from src.extractor.table_parser import TableParser, ColumnDef, ColumnType
from src.pipeline.llm_extractor import LLMFinancialExtractor

# Configure logging first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check for Tesseract

try:
    import pytesseract
    TESSERACT_AVAILABLE = True

    possible_paths = [
        shutil.which("tesseract"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"D:\stock_app\tess\tesseract.exe"
    ]

    tesseract_path = None
    for path in possible_paths:
        if path and os.path.exists(path):
            pytesseract.pytesseract.tesseract_cmd = path
            tesseract_path = path
            break

    if tesseract_path:
        logger.info(f"Tesseract OCR is available (Path: {tesseract_path})")
    else:
        TESSERACT_AVAILABLE = False
        logger.warning("Tesseract executable not found, OCR disabled")

except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("pytesseract not available, using basic text extraction only")

# Add parent directory to path to import from src
sys.path.append(str(Path(__file__).parent))

from src.pipeline.two_stage_pipeline import TwoStagePipeline
from src.locator.page_locator import PageLocator
from src.storage.save_json import save_extraction_result
from src.pdf.table_extractor import TableExtractor
from src.mapper.mapping_engine import MappingEngine
from src.extractor.column_interpreter import ColumnInterpreter
from src.extractor.numeric_normalizer import NumericNormalizer
from config.target_schema_bank import STATEMENT_FIELDS, TARGET_FIELDS, MANDATORY_SECTIONS

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Configuration
RAW_DATA_PATH = Path(__file__).parent / "data" / "raw"
RAW_IMAGES_PATH = Path(__file__).parent / "data" / "raw_Images"
DATA_API_URL = os.getenv("DATA_API_URL", "http://localhost:5001/api/data")

def save_to_db(payload):
    """
    Helper function to save extracted data to the Node.js backend.
    """
    try:
        logger.info(f"Sending data to DB: {payload.get('company')} - {payload.get('type')}")
        response = requests.post(DATA_API_URL, json=payload, headers={'Content-Type': 'application/json'})
        response.raise_for_status()
        logger.info("Successfully updated database.")
        return True
    except Exception as e:
        logger.error(f"Failed to save to DB: {str(e)}")
        return False
PROCESSED_DATA_PATH = Path(__file__).parent / "data" / "processed" / "statement_jsons"
IMAGES_PATH = Path(__file__).parent / "app" / "statement_images"

# Ensure paths exist
RAW_DATA_PATH.mkdir(parents=True, exist_ok=True)
PROCESSED_DATA_PATH.mkdir(parents=True, exist_ok=True)
IMAGES_PATH.mkdir(parents=True, exist_ok=True)

# Initialize Shareholder Extractor and TOC Detector
shareholder_extractor = ShareholderExtractor()
toc_detector = TOCDetector()
table_parser = TableParser()
llm_extractor = LLMFinancialExtractor()


def extract_data_from_selected_pages(pdf_path, pdf_id, selected_pages):
    """
    Extract text from selected pages using OCR and text extraction.
    
    Args:
        pdf_path: Path to the PDF file
        pdf_id: Unique identifier for the PDF
        selected_pages: Dict with statement types as keys and list of page numbers as values
                       Example: {'income': [5, 6], 'balance': [7], 'cashflow': [9]}
    
    Returns:
        Dictionary with extracted text data organized by statement and page
    """
    logger.info(f"Extracting data from selected pages using OCR: {selected_pages}")
    
    # Map frontend statement types to readable names
    statement_names = {
        'income': 'Income Statement',
        'balance': 'Balance Sheet',
        'cashflow': 'Cash Flow Statement'
    }
    
    # Initialize result structure
    extracted_data = {
        "pdf_id": pdf_id,
        "extraction_date": datetime.now().isoformat(),
        "statements": {}
    }
    
    try:
        doc = fitz.open(pdf_path)
        
        # Process each statement type
        for statement_type, pages in selected_pages.items():
            if not pages:
                continue
            
            statement_name = statement_names.get(statement_type, statement_type)
            logger.info(f"\n{'='*80}")
            logger.info(f"Processing {statement_name} from pages: {pages}")
            logger.info(f"{'='*80}\n")
            
            # Initialize statement data
            extracted_data['statements'][statement_type] = {}
            current_schema = None  # Reset schema for new statement type
            
            # Process each page
            for page_num in pages:
                page_idx = page_num - 1
                
                if page_idx >= len(doc) or page_idx < 0:
                    logger.warning(f"Page {page_num} is out of range, skipping")
                    continue
                
                logger.info(f"\nExtracting from page {page_num}")
                
                page = doc[page_idx]
                page_key = f'page_{page_num}'
                
                # Extract text using PyMuPDF (built-in text extraction)
                text_content = page.get_text("text")
                
                # Also try to get structured text (blocks)
                blocks = page.get_text("dict")["blocks"]
                
                # Extract text with better structure
                extracted_lines = []
                
                for block in blocks:
                    if block.get("type") == 0:  # Text block
                        for line in block.get("lines", []):
                            line_text = ""
                            for span in line.get("spans", []):
                                line_text += span.get("text", "")
                            
                            if line_text.strip():
                                extracted_lines.append(line_text.strip())
                
                # If no structured text, use OCR on the page image
                if not extracted_lines or len(extracted_lines) < 5:
                    logger.info(f"  Limited text found, attempting OCR...")
                    
                    try:
                        # Render page to image
                        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                        
                        # Use OCR if available
                        if TESSERACT_AVAILABLE:
                            ocr_text = pytesseract.image_to_string(img)
                            extracted_lines = [line.strip() for line in ocr_text.split('\n') if line.strip()]
                            logger.info(f"  OCR extracted {len(extracted_lines)} lines")
                        else:
                            logger.warning("  pytesseract not available, using basic text extraction only")
                    
                    except Exception as e:
                        logger.error(f"  OCR failed: {str(e)}")
                
                # Parse lines using TableParser
                # Pass current_schema to maintain consistency across pages of the same statement
                parsed_data, schema = table_parser.parse_lines(extracted_lines, schema=current_schema)
                
                # Update schema if we found one (and didn't have one, or improved it?)
                # Usually we trust the first schema we find in the statement.
                if schema and not current_schema:
                    current_schema = schema
                    logger.info(f"  Locked schema for {statement_type}: {[c.name for c in schema]}")
                
                logger.info(f"  Extracted {len(parsed_data)} data items from page {page_num}")
                
                # Store the extracted data
                extracted_data['statements'][statement_type][page_key] = {
                    "raw_text_lines": len(extracted_lines),
                    "parsed_items": len(parsed_data),
                    "data": parsed_data,
                    "full_text": "\n".join(extracted_lines) if len(extracted_lines) < 500 else "\n".join(extracted_lines[:500]) + "\n... (truncated)"
                }
        
        doc.close()
        
    except Exception as e:
        logger.error(f"Error during extraction: {str(e)}", exc_info=True)
        raise
    
    logger.info(f"\n{'='*80}")
    logger.info("Extraction complete!")
    logger.info(f"{'='*80}\n")
    
    return extracted_data


def save_extracted_data_to_files(extracted_data, pdf_id, original_filename=None):
    """
    Save extracted data to both JSON and Excel files.
    Follows structure: [Sector]/[Company]/[Year]/[Filename].json
    
    Args:
        extracted_data: Dictionary containing extracted text data
        pdf_id: Unique identifier for the PDF
        original_filename: Original PDF filename for parsing hierarchy
    
    Returns:
        Dictionary with file paths
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Determine Output Directory
    output_dir = PROCESSED_DATA_PATH
    
    if original_filename:
        try:
            # Expected format: Sector_Company_Year.pdf
            stem = Path(original_filename).stem
            parts = stem.split('_')
            
            if len(parts) >= 3:
                sector = parts[0]
                year = parts[-1]
                # Join middle parts as company name (in case company has underscores, though convention says CamelCase)
                company = "_".join(parts[1:-1])
                
                # Create hierarchy: Sector/Company/Year
                output_dir = PROCESSED_DATA_PATH / sector / company / year
                output_dir.mkdir(parents=True, exist_ok=True)
                logger.info(f"Using structured output directory: {output_dir}")
            else:
                logger.warning(f"Filename '{original_filename}' does not match Sector_Company_Year format. Using default.")
        except Exception as e:
            logger.warning(f"Error parsing filename structure: {e}. Using default.")
            
    # JSON file
    json_filename = f"{pdf_id}.json"
    json_path = output_dir / json_filename
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(extracted_data, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Saved JSON file: {json_path}")
    
    # Excel file
    excel_filename = f"{pdf_id}.xlsx"
    excel_path = output_dir / excel_filename
    
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        # Create summary sheet
        summary_data = {
            'PDF ID': [extracted_data.get('pdf_id', '')],
            'Extraction Date': [extracted_data.get('extraction_date', '')],
            'Statements Extracted': [', '.join(extracted_data.get('statements', {}).keys())]
        }
        summary_df = pd.DataFrame(summary_data)
        summary_df.to_excel(writer, sheet_name='Summary', index=False)
        
        # Create sheets for each statement and page
        statements = extracted_data.get('statements', {})
        
        for statement_type, pages_data in statements.items():
            for page_key, page_info in pages_data.items():
                data_dict = page_info.get('data', {})
                
                if not data_dict:
                    continue
                
                # Convert nested dictionary to DataFrame with columns: Key, Year, Value
                rows = []
                for key, year_values in data_dict.items():
                    if isinstance(year_values, dict):
                        for year, value in year_values.items():
                            rows.append({"Key": key, "Year": year, "Value": value})
                    else:
                        # Handle edge case if not nested
                        rows.append({"Key": key, "Year": "", "Value": year_values})
                
                df = pd.DataFrame(rows)
                
                # Create sheet name
                sheet_name = f"{statement_type}_{page_key}"[:31]
                
                # Write to sheet
                df.to_excel(writer, sheet_name=sheet_name, index=False)
                logger.info(f"Added sheet '{sheet_name}' with {len(df)} rows")
    
    logger.info(f"Saved Excel file: {excel_path}")
    
    return {
        'json_file': str(json_path),
        'excel_file': str(excel_path),
        'json_filename': json_filename,
        'excel_filename': excel_filename
    }


def scan_pdfs():
    """Scan the raw data folder for PDFs and organize by category"""
    pdfs_by_category = {}
    
    if not RAW_DATA_PATH.exists():
        return pdfs_by_category
    
    # Iterate through category folders
    for category_dir in RAW_DATA_PATH.iterdir():
        if not category_dir.is_dir():
            continue
        
        category_name = category_dir.name.capitalize()
        pdfs = []
        
        # Find all PDF files in the category folder
        for pdf_file in category_dir.glob("*.pdf"):
            pdf_info = {
                "id": f"{category_dir.name}_{pdf_file.stem}",
                "name": pdf_file.name,
                "path": str(pdf_file),
                "relative_path": str(pdf_file.relative_to(RAW_DATA_PATH)).replace('\\', '/'),
                "company": pdf_file.stem.replace("_", " ").title(),
                "category": category_name,
                "pages": "Unknown"
            }
            
            # Try to extract year from filename
            import re
            year_match = re.search(r'20\d{2}', pdf_file.stem)
            if year_match:
                pdf_info["year"] = year_match.group()
            
            pdfs.append(pdf_info)
        
        if pdfs:
            pdfs_by_category[category_name] = pdfs
    
    return pdfs_by_category


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "FD Extractor API"}), 200


@app.route('/api/pdfs', methods=['GET'])
def get_all_pdfs():
    """Get all PDFs from the raw data folder"""
    try:
        pdfs_by_category = scan_pdfs()
        all_pdfs = []
        for pdfs in pdfs_by_category.values():
            all_pdfs.extend(pdfs)
        
        return jsonify(all_pdfs), 200
    except Exception as e:
        logger.error(f"Error fetching PDFs: {str(e)}")
        return jsonify({"error": str(e)}), 500


def extract_statement_images(pdf_path, pdf_id):
    """
    Extract images for each statement type from the PDF using page locator
    Returns dictionary with statement type as key and list of image URLs as value
    """
    statement_images = {
        "income": [],
        "balance": [],
        "cashflow": []
    }
    
    statement_pages = {
        "income": [],
        "balance": [],
        "cashflow": []
    }
    
    try:
        # Initialize page locator to find actual statement pages
        page_locator = PageLocator(min_confidence=0.5)
        
        logger.info(f"Locating statements in PDF: {pdf_path}")
        locations = page_locator.locate_statements(pdf_path)
        
        # Map the statement types to our frontend keys
        statement_mapping = {
            'Income_Statement': 'income',
            'Financial Position Statement': 'balance',
            'Cash Flow Statement': 'cashflow'
        }
        
        # Extract page ranges for each statement
        for stmt_type, frontend_key in statement_mapping.items():
            if stmt_type in locations and locations[stmt_type]:
                # Get the best candidate (highest confidence)
                best_candidate = locations[stmt_type][0]
                page_range = best_candidate.page_range
                confidence = best_candidate.confidence
                
                logger.info(f"Found {stmt_type} on pages {page_range[0]+1}-{page_range[1]+1} (confidence: {confidence:.2f})")
                
                statement_pages[frontend_key] = {
                    'pages': page_range,
                    'confidence': confidence,
                    'evidence': best_candidate.evidence
                }
        
        # Now extract images from the identified pages
        doc = fitz.open(pdf_path)
        
        for frontend_key, page_info in statement_pages.items():
            if not page_info:
                continue
                
            page_range = page_info['pages']
            start_page = page_range[0]
            end_page = min(page_range[1], start_page + 4)  # Limit to max 5 pages per statement
            
            for page_idx in range(start_page, end_page + 1):
                if page_idx >= len(doc):
                    continue
                    
                page = doc[page_idx]
                
                # Render page to image
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better quality
                
                # Save image
                image_filename = f"{pdf_id}_{frontend_key}_page_{page_idx + 1}.png"
                image_path = IMAGES_PATH / image_filename
                pix.save(str(image_path))
                
                # Add image URL to the list (use full URL for frontend)
                image_url = f"http://localhost:5000/api/images/{image_filename}"
                statement_images[frontend_key].append({
                    "url": image_url,
                    "page": page_idx + 1,
                    "filename": image_filename
                })
                
                logger.info(f"  Saved image: {image_filename} for page {page_idx + 1}")
        
        doc.close()
        
        total_images = sum(len(imgs) for imgs in statement_images.values())
        logger.info(f"Extracted {total_images} images from located statement pages for {pdf_id}")
        
        return statement_images, statement_pages
        
    except Exception as e:
        logger.error(f"Error extracting images: {str(e)}", exc_info=True)
        # Return empty results on error
        return statement_images, statement_pages


@app.route('/api/images/<filename>', methods=['GET'])
def get_image(filename):
    """Serve statement images"""
    try:
        image_path = IMAGES_PATH / filename
        if not image_path.exists():
            return jsonify({"error": "Image not found"}), 404
        
        return send_file(str(image_path), mimetype='image/png')
    except Exception as e:
        logger.error(f"Error serving image: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/pdfs/by-category', methods=['GET'])
def fetch_pdfs_by_category():
    """Get PDFs organized by category"""
    try:
        pdfs_by_category = scan_pdfs()
        return jsonify(pdfs_by_category), 200
    except Exception as e:
        logger.error(f"Error fetching PDFs by category: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/pdfs/<pdf_id>/extract', methods=['POST'])
def extract_statements(pdf_id):
    """
    Extract three financial statements from a PDF
    Returns: Income Statement, Balance Sheet, Cash Flow Statement
    """
    try:
        logger.info(f"Extracting statements from PDF: {pdf_id}")
        
        # Find the PDF by ID
        pdfs_by_category = scan_pdfs()
        pdf_info = None
        
        for category_pdfs in pdfs_by_category.values():
            for pdf in category_pdfs:
                if pdf["id"] == pdf_id:
                    pdf_info = pdf
                    break
            if pdf_info:
                break
        
        if not pdf_info:
            return jsonify({"error": "PDF not found"}), 404
        
        pdf_path = pdf_info["path"]
        logger.info(f"Processing PDF: {pdf_path}")
        
        # Extract page images for each statement type using page locator
        statement_images, statement_pages = extract_statement_images(pdf_path, pdf_id)
        
        # Build statements with actual page information and images
        statements = []
        
        statement_configs = {
            'income': {
                'type': 'income',
                'title': 'Income Statement'
            },
            'balance': {
                'type': 'balance',
                'title': 'Balance Sheet'
            },
            'cashflow': {
                'type': 'cashflow',
                'title': 'Cash Flow Statement'
            }
        }
        
        # Build response for each statement type
        for key, config in statement_configs.items():
            page_info = statement_pages.get(key, {})
            images = statement_images.get(key, [])
            
            if page_info and 'pages' in page_info:
                pages_str = f"Pages {page_info['pages'][0] + 1}-{page_info['pages'][1] + 1}"
                confidence = page_info['confidence']
            else:
                pages_str = "Not found"
                confidence = 0.0
            
            # Only include statements that were actually found
            if images:
                statement = {
                    "type": config['type'],
                    "title": config['title'],
                    "data": {},  # Will be populated after user selects pages
                    "confidence": confidence,
                    "pages": pages_str,
                    "images": images,
                    "evidence": page_info.get('evidence', []) if page_info else []
                }
                statements.append(statement)
            else:
                logger.warning(f"No images found for {key} statement")
        
        # Database save removed from here - moved to extract_data_from_pages
        # to ensure we save actual extracted data, not just image placeholders

        response = {
            "pdf": pdf_info,
            "statements": statements,
            "extraction_success": True,
            "note": "Using PageLocator to identify statement pages"
        }
        
        logger.info(f"Extraction completed for {pdf_id}. Returning {len(statements)} statements.")
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error extracting statements: {str(e)}", exc_info=True)
        return jsonify({
            "error": str(e),
            "extraction_success": False
        }), 500


@app.route('/api/pdfs/<pdf_id>/submit', methods=['POST'])
def submit_statements(pdf_id):
    """Submit selected statements for processing/storage"""
    try:
        data = request.get_json()
        selected_statements = data.get('selectedStatements', [])
        
        if not selected_statements:
            return jsonify({"error": "No statements selected"}), 400
        
        logger.info(f"Submitting {len(selected_statements)} statements for PDF: {pdf_id}")
        
        # Save the selected statements
        output_file = PROCESSED_DATA_PATH / f"{pdf_id}_selected.json"
        
        import json
        with open(output_file, 'w') as f:
            json.dump({
                "pdf_id": pdf_id,
                "statements": selected_statements,
                "timestamp": str(Path(__file__).stat().st_mtime)
            }, f, indent=2)
        
        logger.info(f"Statements saved to: {output_file}")
        
        return jsonify({
            "success": True,
            "message": f"Successfully submitted {len(selected_statements)} statements",
            "output_file": str(output_file)
        }), 200
        
    except Exception as e:
        logger.error(f"Error submitting statements: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Get list of all categories"""
    try:
        pdfs_by_category = scan_pdfs()
        categories = list(pdfs_by_category.keys())
        
        return jsonify({
            "categories": categories,
            "count": len(categories)
        }), 200
    except Exception as e:
        logger.error(f"Error fetching categories: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/pdfs/<pdf_id>/extract-data', methods=['POST'])
def extract_data_from_pages(pdf_id):
    """
    Extract table data from selected pages and generate JSON and Excel files.
    
    Request body:
    {
        "selectedPages": {
            "income": [5, 6],
            "balance": [7, 8],
            "cashflow": [9, 10]
        }
    }
    """
    try:
        data = request.get_json()
        selected_pages = data.get('selectedPages', {})
        
        if not selected_pages:
            return jsonify({"error": "No pages selected"}), 400
        
        logger.info(f"Extract data request for PDF: {pdf_id}")
        logger.info(f"Selected pages: {selected_pages}")
        
        # Find the PDF by ID
        pdfs_by_category = scan_pdfs()
        pdf_info = None
        
        for category_pdfs in pdfs_by_category.values():
            for pdf in category_pdfs:
                if pdf["id"] == pdf_id:
                    pdf_info = pdf
                    break
            if pdf_info:
                break
        
        if not pdf_info:
            return jsonify({"error": "PDF not found"}), 404
        
        pdf_path = pdf_info["path"]
        logger.info(f"Processing PDF: {pdf_path}")
        
        # Extract data from selected pages
        extracted_data = extract_data_from_selected_pages(pdf_path, pdf_id, selected_pages)
        
        # Save to JSON and Excel files
        # Pass the original filename for structured organization
        file_paths = save_extracted_data_to_files(
            extracted_data, 
            pdf_id, 
            original_filename=pdf_info["name"] if pdf_info else None
        )
        
        # Save to Database (Moved from extract_statements)
        try:
            filename = pdf_info["name"] if pdf_info else f"Unknown_{pdf_id}_2024.pdf"
            parts = Path(filename).stem.split('_')
            if len(parts) >= 3:
                sector = parts[0]
                company = "_".join(parts[1:-1])
                year = parts[-1]
            else:
                sector = "Uncategorized"
                company = "Unknown"
                year = "Unknown"

            # Use the structured data from lines 715
            db_payload = {
                "sector": sector,
                "company": company,
                "year": year,
                "type": "financial_statements",
                "data": extracted_data['statements'], # This contains the actual extracted keys/values
                "pdfId": pdf_id
            }
            save_to_db(db_payload)
        except Exception as e:
            logger.error(f"Error preparing DB payload during extraction: {e}")
        
        # Count total items extracted
        total_items = 0
        total_pages = 0
        statements_count = extracted_data.get('statements', {})
        
        for stmt_type, pages_data in statements_count.items():
            for page_key, page_info in pages_data.items():
                total_pages += 1
                data_items = page_info.get('data', [])
                total_items += len(data_items)
        
        # Prepare response
        response = {
            "success": True,
            "message": "Text extracted successfully using OCR",
            "pdf_id": pdf_id,
            "statements_processed": list(extracted_data.get('statements', {}).keys()),
            "json_file": file_paths['json_filename'],
            "excel_file": file_paths['excel_filename'],
            "output_dir": str(PROCESSED_DATA_PATH), # Technically this might be deep nested now
            "full_output_path": str(Path(file_paths['json_file']).parent),
            "extraction_summary": {
                "total_pages": total_pages,
                "total_items": total_items,
                "statements": list(extracted_data.get('statements', {}).keys())
            }
        }
        
        logger.info(f"Successfully extracted: {total_pages} pages, {total_items} items")
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error extracting data: {str(e)}", exc_info=True)
        return jsonify({
            "error": str(e),
            "success": False
        }), 500
        

@app.route('/api/pdfs/<pdf_id>/data', methods=['PUT'])
def update_extracted_data(pdf_id):
    """
    Update extracted data for a PDF.
    Updates the local JSON file and the database.
    
    Request body:
    {
        "statements": { ... new data ... }
    }
    """
    try:
        data = request.get_json()
        new_statements = data.get('statements', {})
        
        if not new_statements:
            return jsonify({"error": "No statements data provided"}), 400
            
        logger.info(f"Update data request for PDF: {pdf_id}")
        
        # 1. Find the existing JSON file
        # We search in PROCESSED_DATA_PATH recursively because files are structured in folders
        json_file_path = None
        for path in PROCESSED_DATA_PATH.rglob(f"{pdf_id}.json"):
            json_file_path = path
            break
            
        if not json_file_path:
            return jsonify({"error": f"Original data file not found for {pdf_id}"}), 404
            
        logger.info(f"Found existing data file: {json_file_path}")
        
        # 2. Update the local file
        # Read existing to preserve other fields (like extraction_date, pdf_id)
        try:
            with open(json_file_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except Exception as e:
            logger.error(f"Error reading existing file: {e}")
            return jsonify({"error": "Failed to read existing data file"}), 500
            
        # Update statements
        existing_data['statements'] = new_statements
        
        # Write back to file
        with open(json_file_path, 'w', encoding='utf-8') as f:
            json.dump(existing_data, f, indent=2, ensure_ascii=False)
            
        logger.info(f"Updated local JSON file: {json_file_path}")
        
        # 3. Update the Database
        try:
            # Reconstruct payload logic
            # Path structure: .../PROCESSED_DATA_PATH / Sector / Company / Year / filename.json
            relative_parts = json_file_path.relative_to(PROCESSED_DATA_PATH).parts
            
            sector = "Uncategorized"
            company = "Unknown"
            year = "Unknown"
            
            if len(relative_parts) >= 4: # Sector, Company, Year, Filename
                sector = relative_parts[0]
                company = relative_parts[1]
                year = relative_parts[2]
            else:
                 # Fallback: Parse from filename if possible
                 stem = json_file_path.stem
                 parts = stem.split('_')
                 if len(parts) >= 3:
                    sector = parts[0]
                    company = "_".join(parts[1:-1])
                    year = parts[-1]

            db_payload = {
                "sector": sector,
                "company": company,
                "year": year,
                "type": "financial_statements",
                "data": new_statements,
                "pdfId": pdf_id
            }
            
            save_success = save_to_db(db_payload)
            
            if not save_success:
                 logger.warning("Failed to update database via backend API")
                 
        except Exception as e:
            logger.error(f"Error preparing DB update payload: {e}")
            
        return jsonify({
            "success": True,
            "message": "Data updated successfully",
            "file_updated": True,
            "db_update_initiated": True
        }), 200

    except Exception as e:
        logger.error(f"Error updating data: {str(e)}", exc_info=True)
        return jsonify({
            "error": str(e),
            "success": False
        }), 500


@app.route('/api/raw-images', methods=['GET'])
def get_raw_images_structure():
    """
    Get the directory structure of data/raw_Images recursively.
    """
    try:
        if not RAW_IMAGES_PATH.exists():
            return jsonify({"error": "raw_Images directory does not exist"}), 404
            
        def build_tree(path):
            tree = {
                "name": path.name,
                "path": str(path.relative_to(RAW_IMAGES_PATH)).replace('\\', '/'),
                "type": "directory" if path.is_dir() else "file",
                "children": []
            }
            
            if path.is_dir():
                for item in path.iterdir():
                    # Filter out hidden files
                    if not item.name.startswith('.'):
                        tree["children"].append(build_tree(item))
            return tree

        # Build tree starting from root contents (not including the root folder itself as the only node)
        root_children = []
        for item in RAW_IMAGES_PATH.iterdir():
            if not item.name.startswith('.'):
                root_children.append(build_tree(item))
                
        return jsonify(root_children), 200

    except Exception as e:
        logger.error(f"Error scanning raw_Images: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/raw-images/serve', methods=['GET'])
def serve_raw_image():
    """
    Serve a raw image file.
    Query param: path (relative to raw_Images)
    """
    try:
        relative_path = request.args.get('path')
        if not relative_path:
            return jsonify({"error": "Path parameter required"}), 400
            
        image_path = RAW_IMAGES_PATH / relative_path
        if not image_path.exists():
            return jsonify({"error": "Image not found"}), 404
            
        return send_file(str(image_path), mimetype='image/png') # Assuming PNG/JPG, browser handles mimetype sniffing usually fine
    except Exception as e:
        logger.error(f"Error serving raw image: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/extract-from-image', methods=['POST'])
def extract_single_image():
    """
    Extract financial data from a single raw image using LLM.
    Body: { "path": "Banking/HNB/2024/page_5.png" }
    """
    try:
        data = request.get_json()
        relative_path = data.get('path')
        
        if not relative_path:
            return jsonify({"error": "Path required"}), 400
            
        image_path = RAW_IMAGES_PATH / relative_path
        
        logger.info(f"Triggering Local OCR extraction for: {image_path}")
        # Switch to Local OCR to avoid Rate Limits
        result = extract_with_local_ocr(str(image_path))
        
        # Save result logic (similar to existing)
        # We need to intuit the save path from the folder structure "Sector/Company/Year"
        try:
            path_parts = Path(relative_path).parts
            if len(path_parts) >= 3:
                sector = path_parts[0]
                company = path_parts[1]
                year = path_parts[2]
                
                # Construct output path
                output_dir = PROCESSED_DATA_PATH / sector / company / year
                output_dir.mkdir(parents=True, exist_ok=True)
                
                filename = f"extracted_{Path(relative_path).stem}.json"
                output_path = output_dir / filename
                
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(result, f, indent=2, ensure_ascii=False)
                    
                # DB Update
                # Use a specific type "extracted_table" to avoid overwriting the full "financial_statements" report
                # Also append _OCR to the pdfId to keep it distinct
                save_to_db({
                    "sector": sector,
                    "company": company,
                    "year": year,
                    "type": "extracted_table", 
                    "data": result,
                    "pdfId": f"{sector}_{company}_{year}_OCR" 
                })
                    
                result['_output_path'] = str(output_path)
                result['_saved'] = True
                
        except Exception as save_err:
            logger.warning(f"Could not auto-save result based on path: {save_err}")
            result['_saved'] = False
            
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Error in single extraction: {str(e)}")
        return jsonify({"error": str(e)}), 500

def extract_with_local_ocr(image_path_str):
    """
    Extracts financial table data using local Tesseract OCR and TableParser.
    """
    try:
        # Lazy load TableParser
        global table_parser_instance
        if 'table_parser_instance' not in globals():
             table_parser_instance = TableParser()
        
        # PREPROCESSING STEP (User Request for "full detail/quality")
        # Enhances resolution and contrast before OCR
        from src.preprocessing.image_preprocessor import ImagePreprocessor
        img = ImagePreprocessor.preprocess_for_ocr(image_path_str)
        
        # PREPROCESSING STEP (User Request for "full detail/quality")
        # Enhances resolution and contrast before OCR
        from src.preprocessing.image_preprocessor import ImagePreprocessor
        img = ImagePreprocessor.preprocess_for_ocr(image_path_str)
        
        # SPATIAL OCR STRATEGY (User Request for "deep details" and "quality")
        # Instead of getting string and splitting, we pass the image to get coordinates.
        # This handles column alignment by geometry, not spaces.
        
        # Quick Text Check for Entity Detection (Bank vs Company)
        # PSM 12 = Sparse text with OSD (faster than full layout)
        try:
             pre_text = pytesseract.image_to_string(img, config='--psm 12') 
        except:
             pre_text = ""
             
        # DYNAMIC ENTITY DETECTION
        primary_entity = "Bank" if "bank" in pre_text.lower() else "Company"
        secondary_entity = "Group"

        # FIXED SCHEMA STRATEGY (User Request)
        # Infer year from path "Banking/HNB/2024" -> 2024
        # Assume Report 2024 contains data for 2023 (Current) and 2022 (Previous)
        # OR if path is 2024, maybe it means FY 2024?
        # User image shows "2023 2022" for columns. Path is "2024".
        # So Report Year = 2024 implies Data = 2023, 2022.
        
        report_year = datetime.now().year # Default
        try:
             # Find 4-digit year in path
             path_parts = Path(image_path_str).parts
             for part in path_parts:
                 if part.isdigit() and len(part) == 4:
                     report_year = int(part)
        except:
             pass
             
        # Construct Schema based on user image:
        current_fy = report_year
        prev_fy = report_year - 1
        
        manual_schema = [
            ColumnDef(ColumnType.NOTE, "Note"),
            ColumnDef(ColumnType.VALUE, f"{current_fy} ({primary_entity})", current_fy, primary_entity),
            ColumnDef(ColumnType.VALUE, f"{prev_fy} ({primary_entity})", prev_fy, primary_entity),
            ColumnDef(ColumnType.VALUE, f"{current_fy} ({secondary_entity})", current_fy, secondary_entity),
            ColumnDef(ColumnType.VALUE, f"{prev_fy} ({secondary_entity})", prev_fy, secondary_entity)
        ]
        
        logger.info(f"Forcing Schema for {image_path_str}: {[c.name for c in manual_schema]}")
        
        # Invoke Spatial Parser with the Schema Hint
        parsed_data, schema = table_parser_instance.parse_with_spatial_layout(img, schema_hint=manual_schema)
        
        # Transform Dict[str, Dict] -> List[Dict] (Frontend Format)
        formatted_rows = []
        if parsed_data:
            # POLISHING STEP
            from src.pipeline.data_polisher import clean_json_data
            polished_data = clean_json_data(parsed_data)
            
            for key, values in polished_data.items():
                row = {"label": key}
                row.update(values)
                formatted_rows.append(row)
        
        # Determine currency unit if possible
        currency = "Rs '000" if "000" in pre_text else "LKR"
        
        ocr_result = {
            "statement_name": "Extracted Table (OCR)", 
            "currency_unit": currency,
            "data": formatted_rows,
            "parse_meta": {
                "method": "local_ocr_spatial",
                "confidence": 0.8
            }
        }
        
        # HYBRID AI VERIFICATION (User Request for "100% correct")
        # Send to Gemini Flash to polish/verify
        from src.pipeline.ai_polisher import AIPolisher
        # Lazy load polisher
        global ai_polisher_instance
        if 'ai_polisher_instance' not in globals():
             ai_polisher_instance = AIPolisher()
             
        final_result = ai_polisher_instance.refine_with_gemini(img, ocr_result)
        
        return final_result
    except Exception as e:
        logger.error(f"Local OCR Failed for {image_path_str}: {e}")
        raise e

@app.route('/api/extract-batch', methods=['POST'])
def extract_batch_images():
    """
    Extract data from multiple images in PARALLEL using Local OCR.
    Body: { "paths": ["path/to/img1.png", "path/to/img2.png"] }
    """
    try:
        data = request.get_json()
        relative_paths = data.get('paths', [])
        
        if not relative_paths:
            return jsonify({"error": "No paths provided"}), 400
            
        logger.info(f"Starting BATCH extraction for {len(relative_paths)} images using Local OCR")
        
        results = {}
        
        def process_image(rel_path):
            try:
                full_path = RAW_IMAGES_PATH / rel_path
                
                # PURE OCR STRATEGY (User Request)
                try:
                    extraction = extract_with_local_ocr(str(full_path))
                except Exception as ocr_err:
                    return rel_path, {"status": "error", "error": f"OCR Failed: {ocr_err}"}

                # Auto-save logic
                path_parts = Path(rel_path).parts
                saved_path = None
                if len(path_parts) >= 3:
                    sector, company, year = path_parts[0], path_parts[1], path_parts[2]
                    output_dir = PROCESSED_DATA_PATH / sector / company / year
                    output_dir.mkdir(parents=True, exist_ok=True)
                    filename = f"extracted_{Path(rel_path).stem}.json"
                    saved_path = output_dir / filename
                    saved_path = output_dir / filename
                    with open(saved_path, 'w', encoding='utf-8') as f:
                        json.dump(extraction, f, indent=2, ensure_ascii=False)
                        
                    # DB Update (critical for "proper folder structure" in UI)
                    try:
                        save_to_db({
                            "sector": sector,
                            "company": company,
                            "year": year,
                            "type": "extracted_table",
                            "data": extraction,
                            "pdfId": f"{sector}_{company}_{year}_{Path(rel_path).stem}_OCR"
                        })
                    except Exception as db_err:
                        logger.error(f"Failed to save to DB for {rel_path}: {db_err}")
                
                return rel_path, {"status": "success", "data": extraction, "saved_to": str(saved_path) if saved_path else None}
            except Exception as e:
                return rel_path, {"status": "error", "error": str(e)}

        # Use ThreadPoolExecutor for parallel processing
        # Reducing max_workers to 2 to avoid hitting Gemini Rate Limits (429)
        max_workers = min(len(relative_paths), 2) 
        
        aggregated_statements = {}
        sector = None
        company = None
        year = None
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_path = {executor.submit(process_image, path): path for path in relative_paths}
            
            for future in concurrent.futures.as_completed(future_to_path):
                path = future_to_path[future]
                try:
                    rel_path, res = future.result()
                    results[rel_path] = res
                    
                    if res.get("status") == "success":
                         # Capture metadata from the first successful extraction to form the Report Header
                         # Assuming all images in batch belong to same report
                         path_parts = Path(rel_path).parts
                         if len(path_parts) >= 3:
                             s, c, y = path_parts[0], path_parts[1], path_parts[2]
                             sector, company, year = s, c, y
                             
                             # Use filename as statement key (cash_flow, income, etc)
                             stmt_type = Path(rel_path).stem
                             aggregated_statements[stmt_type] = res["data"]
                             
                except Exception as exc:
                    results[path] = {"status": "error", "error": str(exc)}
        
        # FINAL DB SAVE: Aggregate as ONE Report
        if sector and company and year and aggregated_statements:
            try:
                # Construct a consolidated report object
                report_payload = {
                    "sector": sector,
                    "company": company,
                    "year": year,
                    "type": "annual_report_ocr", # New type for full report
                    "data": aggregated_statements, # {"cash_flow": {...}, "income": {...}}
                    "pdfId": f"{sector}_{company}_{year}_OCR_Combined",
                    "extraction_date": datetime.now().isoformat()
                }
                save_to_db(report_payload)
                logger.info(f"Saved Consolidated OCR Report to DB: {report_payload['pdfId']}")
            except Exception as e:
                logger.error(f"Failed to save consolidated report: {e}")

        return jsonify({
            "message": "Batch extraction complete",
            "processed": len(results),
            "results": results,
            "consolidated_report": aggregated_statements
        }), 200

    except Exception as e:
        logger.error(f"Error in batch extraction: {str(e)}")
        return jsonify({"error": str(e)}), 500


# ============================================================================
# INVESTOR RELATIONS ENDPOINTS
# ============================================================================

@app.route('/api/pdfs/<pdf_id>/investor-relations/detect', methods=['POST'])
def detect_investor_relations(pdf_id):
    """
    Detect Investor Relations page from TOC.
    """
    try:
        # Find PDF
        pdfs_by_category = scan_pdfs()
        pdf_data = None
        for category_pdfs in pdfs_by_category.values():
            for pdf in category_pdfs:
                if pdf['id'] == pdf_id:
                    pdf_data = pdf
                    break
            if pdf_data:
                break
        
        if not pdf_data:
            return jsonify({'error': 'PDF not found'}), 404
        
        pdf_path = pdf_data['path']
        logger.info(f"Detecting investor relations for PDF: {pdf_path}")
        
        # Detect investor relations pages
        with pdfplumber.open(pdf_path) as pdf:
            logger.info(f"PDF has {len(pdf.pages)} pages")
            pages = toc_detector.get_investor_relations_page_from_toc(pdf)
            logger.info(f"Detected pages: {pages}")
        
        if not pages:
            logger.warning(f"No investor relations pages detected for {pdf_id}")
        
        response_data = {
            'pdf_id': pdf_id,
            'pdf_name': pdf_data['name'],
            'pages': pages,
            'page_count': len(pages) if pages else 0,
            'method': 'toc_detection',
            'timestamp': datetime.now().isoformat()
        }
        
        logger.info(f"Returning response: {response_data}")
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Investor relations detection error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/pdfs/<pdf_id>/investor-relations/images', methods=['POST'])
def get_investor_relations_images(pdf_id):
    """
    Get full page images from all detected shareholder pages.
    """
    try:
        data = request.get_json() or {}
        pages = data.get('pages')  # Array of page numbers
        
        if not pages:
            return jsonify({'error': 'pages array required'}), 400
        
        # Find PDF
        pdfs_by_category = scan_pdfs()
        pdf_data = None
        for category_pdfs in pdfs_by_category.values():
            for pdf in category_pdfs:
                if pdf['id'] == pdf_id:
                    pdf_data = pdf
                    break
            if pdf_data:
                break
        
        if not pdf_data:
            return jsonify({'error': 'PDF not found'}), 404
        
        pdf_path = pdf_data['path']
        
        # Extract full page image for each detected page
        all_images = []
        for page_item in pages:
            # page_item can be an int (from simple list) or dict (from detection result)
            if isinstance(page_item, dict):
                page_num = page_item.get('page_num')
            else:
                page_num = page_item
                
            if page_num:
                logger.info(f"Extracting full page image from page {page_num}")
                page_images = shareholder_extractor.extract_page_images(pdf_path, page_num)
                all_images.extend(page_images)
        
        response_data = {
            'pdf_id': pdf_id,
            'pages': pages,
            'images': all_images,
            'image_count': len(all_images),
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Image extraction error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/pdfs/<pdf_id>/investor-relations/extract', methods=['POST'])
def extract_investor_relations_table(pdf_id):
    """
    Extract investor relations information from selected image using OCR.
    """
    try:
        data = request.get_json() or {}
        page_num = data.get('page_num')
        bbox = data.get('bbox')
        
        if page_num is None:
            return jsonify({'error': 'page_num required'}), 400
        
        # Find PDF
        pdfs_by_category = scan_pdfs()
        pdf_data = None
        for category_pdfs in pdfs_by_category.values():
            for pdf in category_pdfs:
                if pdf['id'] == pdf_id:
                    pdf_data = pdf
                    break
            if pdf_data:
                break
        
        if not pdf_data:
            return jsonify({'error': 'PDF not found'}), 404
        
        pdf_path = pdf_data['path']
        original_filename = pdf_data.get('name')
        
        # Extract table data
        logger.info(f"Extracting investor relations data from page {page_num}")
        extracted_data = shareholder_extractor.extract_table_from_page(
            pdf_path, 
            page_num, 
            bbox=bbox
        )
        
        # Default Output Configuration
        output_dir = PROCESSED_DATA_PATH.parent / 'investor_relations'
        output_dir.mkdir(exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{pdf_id}_investor_relations_{timestamp}.json"

        # Structured Output Configuration (if filename matches Sector_Company_Year format)
        if original_filename:
            try:
                # Expected: Sector_Company_Year.pdf
                stem = Path(original_filename).stem
                parts = stem.split('_')
                
                if len(parts) >= 3:
                    sector = parts[0]
                    year = parts[-1]
                    company = "_".join(parts[1:-1])
                    
                    # Create hierarchy: Sector/Company/Year
                    output_dir = PROCESSED_DATA_PATH.parent / 'investor_relations' / sector / company / year
                    output_dir.mkdir(parents=True, exist_ok=True)
                    
                    filename = f"{company}_investor_relations_{year}.json"
                    logger.info(f"Using structured output: {output_dir / filename}")
            except Exception as e:
                logger.warning(f"Filename parsing failed for '{original_filename}': {e}. Using default path.")
        
        output_file = output_dir / filename
        
        with open(output_file, 'w') as f:
            json.dump(extracted_data, f, indent=2)
        
        logger.info(f"Saved investor relations data to {output_file}")
        
        # Save to Database
        save_to_db({
            "sector": sector if 'sector' in locals() else 'Uncategorized',
            "company": company if 'company' in locals() else pdf_id,
            "year": year if 'year' in locals() else datetime.now().strftime('%Y'),
            "type": "investor_relations",
            "data": extracted_data,
            "pdfId": pdf_id
        })

        response_data = {
            'pdf_id': pdf_id,
            'page_num': page_num,
            'data': extracted_data,
            'saved_to': str(output_file),
            'success': True,
            'timestamp': datetime.now().isoformat(),
            # Metadata for connecting to Node Backend
            'metadata': {
                'sector': sector if 'sector' in locals() else 'Uncategorized',
                'company': company if 'company' in locals() else pdf_id,
                'year': year if 'year' in locals() else datetime.now().strftime('%Y')
            }
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Extraction error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/pdfs/<pdf_id>/investor-relations/extract-batch', methods=['POST'])
def extract_investor_relations_batch(pdf_id):
    """
    Extract investor relations information from MULTIPLE detected pages.
    """
    try:
        data = request.get_json() or {}
        pages = data.get('pages')
        
        if not pages:
            return jsonify({'error': 'pages array required'}), 400
        
        # Find PDF
        pdfs_by_category = scan_pdfs()
        pdf_data = None
        for category_pdfs in pdfs_by_category.values():
            for pdf in category_pdfs:
                if pdf['id'] == pdf_id:
                    pdf_data = pdf
                    break
            if pdf_data:
                break
        
        if not pdf_data:
            return jsonify({'error': 'PDF not found'}), 404
            
        pdf_path = pdf_data['path']
        logger.info(f"Batch extracting investor relations for PDF: {pdf_path}, Pages: {len(pages)}")
        
        # Extract from each page
        all_extracted_data = {}
        total_shareholders = 0
        
        for page_item in pages:
            # Handle if page_item is passed as dict
            if isinstance(page_item, dict):
                page_num = page_item.get('page_num')
            else:
                page_num = page_item
                
            if not page_num:
                continue

            logger.info(f"Extracting shareholder data from page {page_num}")
            
            # Use full page extraction
            result = shareholder_extractor.extract_table_from_page(pdf_path, page_num, bbox=None)
            
            if result['success'] and result['data']:
                # Merge data
                for name, info in result['data'].items():
                    all_extracted_data[name] = info
                    total_shareholders += 1

        # Save to File
        output_dir = PROCESSED_DATA_PATH
        original_filename = pdf_data['name']
        
        if original_filename:
            try:
                stem = Path(original_filename).stem
                parts = stem.split('_')
                if len(parts) >= 3:
                    sector = parts[0]
                    year = parts[-1]
                    company = "_".join(parts[1:-1])
                    output_dir = PROCESSED_DATA_PATH / sector / company / year 
                    output_dir.mkdir(parents=True, exist_ok=True)
            except:
                pass
        
        # Save JSON
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_filename = f"{pdf_id}_investor_relations_{timestamp}.json"
        json_path = output_dir / json_filename
        
        final_output = {
            "pdf_id": pdf_id,
            "extraction_date": datetime.now().isoformat(),
            "total_shareholders": len(all_extracted_data),
            "data": all_extracted_data,
            "source_pages": pages
        }
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(final_output, f, indent=2, ensure_ascii=False)
            
        return jsonify({
            "success": True,
            "message": f"Extracted {len(all_extracted_data)} shareholders from {len(pages)} pages",
            "saved_to": str(json_path),
            "data": final_output
        })
        
    except Exception as e:
        logger.error(f"Batch extraction error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500



@app.route('/api/pdfs/<pdf_id>/subsidiary-chart/detect', methods=['POST'])
def detect_subsidiary_pages(pdf_id):
    """
    Detect pages containing Subsidiary Charts.
    """
    try:
        data = request.get_json(silent=True) or {}
        
        # Find PDF
        pdfs_by_category = scan_pdfs()
        pdf_data = None
        for category_pdfs in pdfs_by_category.values():
            for pdf in category_pdfs:
                if pdf['id'] == pdf_id:
                    pdf_data = pdf
                    break
            if pdf_data:
                break
        
        if not pdf_data:
            return jsonify({'error': 'PDF not found'}), 404
        
        pdf_path = pdf_data['path']
        logger.info(f"Scanning for Subsidiary Charts in {pdf_path}")
        
        detected_pages = []
        try:
            with pdfplumber.open(pdf_path) as pdf:
                # Scan ALL pages (User request: "just look for all the pdf pages")
                for page_num in range(len(pdf.pages)):
                    page = pdf.pages[page_num]
                    try:
                        text = page.extract_text()
                        if not text:
                            continue
                            
                        # Heuristic: Line-based Header Detection
                        lines = text.split('\n')
                        
                        found_main_header = False
                        found_sub_header = False
                        
                        for line in lines:
                            clean_line = line.strip().upper()
                            if not clean_line:
                                continue
                                
                            if "NOTES TO THE FINANCIAL STATEMENTS" in clean_line or "FINANCIAL STATEMENTS" == clean_line:
                                found_main_header = True
                                continue
                                
                            keyword_hit = any(kw == clean_line or (kw in clean_line and len(clean_line.split()) < 10) 
                                              for kw in ["SUBSIDIARIES", "SUBSIDIARY", "GROUP STRUCTURE", "INVESTMENTS IN SUBSIDIARIES"])
                            
                            if keyword_hit:
                                found_sub_header = True
                        
                        if found_main_header and found_sub_header:
                            logger.info(f"Page {page_num+1}: Strong Match (Main + Sub Header)")
                            detected_pages.append({
                                'page_num': page_num + 1,
                                'confidence': 0.95,
                                'type': 'subsidiary_chart_strong'
                            })
                        elif found_sub_header:
                             # Fallback: Found "Subsidiaries" header but no "Notes" header (maybe on prev page)
                            logger.info(f"Page {page_num+1}: Weak Match (Sub Header Only)")
                            detected_pages.append({
                                'page_num': page_num + 1,
                                'confidence': 0.6,
                                'type': 'subsidiary_chart_weak'
                            })

                    except Exception as e:
                        logger.error(f"Page {page_num+1} scan error: {e}")
                        continue
                        
            # Sort by confidence
            detected_pages.sort(key=lambda x: x['confidence'], reverse=True)
            
            # Limit results to avoid overwhelming UI (but capture enough)
            if len(detected_pages) > 20:
                detected_pages = detected_pages[:20]


        except Exception as e:
            logger.error(f"Error extracting text: {e}")
            
        return jsonify({
            'pdf_id': pdf_id,
            'pages': detected_pages,
            'count': len(detected_pages)
        })
        
    except Exception as e:
        logger.error(f"Detection error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/pdfs/<pdf_id>/subsidiary-chart/images', methods=['POST'])
def get_subsidiary_chart_images(pdf_id):
    """
    Get images for detected subsidiary chart pages.
    """
    try:
        data = request.get_json(silent=True) or {}
        pages = data.get('pages', [])
        
        # Handle comma-separated string if passed (backward compatibility or weird frontend behavior)
        if isinstance(pages, str):
            pages = [int(p) for p in pages.split(',') if p.strip()]
            
        if not pages:
            return jsonify({'error': 'pages parameter required'}), 400

            
        # Find PDF
        pdfs_by_category = scan_pdfs()
        pdf_data = None
        for category_pdfs in pdfs_by_category.values():
            for pdf in category_pdfs:
                if pdf['id'] == pdf_id:
                    pdf_data = pdf
                    break
            if pdf_data:
                break
        
        if not pdf_data:
            return jsonify({'error': 'PDF not found'}), 404
        
        if not pdf_data:
            return jsonify({'error': 'PDF not found'}), 404
        
        pdf_path = pdf_data['path']
        logger.info(f"Generating images for subsidiary chart pages: {pages} in {pdf_path}")
        
        # Extract full page image for each detected page
        all_images = []
        for page_item in pages:
            try:
                if isinstance(page_item, dict):
                    page_num = int(page_item.get('page_num'))
                else:
                    page_num = int(page_item)
                    
                if page_num:
                    # Use existing extraction function
                    logger.info(f"Extracting image for page {page_num}")
                    page_images = shareholder_extractor.extract_page_images(pdf_path, page_num)
                    all_images.extend(page_images)
            except Exception as e:
                logger.error(f"Error processing page {page_item}: {e}")
                continue
        
        response_data = {
            'pdf_id': pdf_id,
            'pages': pages,
            'images': all_images,
            'image_count': len(all_images)
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Image extraction error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/pdfs/<pdf_id>/subsidiary-chart/extract', methods=['POST'])
def extract_subsidiary_chart_endpoint(pdf_id):
    """
    Extract subsidiary chart from a specific page.
    """
    try:
        data = request.get_json() or {}
        page_num = data.get('page_num')
        
        if not page_num:
            return jsonify({'error': 'page_num required'}), 400
        
        # Find PDF
        pdfs_by_category = scan_pdfs()
        pdf_data = None
        for category_pdfs in pdfs_by_category.values():
            for pdf in category_pdfs:
                if pdf['id'] == pdf_id:
                    pdf_data = pdf
                    break
            if pdf_data:
                break
        
        if not pdf_data:
            return jsonify({'error': 'PDF not found'}), 404
        
        pdf_path = pdf_data['path']
        
        # Initialize Extractor
        from src.extractor.chart_extractor import ChartExtractor
        extractor = ChartExtractor()
        
        chart_data = {"nodes": [], "edges": []}
        
        with pdfplumber.open(pdf_path) as pdf:
            try:
                page = pdf.pages[page_num - 1] 
                chart_data = extractor.extract_from_page(page)
            except IndexError:
                return jsonify({'error': 'Page index out of range'}), 400
        
        # Save to output folder
        filename = Path(pdf_path).name
        parts = filename.replace('.pdf', '').split('_')
        
        sector = parts[0] if len(parts) > 0 else 'Uncategorized'
        company = parts[1] if len(parts) > 1 else 'UnknownCompany'
        year = parts[2] if len(parts) > 2 else str(datetime.now().year)
        
        # User request: processed/subsidiaries/[Sector]/[Company]/[Year]
        # PROCESSED_DATA_PATH is .../processed/statement_jsons
        # So we go up one level to .../processed and then into 'subsidiaries'
        output_dir = PROCESSED_DATA_PATH.parent / 'subsidiaries' / sector / company / year
        output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = output_dir / f"subsidiary_chart.json"
        
        with open(output_file, 'w') as f:
            json.dump(chart_data, f, indent=2)
            
        # Save to Database
        save_to_db({
            "sector": sector,
            "company": company,
            "year": year,
            "type": "subsidiary_chart",
            "data": chart_data,
            "pdfId": pdf_id
        })

        return jsonify({
            'success': True,
            'data': chart_data,
            'saved_to': str(output_file),
            'nodes_count': len(chart_data['nodes']),
            'edges_count': len(chart_data['edges'])
        })
        
    except Exception as e:
        logger.error(f"Extraction error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500



@app.route('/api/files/raw', methods=['GET'])
def get_raw_files_structure():
    """
    Get recursive folder structure of data/raw
    Returns:
        JSON object representing the file tree
    """
    def scan_directory(path):
        name = os.path.basename(path)
        if os.path.isdir(path):
            children = []
            try:
                # List directory contents sorted by name
                for entry in sorted(os.listdir(path)):
                    full_path = os.path.join(path, entry)
                    # Skip hidden files
                    if entry.startswith('.'):
                        continue
                    children.append(scan_directory(full_path))
            except PermissionError:
                pass
            
            return {
                "name": name,
                "type": "directory",
                "path": str(Path(path).relative_to(RAW_DATA_PATH)).replace('\\', '/'),
                "children": children
            }
        else:
            return {
                "name": name,
                "type": "file",
                "path": str(Path(path).relative_to(RAW_DATA_PATH)).replace('\\', '/'),
                "size": os.path.getsize(path)
            }

    try:
        if not RAW_DATA_PATH.exists():
            return jsonify({"name": "raw", "type": "directory", "children": []}), 200
            
        # Manually construct root to avoid "data/raw" as the name if prefer "raw"
        structure = scan_directory(str(RAW_DATA_PATH))
        
        return jsonify(structure), 200
        
    except Exception as e:
        logger.error(f"Error scanning file structure: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':

    logger.info("Starting FD Extractor API Server...")
    logger.info(f"Raw data path: {RAW_DATA_PATH}")
    logger.info(f"Processed data path: {PROCESSED_DATA_PATH}")
    
    # Check if raw data folder has PDFs
    pdfs = scan_pdfs()
    logger.info(f"Found {sum(len(p) for p in pdfs.values())} PDFs in {len(pdfs)} categories")
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
