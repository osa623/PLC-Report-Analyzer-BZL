import requests
from pathlib import Path
import sys

URL = "http://127.0.0.1:8100/submit"
pdf = Path("services/data/431_1646390362476.pdf")
if not pdf.exists():
    print("sample PDF not found:", pdf)
    sys.exit(2)

with open(pdf, "rb") as f:
    files = {"file": (pdf.name, f, "application/pdf")}
    r = requests.post(URL, files=files)
    print(r.status_code)
    try:
        print(r.json())
    except Exception:
        print(r.text)
