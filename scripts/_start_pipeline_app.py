import importlib
import uvicorn

m = importlib.import_module('pipeline_orchestrator.app')
uvicorn.run(m.app, host='127.0.0.1', port=8100)
