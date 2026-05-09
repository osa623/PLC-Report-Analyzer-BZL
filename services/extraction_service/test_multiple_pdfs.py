import json
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv

# Add src to python path if needed (assuming run from extraction_service root)
sys.path.append(".")

# Load environment variables (API keys)
load_dotenv()

from src.pipeline.pdf_image_orchestrator import process_annual_reports

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
   "data/raw/hnb/Banking_HNB_2017.pdf",
   "data/raw/hnb/Banking_HNB_2019.pdf",
   "data/raw/hnb/Banking_HNB_2021.pdf",
   "data/raw/hnb/Banking_HNB_2023.pdf"
]

def main():
    pdf_bytes_list = []
    loaded_names = []
    
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
    
    # 3. Clean up the output names and save
    if results:
        # Replace the generic "pdf_1", "pdf_2" names with the actual filenames for clarity
        for result, actual_name in zip(results, loaded_names):
            result["pdf_name"] = actual_name
            
        output_file = Path("batch_extraction_results.json")
        output_file.write_text(json.dumps(results, indent=2), encoding="utf-8")
        logging.info(f"✅ Pipeline completed! Full results saved to: {output_file.absolute()}")
    else:
        logging.error("Pipeline returned empty results.")

if __name__ == "__main__":
    main()
