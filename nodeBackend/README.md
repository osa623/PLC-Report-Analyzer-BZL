# Node Backend API

This is the single Node backend layer between frontend and Python services.

Flow:
- Frontend calls Node backend endpoints
- Node backend orchestrates extraction, analysis, reporting Python services
- Artifacts are exchanged through Redis
