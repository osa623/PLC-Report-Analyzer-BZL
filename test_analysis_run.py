import json
import sys
from pathlib import Path

# Add services/analysis_service to path
sys.path.append(str(Path(__file__).parent / "services" / "analysis_service"))

from financial_mapping_layer import analyze_normalized_results

def main():
    normalized_path = Path("services/extraction_service/normalized_results.json")
    if not normalized_path.exists():
        print(f"Error: {normalized_path} not found")
        return
        
    with open(normalized_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    print("Running analyze_normalized_results...")
    result = analyze_normalized_results(data)
    
    # Print summary of results
    print("\nAnalysis Result Keys:", list(result.keys()))
    print("Status:", result.get("status"))
    
    # Check each entity's analysis
    for key, value in result.items():
        if key.endswith("_analysis"):
            print(f"\n--- Entity Analysis: {key} ---")
            scores = value.get("scores", {})
            print("Scores:", scores)
            
            years = value.get("years", {})
            for year, year_data in years.items():
                print(f"\nYear: {year}")
                print("Sector:", year_data.get("sector"))
                
                # Print ratio status
                print("Ratios:")
                ratios = year_data.get("ratio_analysis", {})
                for ratio_name, ratio_val in ratios.items():
                    status = ratio_val.get("status")
                    if status == "FAILED":
                        print(f"  [FAIL] {ratio_name}: {status} - Reason: {ratio_val.get('reason')} - Missing fields: {ratio_val.get('missing_fields')}")
                    else:
                        print(f"  [OK] {ratio_name}: {status} - Value: {ratio_val.get('value')}")
                        
                # Print validation checks status
                print("Validation Checks:")
                checks = year_data.get("validation_results", {})
                for check_name, check_val in checks.items():
                    print(f"  {check_name}: {check_val.get('status')}")

if __name__ == "__main__":
    main()
