# Operations Baseline

This document defines the minimum operational standards that every backend service in this repository should follow before public API launch.

## 1. Logging Standard
- Use structured JSON logs.
- Include these required fields in every log record:
  - `timestamp`
  - `level`
  - `service`
  - `logger`
  - `message`
- Prefer contextual fields when available:
  - `report_id`
  - `job_id`
  - `request_id`
  - `error_code`

## 2. Error Code Standard
- Use stable machine-readable `error_code` values.
- Keep `error_code` in payload metadata and key logs.
- Do not expose raw exceptions to API consumers.
- See `docs/ERROR_CODES.md` for canonical names.

## 3. Config Standard
- Every service config must include at least:
  - `service_name`
  - `service_port`
  - `log_level`
  - `redis_url`
  - `redis_key_prefix`
  - `redis_ttl_seconds`
  - model provider key/model fields
- Keep defaults conservative and production-safe.

## 4. Runtime Behavior
- Extraction should be non-blocking at API entry points where possible.
- If chunk-level extraction fails partially, continue processing remaining chunks.
- Always return one terminal status: `completed`, `partial`, or `failed`.
- Persist payloads with consistent metadata keys.

## 5. Production Readiness Checklist
- Structured logs enabled.
- Canonical error codes used for known failure classes.
- Health endpoint available.
- Basic smoke test path available.
- No deprecated model names in active config.

## 6. Rollout Pattern
Apply standards in this order per service:
1. Add structured logging utility.
2. Add local error code constants.
3. Replace free-text error codes in extraction paths.
4. Validate with service-level smoke tests.
5. Roll to next service.
