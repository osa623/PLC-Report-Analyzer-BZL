# structure_detector - Frontend Connection Roadmap

## Service Role
Detects report sections, statement regions, and structural metadata.

## Base URL
- Local direct: http://localhost:8002
- Docker direct: http://localhost:8002

## Recommended Frontend Access Pattern
Prefer indirect access through node_orchestrator pipeline.

## Endpoints
- POST /detect-structure
- GET /health

## Request Shape
```json
{
  "report_id": "uuid",
  "file_path": "absolute-path-to-pdf"
}
```
## Response Shape
```json
{
  "report_id": "uuid",
  "service": "structure_detector",
  "status": "SUCCESS|failed",
  "details": {}
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
Used right after parsing stage; usually not called from browser UI directly.


