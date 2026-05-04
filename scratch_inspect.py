import json

data = json.load(open("full_pipeline_test_results.json", "r", encoding="utf-8"))

for i, d in enumerate(data):
    pdf = d["pdf_name"]
    ext = d["pipeline"]["extraction"]
    years = ext.get("years", {})
    print(f"\n{'='*60}")
    print(f"PDF {i}: {pdf}")
    print(f"  Detected years: {sorted(years.keys())}")
    for yr in sorted(years.keys()):
        yp = years[yr]
        is_keys = list(yp.get("income_statement", {}).keys())
        bs_keys = list(yp.get("balance_sheet", {}).keys())
        cf_keys = list(yp.get("cash_flow", {}).keys())
        print(f"\n  Year {yr}:")
        print(f"    income_statement ({len(is_keys)} fields): {is_keys}")
        print(f"    balance_sheet ({len(bs_keys)} fields): {bs_keys}")
        print(f"    cash_flow ({len(cf_keys)} fields): {cf_keys}")
        
        # Show sample values
        for section_name in ("income_statement", "balance_sheet", "cash_flow"):
            section = yp.get(section_name, {})
            if section:
                print(f"    --- {section_name} values ---")
                for k, v in list(section.items())[:5]:
                    print(f"      {k}: {v}")
