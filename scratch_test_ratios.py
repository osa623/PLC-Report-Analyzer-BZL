import json, sys
sys.path.insert(0, ".")
from services.analysis_service.strict_pipeline import build_strict_analysis_result

data = json.load(open("full_pipeline_test_results.json", "r", encoding="utf-8"))

for i, d in enumerate(data):
    pdf = d["pdf_name"]
    ext = d["pipeline"]["extraction"]
    result = build_strict_analysis_result(ext)
    
    print(f"\n{'='*60}")
    print(f"PDF {i}: {pdf}")
    print(f"Status: {result['status']}")
    
    for yr in sorted(result.get("yearly_ratios", {}).keys()):
        ratios = result["yearly_ratios"][yr]
        filled = sum(1 for r in ratios.values() if r["value"] is not None)
        total = len(ratios)
        print(f"\n  Year {yr}: {filled}/{total} ratios populated")
        for name, r in ratios.items():
            val = r["value"]
            conf = r["confidence"]
            marker = "[OK]" if val is not None else "[--]"
            print(f"    {marker} {name}: {val}  (conf={conf})  | {r['equation']}")
    
    scores = result.get("scores", {})
    print(f"\n  Scores: reliability={scores.get('reliability_score')}, risk={scores.get('risk_score')}, band={scores.get('reliability_band')}")
