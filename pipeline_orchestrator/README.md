# Pipeline Orchestrator

This service accepts PDF uploads at `/submit`, enqueues a job to Redis and provides a worker (`worker.py`) which consumes jobs and runs the extraction orchestrator to produce structured JSON output.

Run the API:

```bash
python -m pipeline_orchestrator.app
```

Run the worker:

```bash
python -m pipeline_orchestrator.worker
```

Environment variables:

- `REDIS_URL` — Redis connection string (default `redis://localhost:6379/0`)
- `PIPELINE_TMP` — temporary directory for uploaded PDFs
- `METRICS_PORT` — optional metrics port used by extraction orchestrator
