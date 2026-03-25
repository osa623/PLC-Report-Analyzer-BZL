# Financial Intelligence Platform - Developer Handbook

This comprehensive guide serves as the primary reference for understanding, maintaining, and extending the PLC Report Analyzer platform.

---

## 1. System Architecture

The platform follows a **Microservices Architecture** orchestrated by a Node.js backend. The frontend is a Single Page Application (SPA) built with React.

### High-Level Data Flow

```mermaid
graph TD
    User[User] -->|Upload PDF| Frontend[React Frontend]
    Frontend -->|POST /api/reports| Orch[Node.js Orchestrator]
    Orch -->|Store Metadata| DB[(PostgreSQL)]
    Orch -->|Queue Job| Redis[Redis]
    Orch -->|Trigger Pipeline| Engine[Pipeline Engine]
    
    subgraph Extraction Pipeline
        Engine -->|1. Parse| Parser[Document Parser :8001]
        Engine -->|2. Structure| Struct[Structure Detector :8002]
        Engine -->|3. Extract| Fin[Financial Extractor :8003]
        Engine -->|3. Extract| Bal[Balance Sheet Extractor :8004]
        Engine -->|3. Extract| Cash[Cashflow Extractor :8005]
        Engine -->|4. Analyze| Ratio[Ratio Calculator]
        Engine -->|5. Generate| Gen[Report Generator]
    end
    
    Gen -->|Save PDF| Reports[Volume /reports]
    Orch -->|Store Results| DB
    Frontend -->|Poll Status| Orch
    Frontend -->|Download PDF| Orch
```

### Service Catalog

| Service Name | Port | Stack | Responsibility |
| :--- | :--- | :--- | :--- |
| **Frontend** | 5173 | React + Vite | User Interface, Dashboard, Visualizations |
| **Node Orchestrator** | 3000 | Node.js (Express) | API Gateway, Workflow Management, Aggregation |
| **PostgreSQL** | 5432 | Postgres 16 | Relational Data Storage |
| **Redis** | 6379 | Redis 7 | Caching, Job Queue State |
| **Document Parser** | 8001 | Python (FastAPI) | PDF text extraction, OCR (if needed) |
| **Structure Detector** | 8002 | Python (FastAPI) | TOC analysis, Section identification |
| **Financial Extractor** | 8003 | Python (FastAPI) | Income Statement extraction |
| **Balance Sheet Extractor** | 8004 | Python (FastAPI) | Balance Sheet line items |
| **Cashflow Extractor** | 8005 | Python (FastAPI) | Cash Flow Statement parsing |
| **... (Others)** | 8006+ | Python (FastAPI) | Governance, Risk, KPI, Strategy, etc. |

---

## 2. Environment Setup

### Prerequisites
*   **Docker & Docker Compose**: Essential for running the stack.
*   **Node.js**: v18+ (for local frontend/backend dev).
*   **Python**: 3.11+ (for local microservice dev).

### Configuration (`nodeBackend/.env`)

Create a `.env` file in `nodeBackend/` based on `.env.example`:

```ini
PORT=3000
NODE_ENV=development
UPLOAD_DIR=./uploads
# Control pipeline strictness (fail fast vs best effort)
PIPELINE_STRICT_ALL_BACKENDS=false
# Max concurrent reports in batch
BATCH_PIPELINE_CONCURRENCY=3
# Database Connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cse_finance
```

### Quick Start
1.  **Start Infrastructure**:
    ```bash
    docker-compose up -d postgres redis
    ```
2.  **Start All Services**:
    ```bash
    # Windows
    ./start_all_backends.ps1
    ```
3.  **Start Frontend**:
    ```bash
    cd frontend && npm install && npm run dev
    ```

---

## 3. Backend Development (Node.js Orchestrator)

The orchestrator (`nodeBackend/`) is the brain of the operation.

### Key Files
*   `src/server.js`: Application entry point.
*   `src/workflow/pipelineEngine.js`: **CRITICAL**. Defines the order in which Python services are called.
*   `src/services/reportService.js`: Business logic for handling uploads and batch processing.
*   `src/controllers/`: Route handlers.

### How to Add a New Workflow Step
1.  **Edit `pipelineEngine.js`**:
    Locate the `execute` method. Add a new service call in the appropriate array (e.g., `extractionCalls` or `analysisCalls`).

    ```javascript
    // Example: Adding a new 'Sentiment Analysis' step
    invokeParticipation("sentiment_analyzer", "/analyze-sentiment", {
      report_id: reportId,
      file_path: filePath
    })
    ```
2.  **Update `DashboardApp.jsx`**:
    Add the new service key to `SERVICES_MAP` so it appears in the UI.

### Database Interaction
*   Uses `pg` (node-postgres) for direct SQL queries.
*   Repositories (`src/repositories/`) encapsulate SQL logic.
*   **Schema**: managed in `database/schema.sql`.

---

## 4. Microservice Development (Python)

Each extractor is a standalone FastAPI application.

### Standard Project Structure
```
service_name/
├── main.py                 # FastAPI app entry point
├── Dockerfile              # Docker image definition
├── requirements.txt        # Python dependencies
├── api/
│   └── routes.py           # Endpoint definitions
├── core/
│   ├── config.py           # Settings (Pydantic BaseSettings)
│   └── dependencies.py     # DI (Dependency Injection)
├── models/
│   └── schemas.py          # Pydantic models (Input/Output contracts)
└── services/
    └── extraction_service.py # Core business logic
```

### Creating a New Extractor

**Step 1: Scaffold**
Copy an existing service (e.g., `balance_sheet_extractor`) to a new folder (e.g., `sentiment_analyzer`).

**Step 2: Define Contract (`models/schemas.py`)**
Define the input and output data structures.

```python
class SentimentResponse(BaseModel):
    report_id: str
    sentiment_score: float
    status: Literal["completed", "failed"]
```

**Step 3: Implement Logic (`services/extraction_service.py`)**
Write the code to process the text/PDF.

**Step 4: Expose Endpoint (`api/routes.py`)**
Create a POST endpoint that accepts `ProcessRequest` and returns your response model.

```python
@router.post("/analyze-sentiment", response_model=SentimentResponse)
def analyze(request: ProcessRequest, service: SentimentService = Depends(...)):
    # ... logic
    return result
```

**Step 5: Register in `docker-compose.yml`**
Add the new service definition, ensuring a unique port.

---

## 5. Frontend Development (React)

### Architecture
*   **Framework**: React 18 + Vite.
*   **Styling**: Tailwind CSS.
*   **State**: Local state + Polling (for real-time updates).

### Main Dashboard (`src/DashboardApp.jsx`)
*   **File Upload**: Uses `react-dropzone`.
*   **Progress Tracking**: Polls `/api/reports/batch/:id` and `/api/reports/:id`.
*   **Visualization**: Renders cards for each report with status chips for every service.

### Adding a New Visualization
1.  **Define Icon**: Import a new Lucide icon in `DashboardApp.jsx`.
2.  **Update `SERVICES_MAP`**:
    ```javascript
    sentiment: { name: "Sentiment", icon: Heart }
    ```
3.  **Highlighting Logic**:
    Update the `isProcessing` logic inside the map loop to include your new service key if it belongs to a specific workflow phase (e.g., `ANALYZING`).

---

## 6. Database Schema (`database/schema.sql`)

### Core Tables
*   **`companies`**: Stores static company metadata (Symbol, Name, Sector).
*   **`reports`**: The central entity. Tracks `workflow_state` (UPLOADED -> PARSING -> ... -> COMPLETED) and `pdf_path`.
*   **`income_statements`, `balance_sheets`, etc.**: Vertical-partitioned tables for storing specific extraction results.

### Migrations
Currently, schema changes are handled by editing `database/schema.sql`.
**Note:** In production, use a migration tool like `db-migrate` or `alembic`.

---

## 7. Troubleshooting & Debugging

### Common Issues

1.  **"Connection Refused"**:
    *   Check if the service is running: `docker ps`.
    *   Verify the port in `docker-compose.yml` matches the service's `main.py` (or `uvicorn` command).
    *   Ensure `nodeBackend` config points to the correct host (localhost vs docker service name).

2.  **"Pipeline Stuck"**:
    *   Check Orchestrator logs: `docker logs cse-node-orchestrator`.
    *   Check specific service logs: `docker logs cse-balance-sheet-extractor`.
    *   Redis might be down or unreachable.

3.  **PDF Not Generating**:
    *   Ensure `report_generator` service is running.
    *   Check permissions on the `uploads/` directory if running locally.

### Viewing Logs
```bash
# Follow logs for the orchestrator
docker logs -f cse-node-orchestrator

# Follow logs for a specific extractor
docker logs -f cse-financial-statement-extractor
```

### Accessing Database
```bash
docker exec -it cse-postgres psql -U postgres -d cse_finance
```
