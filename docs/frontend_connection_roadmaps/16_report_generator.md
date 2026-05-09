# report_generator - Frontend Connection Roadmap

## Service Role
Generates single-report and batch-report PDF artifacts.

## Base URL
- Local direct: http://localhost:8014
- Docker direct: http://localhost:8014

## Recommended Frontend Access Pattern
Usually called by orchestrator. Frontend should consume generated paths via orchestrator report endpoints.

## Endpoints
- POST /generate-report
- POST /generate-batch-report
- GET /health

## Request Shape
```json
{
  "report_id": "uuid"
}
```
## Response Shape
```json
{
  "report_id": "uuid",
  "status": "completed|failed",
  "pdf_path": "path-or-null"
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
Direct browser access to pdf_path requires server-side static hosting or download proxy route.


