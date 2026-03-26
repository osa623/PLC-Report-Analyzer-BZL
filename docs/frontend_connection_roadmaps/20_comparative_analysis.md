# comparative_analysis - Frontend Connection Roadmap

## Service Role
Builds comparative analytics across multiple report IDs in a batch.

## Base URL
- Local direct: http://localhost:8015
- Docker direct: http://localhost:8015

## Recommended Frontend Access Pattern
Frontend can poll batch result via orchestrator endpoint first; direct call is optional for internal tools.

## Endpoints
- POST /analyze-comparative
- POST /get-batch-result
- GET /health

## Request Shape
```json
{
  "batch_id": "uuid",
  "report_ids": ["id1", "id2"],
  "company": { "symbol": "ABC", "name": "ABC PLC", "sector": "Banking" }
}
```
## Response Shape
```json
{
  "batch_id": "uuid",
  "status": "processing|completed|failed"
}
```
## Connection Roadmap
1. Add an environment variable in the external frontend repo for this service URL.
2. Build a typed API client module for this service with timeout and retry guards.
3. Create a UI data model that maps backend payload fields to view-model fields.
4. Add loading, success, empty, and error UI states for every endpoint call.
5. Implement validation for required input fields before making network requests.
6. Add telemetry logs for request start, success, failure, and latency.
7. Add integration tests that mock this service and verify expected UI behavior.

## Integration Notes
Batch result polling returns not_found until artifacts are produced and persisted.


