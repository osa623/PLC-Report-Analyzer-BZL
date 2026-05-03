import sys
import pdfplumber

def dump_toc(path_str):
    print(f"--- DUMPING TOC FOR {path_str} ---")
    with pdfplumber.open(path_str) as pdf:
        start_idx = -1
        for i in range(20):
            text = pdf.pages[i].extract_text() or ""
            if "contents" in text.lower() or "table of contents" in text.lower():
                start_idx = i
                break
        
        if start_idx != -1:
            for j in range(start_idx, start_idx + 6):
                if j < len(pdf.pages):
                    print(f"--- PAGE {j+1} ---")
                    lines = (pdf.pages[j].extract_text() or "").splitlines()
                    for line in lines:
                        if line.strip():
                            print(line.strip())

dump_toc("data/raw/commercial/Banking_COMB_2024.pdf")
