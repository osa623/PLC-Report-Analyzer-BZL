import json
import sys
import time
from pathlib import Path

import requests

BASE = "http://127.0.0.1:3000"

# Target the HNB directory
HNB_DIR = Path("D:/PLC-Report-Analyzer-BZL/services/data/HNB")
PDFS = sorted(HNB_DIR.glob("*.pdf"))

if not PDFS:
    print(f"No PDFs found in {HNB_DIR.absolute()}")
    sys.exit(1)

print(f"Found {len(PDFS)} PDFs to process:")
for p in PDFS:
    print(f" - {p.name}")

files = []
handles = []
try:
    for p in PDFS:
        h = open(p, "rb")
        handles.append(h)
        files.append(("report", (p.name, h, "application/pdf")))

    data = {
        "symbol": "HNB",
        "name": "Hatton National Bank",
        "sector": "Banks",
    }

    print("\nSubmitting to pipeline... This may take a few seconds.")
    r = requests.post(f"{BASE}/reports", files=files, data=data, timeout=300)
    print(f"POST /reports -> Status: {r.status_code}")
    
    if r.status_code != 200 and r.status_code != 201:
        print(r.text)
        sys.exit(1)

    payload = r.json()
    report_id = payload.get("report_id")
    if not report_id:
        print("No report_id in response")
        sys.exit(3)

    print(f"Pipeline started successfully! Report ID: {report_id}")
    print("Waiting for pipeline stages to complete...\n")
    
    deadline = time.time() + 600  # 10 minutes max wait
    last = None
    
    while time.time() < deadline:
        try:
            s = requests.get(f"{BASE}/pipeline/{report_id}/stages", timeout=30)
            stages = s.json()
            state = stages.get("workflow_state")
            if state != last:
                print(f"[{time.strftime('%H:%M:%S')}] Workflow State changed to: {state}")
                last = state
            
            if state in {"FAILED", "COMPLETED", "LOW_CONFIDENCE", "REQUIRES_ATTENTION"}:
                print("\nPipeline execution finished.")
                break
        except requests.exceptions.RequestException as e:
            print(f"Waiting for backend... ({e})")
        
        time.sleep(5)

    print("\n--- Pipeline Errors ---")
    try:
        e = requests.get(f"{BASE}/pipeline/{report_id}/errors", timeout=30)
        print(f"GET /pipeline/errors -> Status: {e.status_code}")
        print(json.dumps(e.json(), indent=2))
    except Exception as ex:
        print(f"Could not fetch errors: {ex}")

    print("\n--- Final Report Output ---")
    try:
        rep = requests.get(f"{BASE}/reports/{report_id}", timeout=30)
        print(f"GET /reports/{report_id} -> Status: {rep.status_code}")
        
        report_data = rep.json()
        print(json.dumps(report_data, indent=2))
    except Exception as ex:
        print(f"Could not fetch final report: {ex}")

finally:
    for h in handles:
        try:
            h.close()
        except Exception:
            pass
