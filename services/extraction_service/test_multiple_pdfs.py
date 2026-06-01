import json
import sys
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Add src to python path if needed (assuming run from extraction_service root)
sys.path.append(".")

# Load environment variables (API keys)
load_dotenv()

from src.pipeline.pdf_image_orchestrator import process_annual_reports
from src.pipeline.llm_normalizer import LLMNormalizer
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO, 
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

# -------------------------------------------------------------------
# CONFIGURATION: Add your PDF paths here
# -------------------------------------------------------------------
PDF_PATHS = [

   "data/raw/union/2024.pdf",
]

def main():
    pdf_bytes_list = []
    loaded_names = []
    all_normalized_payloads = []
    
    # 1. Load the PDFs
    for path_str in PDF_PATHS[:5]:  # Enforce max 5
        pdf_path = Path(path_str)
        if not pdf_path.exists():
            logging.error(f"File not found, skipping: {pdf_path}")
            continue
            
        logging.info(f"Loading PDF: {pdf_path}")
        pdf_bytes_list.append(pdf_path.read_bytes())
        loaded_names.append(pdf_path.name)
        
    if not pdf_bytes_list:
        logging.error("No valid PDFs loaded. Exiting.")
        return

    # 2. Run the pipeline
    logging.info(f"Starting pipeline for {len(pdf_bytes_list)} PDFs...")
    results = process_annual_reports(pdf_bytes_list)
    
    # Initialize Normalizer
    normalizer = LLMNormalizer()
    DATA_API_URL = os.getenv("DATA_API_URL", "http://localhost:5001/api/data")
    
    # 3. Normalize and save to DB
    if results:
        for result, actual_name in zip(results, loaded_names):
            result["pdf_name"] = actual_name
            
            # Try to extract company name from filename (e.g. Banking_HNB_2019.pdf -> HNB)
            parts = actual_name.split('_')
            company_name = parts[1] if len(parts) >= 2 else "Unknown"
            
            # Normalize
            logging.info(f"Normalizing data for {actual_name}...")
            normalized_payload = normalizer.normalize(
                raw_data=result.get("statements", {}),
                company_name=company_name,
                source_pdf=actual_name
            )
            
            # Save to MongoDB
            logging.info(f"Saving {actual_name} to database...")
            try:
                db_response = requests.post(DATA_API_URL, json=normalized_payload, headers={'Content-Type': 'application/json'}, timeout=5)
                db_response.raise_for_status()
                logging.info(f"✅ Successfully saved {actual_name} to DB!")
            except requests.exceptions.ConnectionError:
                logging.warning(f"⚠️  Database offline (Could not connect to {DATA_API_URL}). Finalized data will still be saved to batch_extraction_results.json.")
            except Exception as e:
                logging.error(f"❌ Failed to save {actual_name} to DB: {str(e)[:100]}...")
                
            # Keep normalized payload in a separate list
            all_normalized_payloads.append(normalized_payload)
            
        # Save raw results
        raw_output_file = Path("batch_extraction_results.json")
        raw_output_file.write_text(json.dumps(results, indent=2), encoding="utf-8")
        
        # Save normalized results to a different JSON file
        normalized_output_file = Path("normalized_results.json")
        normalized_output_file.write_text(json.dumps(all_normalized_payloads, indent=2), encoding="utf-8")
        
        logging.info(f"✅ Pipeline completed!")
        logging.info(f"📄 Raw extraction saved to: {raw_output_file.absolute()}")
        logging.info(f"📄 Normalized data saved to: {normalized_output_file.absolute()}")
    else:
        logging.error("Pipeline returned empty results.")

if __name__ == "__main__":
    main()
