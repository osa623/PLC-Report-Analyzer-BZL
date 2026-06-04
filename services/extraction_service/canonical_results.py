from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from .src.pipeline.llm_normalizer import LLMNormalizer

CANONICAL_FILENAME = "normalized_results.json"
CANONICAL_MISSING_ERROR = f"Canonical normalized dataset not found:\n{CANONICAL_FILENAME}"


def canonical_results_path() -> Path:
    configured = os.environ.get("NORMALIZED_RESULTS_PATH")
    if configured:
        return Path(configured).expanduser().resolve()
    return Path(__file__).resolve().parent / CANONICAL_FILENAME


def _company_from_pdf_name(pdf_name: str | None) -> str:
    if not pdf_name:
        return "Unknown"
    stem = Path(pdf_name).stem
    parts = [p for p in re.split(r"[_\-\s]+", stem) if p]
    if len(parts) >= 2 and not parts[1].isdigit():
        return parts[1]
    return "Unknown"


def persist_normalized_results(
    extraction_results: list[dict[str, Any]],
    source_names: list[str] | None = None,
    output_path: Path | None = None,
) -> list[dict[str, Any]]:
    """
    Persist the canonical normalized extraction batch.

    This runs after extraction has produced raw statement payloads. It does not
    change extraction behavior; it only enforces the canonical file contract.
    """
    normalizer = LLMNormalizer()
    normalized_payloads: list[dict[str, Any]] = []

    for index, result in enumerate(extraction_results):
        if not isinstance(result, dict):
            continue
        source_pdf = (
            source_names[index]
            if source_names and index < len(source_names)
            else str(result.get("pdf_name") or f"pdf_{index + 1}.pdf")
        )
        result["pdf_name"] = source_pdf
        normalized_payloads.append(
            normalizer.normalize(
                raw_data=result.get("statements", {}),
                company_name=str(result.get("company") or result.get("company_name") or _company_from_pdf_name(source_pdf)),
                source_pdf=source_pdf,
            )
        )

    target = output_path or canonical_results_path()
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = target.with_suffix(target.suffix + ".tmp")
        tmp_path.write_text(json.dumps(normalized_payloads, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        tmp_path.replace(target)
    except Exception as exc:
        raise RuntimeError(f"Canonical normalized dataset could not be written: {CANONICAL_FILENAME}: {exc}") from exc

    if not target.exists():
        raise RuntimeError(f"Canonical normalized dataset could not be written: {CANONICAL_FILENAME}")
    return normalized_payloads


def load_normalized_results(input_path: Path | None = None) -> list[dict[str, Any]]:
    path = input_path or canonical_results_path()
    if not path.exists():
        raise FileNotFoundError(CANONICAL_MISSING_ERROR)
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else [data]
