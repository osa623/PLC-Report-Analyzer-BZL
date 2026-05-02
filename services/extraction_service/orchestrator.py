import asyncio
import json
import time
from typing import Dict, Any

from .pipeline.pdf_loader import load_pdf_pages
from .pipeline.gemini_statement_extractor import extract_financial_statements_from_text
from .pipeline.financial_structure_engine import FinancialStructureEngine
from .pipeline.column_alignment_engine import ColumnAlignmentEngine
from .pipeline.reconciliation_engine import ReconciliationEngine
from .integrations.telemetry import PIPELINE_DURATION

async def extract_pdf_to_structured(
    json_output_path: str, pdf_path: str
) -> Dict[str, Any]:
    start_pipeline = time.time()

    pages = load_pdf_pages(pdf_path)
    full_text = "\n\n".join(pages)

    # L1: Extraction Layer
    l1_output = extract_financial_statements_from_text(full_text, pdf_path, "local_test")
    if l1_output.get("status") == "failed":
        raise RuntimeError(l1_output.get("failure_reason"))

    extracted_tables = l1_output.get("extracted_tables", [])

    # L2 & L3: Financial Structure & Column Alignment
    structure_engine = FinancialStructureEngine()
    alignment_engine = ColumnAlignmentEngine()
    
    graph_payload = structure_engine.build(extracted_tables, alignment_engine)

    # L4: Reconciliation Engine
    recon_engine = ReconciliationEngine()
    validation_results = recon_engine.validate_graph(graph_payload["financial_graph"])

    graph_payload["metadata"]["reconciliation_errors"] = validation_results["errors"]
    graph_payload["metadata"]["is_valid"] = validation_results["is_valid"]

    # Optional: persist to file path for debugging
    try:
        with open(json_output_path, "w", encoding="utf-8") as f:
            json.dump(graph_payload, f, indent=2)
    except Exception:
        pass

    PIPELINE_DURATION.observe(time.time() - start_pipeline)
    return graph_payload


if __name__ == "__main__":
    import sys

    async def _main():
        if len(sys.argv) < 3:
            print("Usage: orchestrator.py <pdf-file> <output-json>")
            return
        path = sys.argv[1]
        out = sys.argv[2]
        
        try:
            import os
            from .integrations.telemetry import start_metrics_server
            start_metrics_server(port=int(os.environ.get("METRICS_PORT", 8000)))
        except Exception:
            pass

        res = await extract_pdf_to_structured(out, path)
        print("Extraction complete. Valid:", res.get("metadata", {}).get("is_valid"))

    asyncio.run(_main())
