import json
import sys
import time
from pathlib import Path

import requests

BASE = "http://127.0.0.1:3000"
PDFS = [
    Path("services/data/431_1646390362476.pdf"),
]

for p in PDFS:
    if not p.exists():
        print(f"Missing PDF: {p}")
        sys.exit(2)

files = []
handles = []
try:
    for p in PDFS:
        h = open(p, "rb")
        handles.append(h)
        files.append(("report", (p.name, h, "application/pdf")))

    data = {
        "symbol": "DEBUG",
        "name": "Debug Company",
        "sector": "Diversified",
    }

    r = requests.post(f"{BASE}/reports", files=files, data=data, timeout=300)
    print("POST /reports", r.status_code)
    print(r.text)
    r.raise_for_status()
    payload = r.json()
    report_id = payload.get("report_id")
    if not report_id:
        print("No report_id in response")
        sys.exit(3)

    print("report_id", report_id)
    deadline = time.time() + 300
    last = None
    while time.time() < deadline:
        s = requests.get(f"{BASE}/pipeline/{report_id}/stages", timeout=30)
        stages = s.json()
        state = stages.get("workflow_state")
        if state != last:
            print("workflow_state", state)
            print(json.dumps(stages, indent=2))
            last = state
        if state in {"FAILED", "COMPLETED", "LOW_CONFIDENCE"}:
            break
        time.sleep(4)

    e = requests.get(f"{BASE}/pipeline/{report_id}/errors", timeout=30)
    print("GET /pipeline/errors", e.status_code)
    print(json.dumps(e.json(), indent=2))

    rep = requests.get(f"{BASE}/reports/{report_id}", timeout=30)
    print("GET /reports/:id", rep.status_code)
    print(rep.text[:4000])

finally:
    for h in handles:
        try:
            h.close()
        except Exception:
            pass
