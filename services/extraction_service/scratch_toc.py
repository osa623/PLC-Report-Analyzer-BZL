import io
import sys
from pathlib import Path
sys.path.append(".")
import pdfplumber
from src.pipeline.pdf_image_orchestrator import _find_toc_page, _parse_statement_references, _extract_printed_page_number

PDF_PATHS = [
    "data/raw/hnb/Banking_HNB_2022.pdf",
    "data/raw/hnb/Banking_HNB_2023.pdf",
    "data/raw/commercial/Banking_COMB_2024.pdf",
    "data/raw/hnb/Banking_HNB_2024.pdf"
]

def main():
    for path_str in PDF_PATHS:
        print(f"--- Processing {path_str} ---")
        try:
            with pdfplumber.open(path_str) as pdf:
                try:
                    toc_pages = _find_toc_page(pdf)
                    print(f"TOC pages detected: {toc_pages}")
                    first_toc_text = pdf.pages[toc_pages[0] - 1].extract_text() or ""
                    toc_text = ""
                    for page_num in toc_pages:
                        text = pdf.pages[page_num - 1].extract_text() or ""
                        toc_text += "\n" + text
                    try:
                        printed = _extract_printed_page_number(first_toc_text)
                        print(f"Printed page (x): {printed}")
                        print(f"Offset (y-x): {toc_pages[0] - printed}")
                    except Exception as e:
                        print(f"Failed to extract printed page: {e}")
                    
                    refs = _parse_statement_references(toc_text)
                    print(f"References found: {refs}")
                except Exception as e:
                    print(f"Error finding TOC: {e}")
        except Exception as e:
            print(f"Error opening PDF: {e}")

if __name__ == "__main__":
    main()
