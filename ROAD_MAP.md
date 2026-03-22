# PLC Report Analyzer - Public Launch Roadmap

## 1. Purpose
This roadmap is a practical implementation plan for a single developer to take the current extraction stack to a production-ready public platform (web and mobile), where many users can upload up to 10 PDFs in one request.

The plan is designed to:
- Improve extraction accuracy and reliability
- Support concurrent users safely
- Control infrastructure and model costs
- Ship in incremental, testable steps

## 2. Current State Summary
Based on the current repository:
- Multiple extractor microservices are already in place
- Redis-backed chunking/extraction flow is being used in key services
- Gemini is the primary extraction model
- No separate dedicated OCR fallback layer is integrated in extraction services
- Orchestration exists, but public-scale safeguards and SLO-driven operations are not fully implemented yet

## 3. Solo Developer Strategy
As a single engineer, avoid a "big-bang" rewrite.

Use this execution model:
- Build one vertical slice end-to-end each sprint
- Add quality gates before adding features
- Automate testing and deployment early
- Keep a strict backlog with only P0 and P1 tasks
- Prefer managed services over custom infra where possible

## 4. Product and Technical Goals
### Product goals
- Public users can upload up to 10 PDFs per request
- Users can track progress per file and per job
- Users receive structured outputs and status (completed, partial, failed)

### Technical goals
- Stable async processing under concurrent load
- Better extraction quality on difficult/scanned pages
- Predictable latency and cost per job
- Observability and quick failure diagnosis

## 5. Target Architecture (Incremental)
### Core components
- API Gateway + Auth + Rate Limiting
- Upload API (accept request, store files, enqueue jobs)
- Job Orchestrator (state machine)
- Worker pools:
  - parser/chunker workers
  - extraction workers
  - validation workers
  - report assembly workers
- Data stores:
  - object storage for uploaded PDFs
  - Redis for job state/cache
  - SQL for durable metadata, billing, and audit
- Notifications:
  - polling endpoint first
  - optional push/WebSocket next

### Model strategy
- Primary extractor: Gemini
- Fallback extractor for low-confidence pages:
  - Google Document AI or Azure Document Intelligence
- Routing policy:
  - default to Gemini
  - fallback only when confidence and validation rules fail

## 6. Phased Roadmap (16 Weeks)

## Phase 0 (Week 1): Project Hygiene and Control
Goal: Establish guardrails so changes remain stable while moving fast.

Tasks:
- Create unified environment config template for all services
- Add centralized logging format (JSON logs with request_id and report_id)
- Add common error code taxonomy document
- Add baseline CI checks: lint, type checks (where possible), and smoke tests
- Define branching and release workflow

Deliverables:
- docs/OPERATIONS_BASELINE.md
- CI workflow for build + smoke tests
- Standard error codes implemented in active extraction paths

Exit criteria:
- One command path to run local stack checks
- All critical services emit structured logs consistently

## Phase 1 (Weeks 2-4): Async Job Pipeline for Public Traffic
Goal: Handle concurrent users and up to 10 PDFs per request safely.

Tasks:
- Introduce parent job and child file-job model
- Upload endpoint creates one parent job and N file jobs (N <= 10)
- Enqueue file jobs; do not process synchronously in request thread
- Add job status endpoints:
  - parent job summary
  - per-file child status
- Add retry policy and dead-letter queue pattern

Deliverables:
- Job model and job tables (or equivalent store)
- Queue-backed processing flow
- API docs for async submission and polling

Exit criteria:
- Upload returns quickly with job_id
- User can query progress and partial completion
- Failed child jobs do not crash entire parent job

## Phase 2 (Weeks 5-6): Validation and Confidence Layer
Goal: Improve trust and reduce silent bad outputs.

Tasks:
- Add schema validator after each extraction stage
- Add domain validators:
  - balance equation checks
  - period/year consistency
  - numeric normalization checks
- Add confidence scoring at row and section level
- Mark output statuses by confidence bands:
  - high confidence -> completed
  - medium confidence -> partial
  - low confidence -> reroute or failed

Deliverables:
- validation/ package with reusable checks
- confidence metadata in all extractor payloads

Exit criteria:
- Validation failures are explicit and traceable
- Downstream can identify uncertain records reliably

## Phase 3 (Weeks 7-8): OCR/Layout Fallback Integration
Goal: Increase extraction quality for scanned and complex layouts.

Tasks:
- Integrate one fallback provider (pick one first):
  - Option A: Google Document AI
  - Option B: Azure Document Intelligence
- Implement fallback trigger policy:
  - run fallback only for low-confidence chunks/pages
- Merge fallback output into existing transformation pipeline
- Add provider feature flag and kill switch

Deliverables:
- Fallback adapter service
- Router logic in extraction pipeline
- Provider-specific metrics dashboard

Exit criteria:
- Low-confidence pages improve accuracy vs baseline dataset
- No major latency regression on normal clean PDFs

## Phase 4 (Weeks 9-10): Cost and Abuse Protection
Goal: Keep service sustainable under public usage.

Tasks:
- Per-user and per-IP rate limiting
- Request limits (pages, file size, max files)
- Model usage guardrails:
  - max retries per chunk
  - timeout caps
  - fallback budget caps
- Add per-tenant metering fields
- Implement basic plan tiers (free/pro)

Deliverables:
- Quota enforcement middleware
- Usage metering tables and reports

Exit criteria:
- System protects itself from abusive or accidental heavy load
- Cost spikes can be identified and controlled

## Phase 5 (Weeks 11-12): Observability and SRE Minimums
Goal: Make operations predictable for one developer.

Tasks:
- Add service dashboards:
  - queue depth
  - worker throughput
  - failure rates by extractor
  - model latency and cost
- Add alerting for critical thresholds
- Add tracing across orchestrator and workers
- Create runbooks for top 10 incidents

Deliverables:
- docs/RUNBOOK.md
- dashboard definitions and alerts

Exit criteria:
- You can detect, diagnose, and recover from production issues quickly

## Phase 6 (Weeks 13-14): Accuracy Benchmark and Regression Suite
Goal: Prevent quality regressions over time.

Tasks:
- Build golden dataset (100-300 representative files/pages)
- Define evaluation metrics:
  - field-level precision/recall
  - numeric exact match
  - table structure correctness
- Add benchmark run command and report output
- Add regression gate in CI for major extractors

Deliverables:
- data/eval/ golden set metadata
- evaluation script + score report format

Exit criteria:
- Every major model/prompt change is measurable before release

## Phase 7 (Weeks 15-16): Public Launch Readiness
Goal: Ship with confidence and a rollback plan.

Tasks:
- Security and privacy checklist completion
- Data retention and deletion policy implementation
- Final load testing and tuning
- Staged rollout:
  - internal
  - limited beta
  - public
- Define rollback playbook and feature toggles

Deliverables:
- LAUNCH_CHECKLIST.md
- Versioned release notes template

Exit criteria:
- Platform can withstand expected launch load
- Rollback path is tested and documented

## 7. Prioritized Backlog (P0/P1/P2)
### P0 (must do before public launch)
- Async jobs and queue-based processing
- Status APIs and robust retries
- Schema + financial validation
- Rate limiting and request limits
- Structured logs + dashboards + alerting
- Model upgrade from deprecated defaults

### P1 (strongly recommended early)
- OCR/layout fallback integration
- Confidence-based routing
- Cost metering and plan enforcement
- Golden dataset evaluation pipeline

### P2 (after stabilization)
- Human-in-the-loop correction UI
- Auto-learning from corrected outputs
- Advanced tenant analytics and reporting

## 8. KPI Targets
Define measurable targets before production launch:

- Uptime for submit/status APIs: >= 99.9%
- Parent job terminal success (completed + partial): >= 98%
- P95 submit API latency: <= 2 seconds
- P95 first useful result availability: <= 60 seconds (normal docs)
- Extraction quality target by domain: set per extractor using benchmark set
- Cost per 100 pages: tracked daily and bounded by budget threshold

## 9. Single-Developer Weekly Operating Cadence
Use this cadence each week:
- Monday: plan sprint tasks and define acceptance criteria
- Tuesday to Thursday: implementation and unit/integration tests
- Friday morning: load/benchmark run + bug fixes
- Friday evening: release candidate + documentation update

Rule:
- Never start a new extractor feature without tests, metrics, and rollback path

## 10. Implementation Order (Exact Suggested Sequence)
1. Standardize config/logging/error codes
2. Build async parent-child job model
3. Add polling status endpoints
4. Add retries + dead-letter handling
5. Add schema/domain validators
6. Add confidence scoring metadata
7. Upgrade Gemini model configuration strategy
8. Add provider fallback adapter (Document AI or Azure DI)
9. Add confidence-gated routing
10. Add quota/rate limiting/cost guardrails
11. Add observability dashboards and alerts
12. Add golden dataset benchmark suite
13. Run beta launch and tune
14. Public release

## 11. Risks and Mitigations
### Risk: Model cost blow-up
Mitigation:
- Strict retry caps
- Fallback only for low-confidence chunks
- Per-user usage quotas

### Risk: Queue backlog during traffic spikes
Mitigation:
- Autoscaling workers
- Backpressure controls
- Priority queue for paid tiers

### Risk: Inaccurate financial extraction on noisy scans
Mitigation:
- OCR/layout fallback
- Financial validation checks
- human-review flag for low confidence

### Risk: Solo maintenance overload
Mitigation:
- Operational runbooks
- feature flags
- limit scope to P0/P1 until stable

## 12. Business Rollout Plan
### Pricing and packaging (initial)
- Free tier: low monthly page cap, low concurrency
- Pro tier: higher cap, priority queue, faster SLA
- Enterprise tier: custom quota and support

### Go-to-market sequence
- Closed beta with selected users
- Capture corrections and failure reports
- Patch top accuracy gaps
- Open public launch with guardrails

## 13. Decision Note for Fallback Provider
Choose one provider first, not both.

If your stack remains Google-centered:
- Choose Document AI first for simpler operational alignment

If your team/clients prefer Azure ecosystem:
- Choose Azure Document Intelligence

Do not integrate two fallback providers until one is stable and benchmarked.

## 14. Definition of Done for Public Launch
Launch is "done" only when all are true:
- Async multi-file processing stable under expected concurrency
- Accuracy benchmark meets target thresholds
- Cost and abuse controls are active
- Monitoring and incident response runbooks are live
- Data retention/privacy controls are implemented
- Rollback strategy is tested

## 15. Next Immediate Actions (This Week)
1. Create issue tracker entries for all P0 tasks from this roadmap
2. Implement async parent-child job submission and status endpoints
3. Add validation + confidence metadata into current extraction outputs
4. Update model configs away from deprecated defaults
5. Set up first production dashboard with queue depth and failure rate

---
This roadmap is intentionally execution-focused for one developer. Keep scope strict, ship in increments, and benchmark every major extraction change before release.
