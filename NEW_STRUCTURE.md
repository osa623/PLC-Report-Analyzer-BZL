PLC Report Analyzer — Engineering Continuation Document

Version: Post-Architecture Refactor
Purpose: Turn the system into a stable, deterministic, high-accuracy financial report analysis platform.

1. PRIMARY OBJECTIVES
1.1 Immediate engineering goals
Eliminate duplicated infrastructure across microservices.
Stabilize the pipeline into a deterministic, testable workflow.
Introduce multi-layer validation to eliminate extraction errors.
Reach near-deterministic financial accuracy through:
Cross-statement validation
Rule engines
Confidence scoring
Fallback extraction strategies
Convert current services into thin domain plugins.

Absolute target: industrial reliability, not experimental AI.

2. CORE PROBLEM DIAGNOSIS

Current system weaknesses:

2.1 Massive infrastructure duplication

Each extractor contains its own:

redis client
gemini client
job service
observability
validation logic
repository layer

This causes:

inconsistent behaviour
drift between services
hard debugging
inconsistent retries/fallbacks
inconsistent prompt usage
2.2 AI used without deterministic guardrails

LLM extraction is treated as ground truth.
This guarantees numeric errors.

Financial documents require:

accounting equation validation
cross-year comparison checks
internal arithmetic validation
unit normalization
currency normalization

LLM alone cannot guarantee correctness.

2.3 No real pipeline orchestration

Node backend currently orchestrates services manually.
This causes:

fragile workflows
missing retry logic
no stage tracking
no deterministic ordering
2.4 Validation exists but is fragmented

Validation logic is scattered across services and duplicated.
There is no central validation engine.

3. TARGET ENGINEERING PRINCIPLE

LLM = extraction assistant
Rules = source of truth

Final numbers must be verified, corrected, reconciled and normalized before acceptance.

Accuracy is achieved through layered verification, not better prompting.

4. NEW SYSTEM LAYERS
5. PLATFORM CORE (SHARED BACKEND)

Create a new root module:

platform_core/

This becomes the backbone of all Python services.

5.1 service_base

Provides standard microservice bootstrap.

Must include:

FastAPI initialization
health endpoints
standard error responses
env loading
dependency injection
service registration metadata

Every service imports and starts from this base.

5.2 llm_gateway

Single LLM entry point.

All gemini_client.py copies must be deleted.

Responsibilities
Model routing
Primary model
Secondary fallback model
Emergency low-cost fallback
Retry policy
exponential backoff
structured retry reasons
Prompt version registry

Prompts must be versioned.

prompt_registry:
  income_statement_v1
  balance_sheet_v1
  cashflow_v1
Token + cost tracking

Every call logs:

tokens
latency
model
cost estimate
Structured output enforcement

LLM must return JSON only.
No raw text responses allowed.

5.3 job_framework

Unified async execution layer.

Replace all worker implementations.

Standard job lifecycle:

QUEUED → RUNNING → VALIDATING → COMPLETED → FAILED

Includes:

Redis queue wrapper
Worker base class
Progress tracker
Retry orchestration
Dead-letter queue

All services execute via this framework.

5.4 data_access

Single repository layer.

Remove all duplicated report_repository.py.

Create unified repositories:

report_repository
job_repository
pipeline_repository

Add:

transaction management
connection pooling
schema versioning
5.5 observability

Central logging and metrics.

Must provide:

structured logs
service metrics
pipeline metrics
extraction confidence metrics
validation failure metrics
6. VALIDATION FRAMEWORK (CRITICAL)

Create:

platform_core/validation_framework/

This is the key to accuracy.

Validation happens in 4 layers.

6.1 Layer 1 — Schema validation

Ensures:

all required fields present
correct data types
correct year labels
unit normalization

Reject invalid outputs immediately.

6.2 Layer 2 — Arithmetic validation

Examples:

Income statement:

Gross Profit = Revenue − COGS
Operating Profit = Gross Profit − OPEX
Net Profit = Profit Before Tax − Tax

Balance sheet:

Assets = Liabilities + Equity

Cashflow:

Net Change = Operating + Investing + Financing

Tolerance threshold:

absolute tolerance: 0.5%
else flagged as invalid
6.3 Layer 3 — Cross-statement validation

Examples:

Net income consistency:

Net income (Income Statement)
Net income (Cashflow)
Retained earnings movement (Equity)

Depreciation:

Income statement vs Cashflow reconciliation

Working capital movement:

Balance sheet vs Cashflow
6.4 Layer 4 — Multi-year consistency

Checks:

percentage change outliers
sign flips
unit mismatches
duplicated year columns

Detects common LLM errors.

6.5 Auto-correction engine

When validation fails:

Recalculate derived values
Attempt correction using formulas
If still failing → trigger LLM fallback extraction

This loop continues until:

validation passes
or
max retry reached

This mechanism drives accuracy toward deterministic correctness.

7. DOMAIN SERVICES (SIMPLIFIED)

All extractors become thin plugins.

Each service contains only:

api.py
schemas.py
prompts.py
domain_logic.py

They must not contain:

DB logic
Redis logic
worker logic
LLM client
observability
validation

All imported from platform_core.

8. PIPELINE ORCHESTRATOR (NEW)

Create new service:

pipeline_orchestrator/

This becomes the brain of the pipeline.

Pipeline stages:

Document parsing
Structure detection
Parallel extraction stage
Validation stage
Analytics stage
Aggregation stage
Report generation

Each stage:

tracked
retryable
resumable

Node backend stops orchestrating microservices.

9. GOLDEN DATASET & BENCHMARKING

Accuracy cannot improve without measurement.

Use existing:

data/eval/

Extend into full evaluation suite.

Must include:

manually verified ground truth JSON
multiple industries
multiple report formats

Metrics to compute:

field accuracy
arithmetic accuracy
cross-statement consistency
end-to-end report accuracy

CI must run:

golden benchmark
release readiness test

Every PR must preserve benchmark scores.

10. PROMPT ENGINEERING RULES

Prompts must:

request tables only
forbid explanations
enforce strict schemas
request confidence per field
require unit identification

Example requirement inside prompts:

"Return NULL if value not explicitly present."

Never allow hallucinated numbers.

11. CONFIDENCE SCORING SYSTEM

Each extracted field must include:

value
confidence
source_page
source_text_snippet

Low confidence values trigger:

re-extraction
fallback model
validation scrutiny
12. FAILURE HANDLING STRATEGY

Failure tiers:

Tier 1 — retry same model
Tier 2 — fallback model
Tier 3 — partial extraction accepted
Tier 4 — pipeline marked degraded

Pipeline must never crash entirely.

13. DEVELOPMENT PHASE PLAN
Phase 1

Build platform_core modules.

Phase 2

Create validation framework.

Phase 3

Convert 1 extractor to new architecture.

Phase 4

Convert remaining extractors.

Phase 5

Implement pipeline orchestrator.

Phase 6

Run benchmarks and tune prompts.

14. DEFINITION OF “100% ACCURACY”

Interpretation:

LLM extraction may contain noise.
Final stored financial outputs must be:

arithmetically correct
cross-statement consistent
unit normalized
schema complete

The validation + correction loop enforces this deterministically.