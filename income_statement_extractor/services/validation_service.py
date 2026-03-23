import json
from datetime import datetime, timezone
from numbers import Number
from typing import Any

FINANCIAL_STATEMENT_TYPES = {
    "balance_sheet",
    "cashflow_statement",
    "income_statement",
    "income_notes",
    "segment",
}


class ExtractionValidator:
    def validate_records(self, statement_type: str, records: list[dict[str, Any]]) -> dict[str, Any]:
        errors: list[str] = []
        warnings: list[str] = []

        if not isinstance(records, list):
            return {
                "errors": ["invalid_records_container"],
                "warnings": [],
                "error_count": 1,
                "warning_count": 0,
            }

        if not records:
            warnings.append("no_records_extracted")

        current_year = datetime.now(timezone.utc).year
        year_values: set[int] = set()
        seen_rows: set[str] = set()
        duplicate_count = 0

        for record in records:
            if not isinstance(record, dict):
                errors.append("record_is_not_object")
                continue

            row_fingerprint = json.dumps(record, sort_keys=True, default=str)
            if row_fingerprint in seen_rows:
                duplicate_count += 1
            else:
                seen_rows.add(row_fingerprint)

            raw_year = record.get("year")
            if raw_year is not None:
                if isinstance(raw_year, int):
                    year_values.add(raw_year)
                    if raw_year < 1990 or raw_year > current_year + 1:
                        errors.append("invalid_year_out_of_range")
                else:
                    errors.append("invalid_year_type")

            for key in ("value", "amount", "score", "metric_value"):
                value = record.get(key)
                if value is None:
                    continue
                if not isinstance(value, Number):
                    errors.append(f"invalid_numeric_field:{key}")

        if duplicate_count > 0:
            warnings.append("duplicate_records_detected")

        if statement_type in FINANCIAL_STATEMENT_TYPES and records and not year_values:
            warnings.append("missing_year_dimension")

        return {
            "errors": sorted(set(errors)),
            "warnings": warnings,
            "error_count": len(set(errors)),
            "warning_count": len(warnings),
        }

