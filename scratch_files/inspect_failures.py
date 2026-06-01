import json
from pathlib import Path

def main():
    results_path = Path("full_pipeline_test_results.json")
    if not results_path.exists():
        print("full_pipeline_test_results.json not found.")
        return
        
    with open(results_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    output_lines = []
    output_lines.append(f"Loaded {len(data)} document pipeline runs.")
    
    for run in data:
        pdf_name = run.get("pdf_name")
        pipeline = run.get("pipeline", {})
        output_lines.append(f"\n=================== Document: {pdf_name} ===================")
        
        # Check validation results
        validation = pipeline.get("validation_results", {})
        output_lines.append("\n--- Validation Gates ---")
        for entity, years in validation.items():
            output_lines.append(f"  Entity: {entity}")
            for year, checks in years.items():
                failed_checks = [name for name, check in checks.items() if check.get("status") == "FAILED"]
                passed_checks = [name for name, check in checks.items() if check.get("status") in ("PASS", "PASS_WITH_WARNINGS")]
                output_lines.append(f"    Year {year}: PASSED: {passed_checks} | FAILED: {failed_checks}")
                for fc in failed_checks:
                    output_lines.append(f"      * {fc}: {checks[fc]}")

        # Check ratio failures
        ratios = pipeline.get("ratio_analysis", {})
        output_lines.append("\n--- Ratio Failures ---")
        for entity, years in ratios.items():
            output_lines.append(f"  Entity: {entity}")
            for year, metrics in years.items():
                failed_metrics = {}
                for metric, details in metrics.items():
                    if details.get("status") == "FAILED":
                        failed_metrics[metric] = details
                if failed_metrics:
                    output_lines.append(f"    Year {year}: {len(failed_metrics)} ratios failed")
                    for m, d in failed_metrics.items():
                        output_lines.append(f"      * {m}: {d}")
                        
        # Check growth failures
        growth = pipeline.get("growth_analysis", {})
        output_lines.append("\n--- Growth Failures ---")
        for entity, years in growth.items():
            output_lines.append(f"  Entity: {entity}")
            for year, metrics in years.items():
                failed_metrics = {}
                for m, d in metrics.items():
                    if d.get("status") == "FAILED":
                        failed_metrics[m] = d
                if failed_metrics:
                    output_lines.append(f"    Year {year}: {len(failed_metrics)} growths failed")
                    for m, d in failed_metrics.items():
                        output_lines.append(f"      * {m}: {d}")
                        
        # Let's inspect the actual standardized fields that were mapped vs missing
        # In run_pipeline_stages, the analysis_result is under run["pipeline"]["analysis"] or run["pipeline"] directly
        # Let's see: we have completeness_metrics
        comp = pipeline.get("completeness_metrics", {})
        output_lines.append("\n--- Completeness Metrics ---")
        for entity, years in comp.items():
            output_lines.append(f"  Entity: {entity}")
            for year, details in years.items():
                output_lines.append(f"    Year {year}: score = {details.get('completeness_score')}%")
                if details.get("missing_fields"):
                    output_lines.append(f"      Missing fields: {details.get('missing_fields')}")

    out_file = Path("scratch_files/failures_summary.txt")
    out_file.write_text("\n".join(output_lines), encoding="utf-8")
    print(f"Summary written to {out_file.absolute()}")

if __name__ == "__main__":
    main()
