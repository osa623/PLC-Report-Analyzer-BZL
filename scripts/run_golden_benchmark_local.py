#!/usr/bin/env python3
"""Lightweight local benchmark runner that does not depend on cloud SDKs or LLMs.

This is a fallback runner for local development. It extracts plain text from PDFs
and writes a minimal normalized + extracted JSON so teams can validate pipeline IO.
"""
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "services" / "data"
OUT_DIR = ROOT / "data" / "eval" / "golden_results"
OUT_DIR.mkdir(parents=True, exist_ok=True)

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None


def process_pdf_local(pdf_path: Path):
    text = ""
    if PdfReader is not None:
        try:
            reader = PdfReader(str(pdf_path))
            for p in reader.pages:
                try:
                    text += p.extract_text() or ""
                except Exception:
                    pass
        except Exception:
            text = ""

    normalized = {
        "income_statement": {},
        "balance_sheet": {},
        "cash_flow": {},
        "confidence": 0.0,
    }

    extracted = {"cashflow": None}

    out = {
        "document_hash": pdf_path.stem,
        "ocr": {"raw_texts": {"primary": text}, "structured": {}, "confidence": 0.0},
        "normalized": normalized,
        "extracted": extracted,
    }
    return out


def main():
    pdfs = sorted([p for p in DATA_DIR.glob("*.pdf")])
    if not pdfs:
        print("No PDFs found in services/data/")
        return 1

    report = {"total": len(pdfs), "results": {}}
    for p in pdfs:
        print("Processing", p.name)
        res = process_pdf_local(p)
        out_path = OUT_DIR / f"{p.stem}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(res, f, indent=2)
        report["results"][p.name] = {"ok": True, "document_hash": res["document_hash"]}

    summary_path = ROOT / "data" / "eval" / "golden_benchmark_report_local.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("Wrote local benchmark report to", summary_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
