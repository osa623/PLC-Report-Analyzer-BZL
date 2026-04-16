# Running the PLC Report Analyzer (local)

Prereqs:
- Python 3.11+ and git
- PostgreSQL installed and running (note Postgres should accept TCP connections on 5432)
- Either PostgreSQL or MongoDB. To use MongoDB instead of Postgres, install MongoDB and set `MONGO_URI` and `MONGO_DB` in your environment.
- A Redis instance (managed Redis URL can be set in `.env` as `REDIS_URL`)

Quick start:

1) Create and activate virtualenv:

```powershell
python -m venv .venv
. .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2) Export environment (or copy `.env`):

Set `DB_HOST`, `DB_PORT`, `DB_ADMIN`, `DB_ADMIN_PW`, `REDIS_URL` in `.env` or env vars.

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

4) Start services (use `scripts/start_services.ps1` to open service windows):

```powershell
.\scripts\start_services.ps1
```

Or start a single service manually, e.g.:

```powershell
. .\.venv\Scripts\Activate.ps1
$env:PYTHONPATH='d:/PLC-Report-Analyzer-BZL'
uvicorn services.extraction_service.app:app --host 0.0.0.0 --port 8001 --reload
```

5) Submit PDFs to the pipeline API (default port 8110):

POST `/submit` with `multipart/form-data` file field `file` to `http://localhost:8110/submit`.

6) Check `data/eval/` for generated artifacts; `services/reporting_service` exposes `/report/latest`.
