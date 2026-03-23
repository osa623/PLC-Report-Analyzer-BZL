# Canonical Error Codes

Use these canonical `error_code` values in payload metadata and logs.

## Redis and Input
- `missing_document_chunks_in_redis`
- `redis_fetch_error`
- `invalid_chunk_payload`

## Relevance and Filtering
- `no_relevant_chunks`
- `no_relevant_balance_sheet_chunks`
- `no_relevant_cashflow_chunks`
- `no_relevant_income_statement_chunks`
- `no_relevant_income_notes_chunks`
- `no_relevant_segment_chunks`
- `no_relevant_esg_chunks`
- `no_relevant_governance_chunks`
- `no_relevant_risk_chunks`

## Extraction Execution
- `chunk_extraction_orchestration_error`
- `all_chunk_extractions_failed`
- `gemini_or_transform_error`
- `extraction_error`

## Transformation and Validation
- `transformation_error`
- `schema_validation_failed`
- `financial_equation_validation_failed`
- `numeric_normalization_failed`

## Persistence
- `persist_result_failed`

## Usage Rules
- Keep names lowercase and snake_case.
- Do not rename existing public error codes without a migration plan.
- Add new codes here before using them in service code.
