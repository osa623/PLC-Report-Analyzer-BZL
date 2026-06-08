import json
import sys
import logging
import uuid
from pathlib import Path
from dotenv import load_dotenv

# Set up paths to allow importing from different services
ROOT_DIR = Path(__file__).parent.absolute()

# 1. Add extraction_service to path so `src.pipeline...` works
EXTRACTION_SERVICE_DIR = ROOT_DIR / "services" / "extraction_service"
sys.path.append(str(EXTRACTION_SERVICE_DIR))

# 2. Add annual-report-backend to path so `pipeline_bridge` can be imported directly
BACKEND_DIR = ROOT_DIR / "services" / "annual-report-backend"
sys.path.append(str(BACKEND_DIR))

# Load environment variables (API keys, etc.)
load_dotenv()

# Import the orchestrators from both services
from src.pipeline.pdf_image_orchestrator import process_annual_reports
from services.extraction_service.canonical_results import persist_normalized_results
from pipeline_bridge import run_pipeline_for_extraction_records, save_pipeline_logs

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
   EXTRACTION_SERVICE_DIR / "data" / "raw" / "amana" / "AMANA_Banking_2018.pdf",

   EXTRACTION_SERVICE_DIR / "data" / "raw" / "amana" / "AMANA_Banking_2020.pdf",

   EXTRACTION_SERVICE_DIR / "data" / "raw" / "amana" / "AMANA_Banking_2022.pdf",

   EXTRACTION_SERVICE_DIR / "data" / "raw" / "amana" / "AMANA_Banking_2024.pdf"
]

def main():
    pdf_bytes_list = []
    loaded_names = []
    
    # 1. Load the PDFs
    for pdf_path in PDF_PATHS[:5]:  # Enforce max 5
        if not pdf_path.exists():
            logging.error(f"File not found, skipping: {pdf_path}")
            continue
            
        logging.info(f"Loading PDF: {pdf_path}")
        pdf_bytes_list.append(pdf_path.read_bytes())
        loaded_names.append(pdf_path.name)
        
    if not pdf_bytes_list:
        logging.error("No valid PDFs loaded. Exiting.")
        return

    # 2. Run the Extraction Service pipeline
    logging.info(f"Starting extraction phase for {len(pdf_bytes_list)} PDFs...")
    # This runs the multi-threaded TOC search, screenshots, and Gemini extraction
    extraction_results = process_annual_reports(pdf_bytes_list)
    
    if not extraction_results:
        logging.error("Extraction pipeline returned empty results.")
        return

    # 3. Persist canonical normalized results for the whole batch.
    normalized_records = persist_normalized_results(extraction_results, loaded_names)
    logging.info("Canonical normalized_results.json updated with %s reports", len(normalized_records))

    # 4. Run the strict Analysis + Report pipeline once for all reports.
    logging.info("Starting combined analysis and report generation phases...")

    def progress_cb(step, total, msg, details=None):
        logging.info(f"[batch] Step {step}/{total}: {msg}")

    pipeline_result = run_pipeline_for_extraction_records(
        extraction_records=normalized_records,
        progress_callback=progress_cb,
    )

    job_id = f"test_{uuid.uuid4().hex[:8]}"
    log_dir = save_pipeline_logs(job_id, pipeline_result)
    if log_dir:
        logging.info(f"Batch logs saved to {log_dir}")

    final_outputs = {
        "pdf_names": loaded_names,
        "normalized_report_count": len(normalized_records),
        "pipeline": pipeline_result,
    }

    # 5. Save everything to a single output JSON file
    output_file = Path("full_pipeline_test_results.json")
    output_file.write_text(json.dumps(final_outputs, indent=2), encoding="utf-8")
    logging.info(f"✅ Full pipeline test completed! Results saved to: {output_file.absolute()}")

if __name__ == "__main__":
    main()
