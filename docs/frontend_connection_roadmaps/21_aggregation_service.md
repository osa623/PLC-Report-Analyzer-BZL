# aggregation_service - Frontend Connection Roadmap

## Service Role
Builds canonical_raw dataset from extracted rows and stores in Redis.

## Base URL
- Local direct: http://localhost:8019
- Docker direct: http://localhost:8019

## Recommended Frontend Access Pattern
Internal pipeline-only service in most deployments.

## Endpoints
- POST /aggregate-report
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
  "status": "aggregated",
  "canonical_key": "report:{id}:canonical_raw",
  "row_count": 120
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
Acts before validation_engine; not intended as direct browser API.


