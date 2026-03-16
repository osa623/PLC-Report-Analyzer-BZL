# Financial Intelligence Platform Backend Architecture

## Repository Structure

```
.
|-- database/
|   `-- schema.sql
|-- docker-compose.yml
|-- nodeBackend/
|   |-- Dockerfile
|   |-- .env.example
|   |-- package.json
|   `-- src/
|       |-- app.js
|       |-- server.js
|       |-- clients/
|       |   |-- financialStatementAdapter.js
|       |   `-- serviceClient.js
|       |-- config/
|       |   |-- container.js
|       |   |-- env.js
|       |   |-- logger.js
|       |   `-- serviceRegistry.js
|       |-- controllers/
|       |   `-- reportController.js
|       |-- middleware/
|       |   `-- errorHandler.js
|       |-- repositories/
|       |   |-- companyRepository.js
|       |   |-- db.js
|       |   `-- reportRepository.js
|       |-- routes/
|       |   |-- healthRoutes.js
|       |   `-- reportRoutes.js
|       |-- services/
|       |   `-- reportService.js
|       |-- utils/
|       |   |-- asyncHandler.js
|       |   `-- errors.js
|       `-- workflow/
|           |-- pipelineEngine.js
|           |-- states.js
|           `-- workflowOrchestrator.js
|-- document_parser/
|-- structure_detector/
|-- financial_statement_extractor/
|-- balance_sheet_extractor/
|-- cashflow_extractor/
|-- ratio_calculator/
|-- segment_extractor/
|-- governance_extractor/
|-- risk_extractor/
|-- esg_extractor/
|-- strategy_nlp/
|-- kpi_sector_engine/
|-- pattern_detection/
`-- report_generator/
```

Each Python service follows:

```
service_name/
|-- api/routes.py
|-- core/config.py
|-- core/database.py
|-- core/dependencies.py
|-- models/schemas.py
|-- repositories/report_repository.py
|-- services/processor.py
|-- workers/worker.py
|-- main.py
|-- requirements.txt
`-- Dockerfile
```

## Service Communication Contracts

All services consume:

```json
{
  "report_id": "<uuid>",
  "file_path": "/path/to/report.pdf"
}
```

Endpoints:

- document_parser: `POST /parse-document`
- structure_detector: `POST /detect-structure`
- financial_statement_extractor: `POST /extract-financials`
- balance_sheet_extractor: `POST /extract-balance-sheet`
- cashflow_extractor: `POST /extract-cashflow`
- ratio_calculator: `POST /calculate-ratios`
- segment_extractor: `POST /extract-segments`
- governance_extractor: `POST /extract-governance`
- risk_extractor: `POST /extract-risks`
- esg_extractor: `POST /extract-esg`
- strategy_nlp: `POST /analyze-strategy`
- kpi_sector_engine: `POST /calculate-kpi`
- pattern_detection: `POST /detect-patterns`
- report_generator: `POST /generate-report`

## Design Pattern Placement

- Clean Architecture: strict `api -> service -> repository` flow in each microservice.
- Repository Pattern: DB writes through repository classes.
- Dependency Injection: `core/dependencies.py` in Python and `config/container.js` in Node.
- Factory Pattern: `ProcessingServiceFactory` and `KPIStrategyFactory`.
- Strategy Pattern: `kpi_sector_engine/services/kpi_strategies.py`.
- Adapter Pattern: `financial_statement_extractor/services/statement_adapter.py` and `nodeBackend/src/clients/financialStatementAdapter.js`.
- Pipeline Pattern: `nodeBackend/src/workflow/pipelineEngine.js`.
