# governance_extractor - Frontend Connection Roadmap

## Service Role
Extracts governance disclosures and stores narrative artifacts.

## Base URL
- Local direct: http://localhost:8008
- Docker direct: http://localhost:8008

## Recommended Frontend Access Pattern
Prefer indirect access via node_orchestrator pipeline.

## Endpoints
- POST /extract-governance
- POST /jobs/submit
- GET /jobs/{parent_job_id}
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
  "status": "processed|failed"
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
Narrative output is typically read later through GET /reports/:reportId on the orchestrator.


