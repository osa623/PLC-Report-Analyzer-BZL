FRONTEND UPGRADE ADDENDUM — STRICTLY VISUAL + STATE LOGIC ONLY
Theme, fonts, colors, spacing scale and component library must remain unchanged.

The UI currently behaves like a finished analytics dashboard even when the backend has not produced validated data. This is the primary UX failure. The frontend must become a truthful pipeline monitor, not a fake results renderer.

No redesign. Only behavior, hierarchy, states, and conditional rendering changes.

GLOBAL FRONTEND PRINCIPLE

The interface must never imply that analysis exists when the validation gate has not passed.

The dashboard becomes a state-driven interface fully controlled by backend pipeline status.

The frontend must render one of three mutually exclusive states:

PROCESSING
EXTRACTION_FAILED
AUDIT_READY

The current UI shows AUDIT_READY prematurely. This must stop.

SECTION 1 — NEW GLOBAL PIPELINE STATUS CONTRACT

Backend must return a single global status:

pipeline_status:

PROCESSING
EXTRACTION_INCOMPLETE
VALIDATED_READY

Frontend must render based ONLY on this flag.

Remove all assumptions based on partial data presence.

SECTION 2 — PROCESSING STATE UI

When pipeline_status = PROCESSING:

Dashboard must NOT render financial data components.

Replace entire dashboard content with a Pipeline Monitor View using existing cards and typography.

Display:

• Stage progress tracker (already exists — keep it)
• Live extractor thread status
• Retry attempts counter
• Pages processed / total pages
• Current stage description

Add stage descriptions:

Ingestion
Page classification
Statement detection
Multi-extractor voting
Cross-extractor reconciliation
Accounting validation
Coverage validation

Remove all financial metrics, charts, ratios, scores, and tables from this state.

SECTION 3 — EXTRACTION FAILED STATE UI

When pipeline_status = EXTRACTION_INCOMPLETE:

The system must NOT render the analytics dashboard.

Replace dashboard with Extraction Audit Report View.

This page must show:

Top summary card:
Extraction Status: INCOMPLETE
Reason: Validation gate failed

Add failure panels:

Missing Statements per year
Coverage percentage per statement
Failed accounting equations
Years blocked by validation gate
Number of retries performed

Show explicit message:
“Financial analysis blocked until minimum data coverage is achieved.”

Remove:
• health score
• confidence score
• risk gauges
• ratio charts

These must not exist in this state.

SECTION 4 — VALIDATED READY STATE UI

When pipeline_status = VALIDATED_READY:

Render the existing dashboard layout.

BUT apply strict conditional rendering rules.

Every widget must require its data inputs.

If a widget lacks required inputs → show component-level “Insufficient validated data”.

No empty charts.
No zero values.
No placeholder percentages.

SECTION 5 — CONFIDENCE + QUALITY DISPLAY FIX

Remove hardcoded:

Quality %
Confidence %
Health Score
Risk Score

Replace with backend-provided computed metrics only.

Add tooltip under confidence score:

“Confidence is calculated from extraction coverage, cross-extractor agreement and accounting validation.”

SECTION 6 — DATA COMPLETENESS VISUALIZATION

Add a new card at top of dashboard (reuse existing card style):

DATA COMPLETENESS

Display per year:
Income Statement coverage %
Balance Sheet coverage %
Cash Flow coverage %
Accounting validation score %

This card must always appear when VALIDATED_READY.

SECTION 7 — WIDGET GUARD CONDITIONS

Before rendering any ratio or chart:

Check required inputs exist.

Examples:

ROE requires:
Net Income + Equity

Current Ratio requires:
Current Assets + Current Liabilities

If inputs missing → show muted placeholder:
“Waiting for validated inputs”

Never compute partial ratios.

SECTION 8 — REMOVE FAKE SUCCESS SIGNALS

Remove or gate:

Green “Analysis Complete” indicators
Health gauges
Risk dials
Pattern detection results

These must only appear after VALIDATED_READY.

SECTION 9 — PROCESSING TIME COMMUNICATION

Add text under pipeline tracker:

“Audit mode prioritizes accuracy over speed. Processing may take several minutes.”

This removes the false expectation of instant analysis.

SECTION 10 — FINAL UX OUTCOME

User journey becomes:

Upload → watch real pipeline → either
Extraction failure report
or
Validated financial dashboard

The UI must never again display fabricated completeness or hardcoded confidence.






-- backend system -- 


MASTER IMPLEMENTATION PROMPT — FINANCIAL PDF AUDIT PIPELINE UPGRADE

You are a senior backend engineer tasked with converting an existing “fast demo” financial-PDF analyzer into a production-grade audit pipeline.
The system already has three microservices and their boundaries must NOT change:

• extractor-service
• analysis-service
• report-service

You are NOT allowed to redesign the architecture again.
You must UPGRADE the behaviour inside the services and the orchestration logic only.

The current system produces dashboards even when extraction failed. Confidence, quality scores and ratios are partly hard-coded. Extraction is single-pass and optimized for speed instead of accuracy. Validation happens after analysis instead of before analysis. The pipeline shows success even when threads fail.

Your task is to transform this into a validation-gated audit pipeline.

GLOBAL PRINCIPLE

The system must behave like a financial auditor, not a demo.
Analysis and report generation are forbidden unless extraction passes strict validation gates.

The pipeline must prefer correctness over speed.
Slow execution is acceptable. Fake completeness is forbidden.

SECTION 1 — PIPELINE ORCHESTRATION (CRITICAL)

Replace the current “task completion pipeline” with a validation gated pipeline.

The new pipeline stages must be:

Document ingestion
Page classification
Financial statement detection
Multi-extractor execution
Cross-extractor reconciliation
Accounting validation
Coverage scoring gate (BLOCKING)
Financial analysis
Report generation

Stages 5–7 are HARD GATES.
If any gate fails, the pipeline must stop and return EXTRACTION_INCOMPLETE.

The UI and API must never mark the pipeline as completed unless stage 7 passes.

SECTION 2 — EXECUTION MODES

Introduce two execution modes:

FAST_MODE (kept only for dev testing)
• single LLM pass
• no OCR
• no retries

AUDIT_MODE (default)
• OCR enabled
• page image rendering at 300 DPI
• multi extractor voting
• retry logic for failed pages
• statement re-scan if missing
• accounting validation required

All production analysis must run in AUDIT_MODE.

SECTION 3 — EXTRACTOR SERVICE UPGRADE

The extractor-service currently uses a single extraction strategy. Replace with a multi-extractor voting system.

For each detected financial statement page run FOUR extractors:

Extractor A — Table parser
Use table detection and structured table parsing.

Extractor B — Financial regex parser
Detect totals using patterns like:
Total Assets
Total Equity
Net Profit
Net Cash from Operating Activities

Extractor C — LLM structured parser
Force JSON schema output for financial statements.

Extractor D — Totals inference engine
If line items exist but totals missing, compute totals and mark them as inferred.

RECONCILIATION RULES

For each numeric field:

If two or more extractors agree → accept value
If only one extractor returns value → retry page extraction
If no extractors return value → mark field missing

If a statement page fails extraction → trigger retry pipeline.

SECTION 4 — RETRY STRATEGY

When extraction fails for a page:

Retry 1: render page image + OCR + rerun extractors
Retry 2: page segmentation + rerun extractors
Retry 3: LLM fallback full page extraction

If still failing → mark statement missing.

Thread failures must never be silently ignored.

SECTION 5 — ACCOUNTING VALIDATION ENGINE

Create a strict accounting validation module.

Mandatory equations per year:

Assets = Liabilities + Equity
Opening Cash + Net Cash Flow = Closing Cash
Net Profit → flows into Equity changes
Subtotals must sum correctly when present

Each satisfied equation increases validation score.
Each failed equation blocks the pipeline.

SECTION 6 — COVERAGE GATE (MOST IMPORTANT)

Analysis-service must NEVER run if minimum data coverage is not met.

Minimum required coverage per year:

Income Statement ≥ 80% fields present
Balance Sheet ≥ 70% fields present
Cash Flow ≥ 60% fields present

If any year fails this → return EXTRACTION_INCOMPLETE and stop pipeline.

This gate prevents fake ratios and empty dashboards.

SECTION 7 — REMOVE ALL HARDCODED VALUES

Delete every fallback value in UI and backend including:

quality score
confidence score
financial health score
risk score
financial ratios

Dashboard must display “Awaiting validated data” until gates pass.

No default percentages are allowed anywhere.

SECTION 8 — REAL CONFIDENCE SCORING

Confidence must be computed mathematically.

Extraction Confidence per year:

confidence =
(
statement_coverage_score * 0.35 +
cross_extractor_agreement * 0.25 +
accounting_validation_score * 0.25 +
numeric_density_score * 0.15
) * 100

Definitions:

statement_coverage_score
= statements found / 3

cross_extractor_agreement
= % of fields confirmed by ≥2 extractors

accounting_validation_score
= passed_equations / total_equations

numeric_density_score
= extracted_numbers / expected_numbers

If data missing → confidence drops automatically.

SECTION 9 — ANALYSIS SERVICE RULES

Analysis-service must run ONLY after validation gate passes.

Ratios must only use extracted values.
If required inputs missing → ratio must not be computed.

No placeholder ratios allowed.

SECTION 10 — REPORT SERVICE RULES

Report generation must run only if analysis succeeded.

If extraction incomplete → generate an extraction failure report instead of financial report.

Failure report must list:
• missing statements
• failed equations
• coverage per year
• retry attempts performed

SECTION 11 — EXPECTED BEHAVIOUR AFTER IMPLEMENTATION

System must:

Spend minutes, not seconds, on analysis.
Retry failed pages automatically.
Block analysis when data missing.
Compute confidence from measurable metrics only.
Never show green pipeline with incomplete data.

The final product must operate as an automated financial auditor.

