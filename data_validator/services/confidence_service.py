from typing import Any


class ConfidenceScorer:
    @staticmethod
    def _band_from_score(score: float) -> str:
        if score >= 80.0:
            return "high"
        if score >= 50.0:
            return "medium"
        return "low"

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

        band = self._band_from_score(score)

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

    def analyze_records(
        self,
        records: list[dict[str, Any]],
        section_keys: tuple[str, ...] = ("section", "category", "semantic_type", "entity_type"),
        max_samples: int = 10,
    ) -> dict[str, Any]:
        if not isinstance(records, list) or not records:
            return {
                "confidence_distribution": {"high": 0, "medium": 0, "low": 0},
                "confidence_samples": [],
                "confidence_section_summary": [],
            }

        distribution = {"high": 0, "medium": 0, "low": 0}
        samples: list[dict[str, Any]] = []
        section_stats: dict[str, dict[str, Any]] = {}

        for idx, record in enumerate(records):
            if not isinstance(record, dict):
                continue

            row_score = 100.0
            reasons: list[str] = []
            if record.get("year") is None:
                row_score -= 15.0
                reasons.append("missing_year")

            numeric_present = any(record.get(k) is not None for k in ("value", "amount", "score", "metric_value"))
            if not numeric_present:
                row_score -= 20.0
                reasons.append("missing_numeric_value")

            if not record.get("label") and not record.get("metric"):
                row_score -= 10.0
                reasons.append("missing_primary_label")

            row_score = max(0.0, min(100.0, row_score))
            band = self._band_from_score(row_score)
            distribution[band] += 1

            if len(samples) < max_samples and (band != "high" or idx < 3):
                samples.append(
                    {
                        "row_index": idx,
                        "band": band,
                        "score": round(row_score, 2),
                        "reasons": reasons or ["strong_structural_signals"],
                    }
                )

            section_name = "unclassified"
            for key in section_keys:
                value = record.get(key)
                if value:
                    section_name = str(value)
                    break

            section_entry = section_stats.setdefault(
                section_name,
                {"section": section_name, "count": 0, "score_sum": 0.0, "low_count": 0},
            )
            section_entry["count"] += 1
            section_entry["score_sum"] += row_score
            if band == "low":
                section_entry["low_count"] += 1

        section_summary = []
        for entry in section_stats.values():
            count = entry["count"] or 1
            section_summary.append(
                {
                    "section": entry["section"],
                    "count": entry["count"],
                    "average_score": round(entry["score_sum"] / count, 2),
                    "low_count": entry["low_count"],
                }
            )

        section_summary.sort(key=lambda item: (item["average_score"], -item["count"]))

        return {
            "confidence_distribution": distribution,
            "confidence_samples": samples,
            "confidence_section_summary": section_summary,
        }
