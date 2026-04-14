from __future__ import annotations

from enum import Enum


class PipelineStage(str, Enum):
    """Canonical workflow states for the data-first, validation-gated pipeline."""

    UPLOADED = "UPLOADED"
    PARSING = "PARSING"
    STRUCTURE_DETECTED = "STRUCTURE_DETECTED"
    EXTRACTING = "EXTRACTING"
    AGGREGATING = "AGGREGATING"
    VALIDATING = "VALIDATING"
    LOW_CONFIDENCE = "LOW_CONFIDENCE"
    ANALYZING = "ANALYZING"
    GENERATING_REPORT = "GENERATING_REPORT"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
