import json
from pathlib import Path
import sys

# Add services/analysis_service to path
ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT_DIR / "services" / "analysis_service"))

from financial_mapping_layer import map_entity_year, _detect_sector

def main():
    results_path = Path("services/extraction_service/normalized_results.json")
    if not results_path.exists():
        print("normalized_results.json not found")
        return
        
    with open(results_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    record = data[0]
    financials = record.get("financials", {})
    
    for year in sorted(financials.keys()):
        print(f"\n=================== Year {year} ===================")
        year_payload = financials[year]
        for entity in year_payload.keys():
            if entity not in ("bank", "group"):
                continue
            entity_payload = year_payload[entity]
            sector = _detect_sector(record.get("company", "Unknown"), entity_payload)
            mapped = map_entity_year(entity_payload, sector)
            print(f"  Entity: {entity} (Detected Sector: {sector})")
            print(f"    Standardized fields:")
            for field, val in mapped["standardized"].items():
                if val is None:
                    print(f"      - {field}: None [MISSING]")
                else:
                    print(f"      - {field}: {val} [OK]")
            print(f"    Missing fields: {mapped['missing_fields']}")

if __name__ == "__main__":
    main()
