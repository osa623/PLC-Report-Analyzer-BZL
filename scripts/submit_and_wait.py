import requests
from pathlib import Path
import time
import sys
import os

PIPELINE_PORT = int(os.getenv("PIPELINE_ORCHESTRATOR_PORT", "8100"))
BASE_URL = f"http://127.0.0.1:{PIPELINE_PORT}"
URL = f"{BASE_URL}/submit"
STATUS_URL = f"{BASE_URL}/status/{{}}"
RESULT_URL = f"{BASE_URL}/result/{{}}"
DATA_DIR = Path("services/data")
OUT_DIR = Path("data/eval")
OUT_DIR.mkdir(parents=True, exist_ok=True)

if not DATA_DIR.exists():
    print("data dir not found:", DATA_DIR)
    sys.exit(2)

pdfs = list(DATA_DIR.glob("*.pdf"))
if not pdfs:
    print("no pdfs found in", DATA_DIR)
    sys.exit(0)

jobs = []
for pdf in pdfs:
    print(f"Submitting {pdf.name}...")
    with open(pdf, "rb") as f:
        files = {"file": (pdf.name, f, "application/pdf")}
        r = requests.post(URL, files=files, timeout=120)
        r.raise_for_status()
        data = r.json()
        jobs.append((pdf.name, data["job_id"]))
        print("->", data)

# Poll statuses
for name, job_id in jobs:
    print(f"Polling job {job_id} for {name}...")
    deadline = time.time() + 300
    status = None
    while time.time() < deadline:
        try:
            r = requests.get(STATUS_URL.format(job_id), timeout=10)
            if r.status_code == 200:
                s = r.json()
                status = s.get("status")
                print(job_id, status)
                if status and status.upper() in ("COMPLETED", "FAILED"):
                    break
        except Exception as e:
            print("status poll error:", e)
        time.sleep(2)

    if status and status.upper() == "COMPLETED":
        print("Fetching result for", job_id)
        r = requests.get(RESULT_URL.format(job_id), timeout=30)
        if r.status_code == 200:
            out_file = OUT_DIR / f"{job_id}.result.json"
            out_file.write_text(r.text, encoding="utf-8")
            print("Saved result to", out_file)
        else:
            print("Failed to fetch result", r.status_code, r.text)
    else:
        print(f"Job {job_id} did not complete (status={status}).")

print("All done")
