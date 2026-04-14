from __future__ import annotations

from platform_core.contracts.canonical_dataset import CanonicalRawReport, ValidationIssue


def detect_anomalies(canonical: CanonicalRawReport) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    for item in canonical.financial_statements.balance_sheet:
        if abs(item.value) > 1e14:
            issues.append(ValidationIssue(code="ANOMALY_OUTLIER", message=f"Potential outlier: {item.label}", severity="warning"))
    return issues
