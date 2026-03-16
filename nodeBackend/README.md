# CSE Report Orchestrator

Node.js orchestration service implementing clean architecture layers:

- routes
- controllers
- services
- workflow
- repositories
- clients
- config

## Run

1. Copy `.env.example` to `.env`
2. Install dependencies: `npm install`
3. Start service: `npm run dev`

## Main Endpoint

- `POST /reports`
  - `multipart/form-data`
  - `report`: PDF file
  - `symbol`: company symbol
  - `name`: company name
  - `sector`: sector name
