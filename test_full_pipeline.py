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
from pipeline_bridge import run_pipeline_stages, save_pipeline_logs

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
   EXTRACTION_SERVICE_DIR / "data" / "raw" / "ndb" / "NDB_Banking_2024.pdf"
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

    # 3. Run the strict Analysis + Report pipeline
    logging.info("Starting analysis and report generation phases...")
    
    final_outputs = []
    
    for i, result in enumerate(extraction_results):
        actual_name = loaded_names[i]
        
        # In process_annual_reports, the returned dict has {"statements": {...}}
        gemini_data = result.get("statements", {})
        
        if not gemini_data:
            logging.error(f"No statement data extracted for {actual_name}. Skipping downstream pipeline.")
            continue
            
        def progress_cb(step, total, msg, details=None):
            logging.info(f"[{actual_name}] Step {step}/{total}: {msg}")
            
        logging.info(f"Running full pipeline for {actual_name}...")
        
        # This converts the format, runs the strict analysis, and builds the report
        pipeline_result = run_pipeline_stages(
            gemini_result=gemini_data,
            filename=actual_name,
            progress_callback=progress_cb
        )
        
        # Save individual job logs to the backend directory
        job_id = f"test_{uuid.uuid4().hex[:8]}"
        log_dir = save_pipeline_logs(job_id, pipeline_result)
        if log_dir:
            logging.info(f"Logs for {actual_name} saved to {log_dir}")
        
        final_outputs.append({
            "pdf_name": actual_name,
            "pipeline": pipeline_result
        })

    # 4. Save everything to a single output JSON file
    output_file = Path("full_pipeline_test_results.json")
    output_file.write_text(json.dumps(final_outputs, indent=2), encoding="utf-8")
    logging.info(f"✅ Full pipeline test completed! Results saved to: {output_file.absolute()}")

if __name__ == "__main__":
    main()
