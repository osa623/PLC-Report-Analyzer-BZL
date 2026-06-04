from __future__ import annotations

from pathlib import Path
from typing import Any

from services.extraction_service.canonical_results import (
    CANONICAL_MISSING_ERROR,
    canonical_results_path,
    load_normalized_results,
)
from services.extraction_service.strict_pipeline import build_strict_extraction_dataset


def load_canonical_analysis_dataset(path: Path | None = None) -> dict[str, Any]:
    """
    Adapt the extraction service's normalized_results.json contract for analysis.

    The normalized file remains the only persisted financial dataset. The
    returned structure is an in-memory view for validators and calculators.
    """
    try:
        normalized_records = load_normalized_results(path or canonical_results_path())
    except FileNotFoundError as exc:
        raise FileNotFoundError(CANONICAL_MISSING_ERROR) from exc

    dataset = build_strict_extraction_dataset(normalized_records)
    dataset.setdefault("metadata", {})
    if isinstance(dataset["metadata"], dict):
        dataset["metadata"]["canonical_source"] = "normalized_results.json"
    return dataset
