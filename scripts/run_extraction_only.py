#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import requests


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT / "data" / "eval" / "extraction_only"


def _pdfs_from_path(path: Path) -> list[Path]:
    if path.is_file() and path.suffix.lower() == ".pdf":
        return [path.resolve()]
    if path.is_dir():
        return sorted(p.resolve() for p in path.glob("*.pdf"))
    return []


def _post_extract(url: str, report_id: str, pdf_paths: list[Path], timeout: int) -> dict[str, Any]:
    payload = {
        "report_id": report_id,
        "file_paths": [str(path) for path in pdf_paths],
    }
    response = requests.post(f"{url.rstrip('/')}/extract", json=payload, timeout=timeout)
    try:
        body = response.json()
    except Exception:
        body = {"raw_response": response.text}
    return {
        "status_code": response.status_code,
        "ok": response.ok,
        "request": payload,
        "response": body,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run only extraction against real PDF files")
    parser.add_argument("path", help="PDF file or folder containing PDFs")
    parser.add_argument("--url", default="http://127.0.0.1:8001", help="Extraction service base URL")
    parser.add_argument("--report-id", default=None, help="Report id to use in batch mode")
    parser.add_argument("--mode", choices=["batch", "per-file"], default="batch")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Directory for JSON results")
    parser.add_argument("--timeout", type=int, default=1800, help="Request timeout in seconds")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pdf_paths = _pdfs_from_path(Path(args.path))
    if not pdf_paths:
        raise SystemExit(f"No PDF files found at {args.path}")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if args.mode == "batch":
        report_id = args.report_id or f"extraction_only_{stamp}"
        results = [_post_extract(args.url, report_id, pdf_paths, args.timeout)]
    else:
        results = []
        for pdf_path in pdf_paths:
            report_id = args.report_id or f"extraction_only_{pdf_path.stem}_{stamp}"
            results.append(_post_extract(args.url, report_id, [pdf_path], args.timeout))

    summary = {
        "generated_at": datetime.now().isoformat(),
        "mode": args.mode,
        "pdf_count": len(pdf_paths),
        "service_url": args.url,
        "results": results,
    }
    output_path = output_dir / f"extraction_only_{stamp}.json"
    output_path.write_text(json.dumps(summary, indent=2, ensure_ascii=True), encoding="utf-8")

    passed = sum(1 for result in results if result.get("ok"))
    print(f"Extraction-only run complete: {passed}/{len(results)} request(s) succeeded")
    print(f"Saved result JSON: {output_path}")
    for result in results:
        report_id = result.get("request", {}).get("report_id")
        print(f"- {report_id}: HTTP {result.get('status_code')}")


if __name__ == "__main__":
    main()
