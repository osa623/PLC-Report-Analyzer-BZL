from __future__ import annotations

from platform_core.contracts.canonical_dataset import ValidationIssue


def compute_patterns(validated, issues: list[ValidationIssue]) -> list[str]:
    patterns = []
    if issues:
        patterns.append("Validation friction detected")
    if validated.reextraction_required:
        patterns.append("Re-extraction recommended")
    if not patterns:
        patterns.append("Stable reporting pattern")
    return patterns
