# node_orchestrator - Frontend Connection Roadmap

## Service Role
Public API gateway for uploads, pipeline orchestration, report retrieval, and batch status polling.

## Base URL
- Local direct: http://localhost:3000
- Docker direct: http://localhost:3000

## Recommended Frontend Access Pattern
Use this as the primary API for the external frontend. Avoid calling internal microservices directly unless you are building an internal operations console.

## Endpoints
- POST /reports (multipart, field name: report)
- POST /reports/batch (multipart, field name: reports, max 10)
- GET /reports/:reportId
- GET /reports/:reportId/download
- GET /reports/batch/:batchId
- GET /health

## Request Shape
```json
{
  "symbol": "ABC",
  "name": "ABC PLC",
  "sector": "Banking",
  "report": "<PDF file>"
}
```

## Response Shape
```json
{
  "report": {
    "id": "uuid",
    "workflow_state": "PARSING|EXTRACTING|ANALYZING|COMPLETED|FAILED"
  },
  "generatedReport": {
    "status": "completed",
    "pdf_path": "path-or-null"
  }
}
```

## Connection Roadmap
1. Add environment variable in the external frontend repo for ORCHESTRATOR_API_URL.
2. Build a typed API client module for upload, polling, and report detail retrieval.
3. Implement multipart upload for POST /reports with report file and company metadata.
4. Implement polling for GET /reports/:reportId until workflow_state reaches COMPLETED or FAILED.
5. For batch flow, submit to POST /reports/batch and poll GET /reports/batch/:batchId.
6. Map report payload fields (data_views, analytics, narratives, confidence) into UI tabs/cards.
7. Add resilient error handling for 400, 404, and 500 API responses.

## Integration Notes
No authentication middleware is currently configured. Add auth and CORS controls before exposing this service publicly across origins.


