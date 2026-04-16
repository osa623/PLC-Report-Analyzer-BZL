import requests
from pathlib import Path
import sys
import os

PIPELINE_PORT = int(os.getenv("PIPELINE_ORCHESTRATOR_PORT", "8100"))
URL = f"http://127.0.0.1:{PIPELINE_PORT}/submit"
DATA_DIR = Path("services/data")

if not DATA_DIR.exists():
    print("data dir not found:", DATA_DIR)
    sys.exit(2)

pdfs = list(DATA_DIR.glob("*.pdf"))
if not pdfs:
    print("no pdfs found in", DATA_DIR)
    sys.exit(0)

for pdf in pdfs:
    print(f"Submitting {pdf.name}...")
    with open(pdf, "rb") as f:
        files = {"file": (pdf.name, f, "application/pdf")}
        try:
            r = requests.post(URL, files=files, timeout=120)
        except Exception as e:
            print("Request failed:", e)
            continue
        print(pdf.name, "->", r.status_code)
        try:
            print(r.json())
        except Exception:
            print(r.text)

print("Done")
