# Deep Summary: Data-First, Validation-Gated Architecture

## Executive Summary

The platform is now organized around a strict data-quality spine:

1. Extract first.
2. Aggregate into a canonical raw dataset.
3. Validate and score confidence.
4. Gate analytics by quality threshold.
5. Generate outputs only from validated data.

This architecture shifts correctness responsibility from prompts to deterministic validation and traceable contracts.

## Why this Design is Strong

1. It separates extraction uncertainty from analytical certainty.
2. It creates one authoritative dataset contract for downstream services.
3. It forces auditability through source lineage and confidence metadata.
4. It turns quality into a measurable control surface, not a subjective judgment.

## Layer-by-Layer Behavior

### 1) Ingestion and Structure

- document_parser and structure_detector produce reusable chunk and layout artifacts.
- These become stable shared inputs for all extractors.
- This avoids extractor-level file re-parsing and improves consistency.

### 2) Parallel Extraction

- Financial and narrative extractors run concurrently with bounded worker pools.
- All extracted rows carry provenance (source chunk/page) so each value is traceable.
- Raw extraction remains intentionally permissive to maximize recall.

### 3) Aggregation Service

- Merges financial rows across extractors.
- Deduplicates overlapping values.
- Normalizes labels into canonical taxonomy.
- Aligns years and units into a single schema.
- Produces report:{report_id}:canonical_raw.

### 4) Validation Engine

Validation is not cosmetic. It is a hard gate.

Validation responsibilities:

1. Rule checks (balance equation, profitability sanity, cashflow consistency).
2. Cross-statement reconciliation (income/equity/cash links).
3. Data cleaning and anomaly detection.
4. Confidence scoring per row.
5. Global quality score computation.

Output becomes report:{report_id}:canonical_validated with confidence and error catalog.

### 5) Analytics Gating

- Gate compares overall_data_quality_score against ANALYTICS_QUALITY_THRESHOLD.
- If below threshold: transition to LOW_CONFIDENCE terminal path.
- If above threshold: run ratios, sector KPIs, and patterns.

This prevents contaminated analytics from weak extraction sets.

### 6) Report Generation and UI Transparency

- report_generator consumes validated financial data + confidence-aware analytics + validated narratives.
- Frontend inspection surfaces raw vs canonical_raw vs canonical_validated.
- Operators can debug by traversing persisted datasets rather than reading logs.

## Contract-Centric Guarantees

The system guarantee is contract-level, not service-level.

Required validated row fields:

1. canonical_label
2. value
3. year
4. entity_type
5. statement_type
6. confidence_score
7. validation_flags
8. source_chunk_id
9. page_number

If any of these are absent, analytics quality and auditability degrade immediately.

## Operational Benefits

1. Easier incident triage: each stage stores machine-inspectable artifacts.
2. Safer batch processing: each report is independently gated.
3. Better CI enforcement: golden benchmark + readiness gates align with architecture.
4. Reduced drift risk: shared contracts in platform_core/contracts unify schemas and key naming.

## Migration Reality for This Repository

This repository already implements the architecture physically as a 3-service consolidated runtime:

1. ingestion_extraction_platform: parsing, structure, extraction.
2. data_quality_intelligence_engine: aggregation, validation, gating, analytics, comparative.
3. reporting_delivery_service: reporting and inspection.

Therefore, "aggregation_service" and "validation_engine" are logical stages represented as modules inside data_quality_intelligence_engine, not separate deployables.

## Completion Criteria

The architecture should be considered fully compliant when all of the following are true:

1. Analytics never read report:{report_id} directly.
2. All analytics are sourced from canonical_validated rows only.
3. LOW_CONFIDENCE is implemented as a terminal quality path, not FAILED.
4. Frontend displays stage status, confidence, and provenance drilldown.
5. Comparative analysis stores eligibility and exclusion reasons with confidence context.

## Final Engineering Direction

Continue implementing by tightening contracts, not increasing prompt complexity:

1. Expand canonical taxonomy coverage.
2. Harden validation rules by statement type and industry edge cases.
3. Enforce contract tests at every stage boundary.
4. Keep confidence and lineage mandatory in all persisted outputs.
