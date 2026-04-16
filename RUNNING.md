# Running the PLC Report Analyzer (local)

Prereqs:
- Python 3.11+ and git
- PostgreSQL installed and running (note Postgres should accept TCP connections on 5432)
- Either PostgreSQL or MongoDB. To use MongoDB instead of Postgres, install MongoDB and set `MONGO_URI` and `MONGO_DB` in your environment.
- A Redis instance (managed Redis URL can be set in `.env` as `REDIS_URL`)
- Node.js 18+ (for `nodeBackend`)

Quick start:

1) Create and activate virtualenv:

```powershell
python -m venv .venv
. .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2) Create one central environment file:

```powershell
Copy-Item .env.sample .env
```

Use this single `.env` for all services, including `services/annual-report-backend`.

At minimum set these values:
- `REDIS_URL`
- `DATABASE_URL`
- API keys you actually use (`GEMINI_API_KEY`, `OPENAI_API_KEY`, etc.)
- Port variables (`NODE_BACKEND_PORT`, `EXTRACTION_SERVICE_PORT`, `ANALYSIS_SERVICE_PORT`, `REPORTING_SERVICE_PORT`, `PIPELINE_ORCHESTRATOR_PORT`, `ANNUAL_REPORT_BACKEND_PORT`)

3) Create DB and apply schema (Postgres) or ensure MongoDB is running

Postgres (skip if using MongoDB):

```powershell
& .\.venv\Scripts\Activate.ps1
python scripts/apply_schema.py
```

MongoDB (if preferred):

1. Install MongoDB Community Server from https://www.mongodb.com/try/download/community and start the service.
2. Set environment variables (example):

```powershell
$env:MONGO_URI='mongodb://localhost:27017'
$env:MONGO_DB='plc'
```

The project includes `platform_core/mongo_client.py` which provides `get_mongo_db()` for services that use MongoDB.

4) Start all services at once (opens one window per service):

```powershell
.\scripts\start_services.ps1
```

Optional (disable hot reload for FastAPI services):

```powershell
.\scripts\start_services.ps1 -NoReload
```

Default unique ports:
- `nodeBackend`: 3000
- `extraction_service`: 8001
- `analysis_service`: 8002
- `reporting_service`: 8003
- `pipeline_orchestrator`: 8100
- `annual-report-backend`: 5000

Or start a single service manually, e.g.:

```powershell
. .\.venv\Scripts\Activate.ps1
$env:PYTHONPATH='d:/PLC-Report-Analyzer-BZL'
uvicorn services.extraction_service.app:app --host 0.0.0.0 --port 8001 --reload
```

5) Submit PDFs to the pipeline API (default port 8100):

POST `/submit` with `multipart/form-data` file field `file` to `http://localhost:8100/submit`.

6) Check `data/eval/` for generated artifacts; `services/reporting_service` exposes `/report/latest`.
