from typing import Any


class ConfidenceScorer:
    def score(
        self,
        statement_type: str,
        records: list[dict[str, Any]],
        validation_result: dict[str, Any],
    ) -> dict[str, Any]:
        errors = int(validation_result.get("error_count", 0) or 0)
        warnings = int(validation_result.get("warning_count", 0) or 0)
        record_count = len(records) if isinstance(records, list) else 0

        score = 100.0
        score -= min(60.0, errors * 25.0)
        score -= min(25.0, warnings * 8.0)

        if record_count == 0:
            score -= 20.0
        elif record_count < 3:
            score -= 8.0

        score = max(0.0, min(100.0, score))

        if score >= 80.0:
            band = "high"
        elif score >= 50.0:
            band = "medium"
        else:
            band = "low"

        reasons: list[str] = []
        if errors:
            reasons.append("validation_errors_present")
        if warnings:
            reasons.append("validation_warnings_present")
        if record_count == 0:
            reasons.append("no_records_extracted")
        elif record_count < 3:
            reasons.append("low_record_count")
        if not reasons:
            reasons.append("strong_structural_signals")

        return {
            "statement_type": statement_type,
            "confidence_score": round(score, 2),
            "confidence_band": band,
            "confidence_reasons": reasons,
        }
