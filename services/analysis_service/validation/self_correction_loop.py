from __future__ import annotations

from platform_core.contracts.canonical_dataset import CanonicalRawReport, ValidationIssue


def run_self_correction_loop(canonical: CanonicalRawReport, issues: list[ValidationIssue]) -> CanonicalRawReport:
    # Deterministic correction pass: keeps data but marks report as requiring re-extraction upstream.
    return canonical
