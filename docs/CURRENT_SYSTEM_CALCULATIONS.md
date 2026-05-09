# Current System Calculations and Derived Metrics

This document lists the calculations currently implemented in the codebase and the key thresholds/gating rules used by the running system.

## Scope

Included calculation layers:
- Extraction metrics and extraction quality gating.
- Analysis-service normalization, hard-validation gates, ratio math, confidence scoring, risk scoring, sector deltas.
- Node backend derived quality score.
- Frontend derived display buckets and summary counts.

Primary source files:
- `services/extraction_service/pipeline/gemini_statement_extractor.py`
- `services/extraction_service/app.py`
- `services/analysis_service/app.py`
- `services/analysis_service/analytics/ratio_engine.py`
- `services/analysis_service/analytics/risk_engine.py`
- `services/analysis_service/confidence/confidence_score.py`
- `services/analysis_service/validation/*.py`
- `nodeBackend/src/routes/pipelineRoutes.js`
- `frontend/src/components/*.jsx`

## 1) Extraction-Service Calculations

## 1.1 Mandatory Coverage and Confidence

From `extract_financial_statements_from_text(...)`:

- Mandatory metrics set size = 5:
  - `balance_sheet.total_assets`
  - `balance_sheet.total_liabilities`
  - `balance_sheet.total_equity`
  - `income_statement.revenue_or_interest_income`
  - `income_statement.net_profit`
- `metrics_extracted_count` = number of mandatory fields with numeric values.
- `extraction_confidence = metrics_extracted_count / 5` (capped at 1.0).
- Extraction status rule:
  - `completed` only if `metrics_extracted_count >= 5` and `quality_issues` is empty.
  - otherwise `failed`.

## 1.2 Quality Issue Checks

Quality flags include:
- Document year missing.
- Non-positive assets or revenue, negative liabilities.
- Unrealistic magnitude (absolute value > `1e14`) for key fields.
- Balance sheet identity mismatch when:
  - `abs(assets - (liabilities + equity)) / max(abs(assets), abs(liabilities + equity), 1) > 0.35`.

## 1.3 Dual-Pass Agreement

`_reconcile_dual_pass(...)`:
- For each tracked field, table-pass vs vision-pass values are compared.
- Agreement for numeric pair if relative gap <= `0.02`.
- `agreement_score = agrees / total_fields`.

## 1.4 Cashflow and Net-Income Repairs

`_repair_cashflow_consistency(...)` and `_normalize_net_income_linkage(...)` apply deterministic reconciliation:
- Enforces cash equation (opening + net change = closing) by inferring missing leg.
- Searches candidate combinations and picks best minimum relative-gap solution.
- Aligns net-income-linked fields across income, cashflow, equity sections.

## 1.5 Coverage Aggregate Stored Per Report

`services/extraction_service/app.py` stores extraction aggregate values:
- `metrics_extracted_count = sum(per-document metrics_extracted_count)`
- `avg_extraction_confidence = average(per-document extraction_confidence)`
- `avg_extraction_agreement = average(per-document dual_pass.agreement_score)`
- `avg_re_extraction_attempts = average(per-document re_extraction_attempts)`

## 2) Analysis-Service Pre-Analytics Calculations

## 2.1 Required Metric Count for Ratio Eligibility

`_required_ratio_metric_count(...)` counts present values among:
- total_assets, total_liabilities, total_equity, net_profit, revenue_or_interest_income.

Year is ratio-eligible only if this count is >= 5.

## 2.2 Scale Drift Normalization

`_normalize_year_scale(...)`:
- Computes median log10 magnitude per metric across years.
- Tests multipliers: `1, 1e2, 1e3, 1e4, 1e6, 1e-2, 1e-3, 1e-4, 1e-6`.
- Applies multiplier if original mismatch is large and correction materially improves fit:
  - original distance >= 2.0 log units, and
  - improvement >= 1.0 log unit.

## 2.3 Cross-Statement Stabilization

`_stabilize_cross_statement_consistency(...)`:
- If assets and liabilities exist: impute/reconcile equity as `assets - liabilities`.
- Align net income across income, cashflow, equity where mismatch > 20% relative difference.

## 2.4 Restatement Event Detection

During multi-document merge, an event is logged when same year/metric has:
- both old and new numeric values, and
- relative difference > `0.03`.

## 3) Hard Validation Gates (Analysis)

`_hard_validation_gates(...)` has 5 gates:

1. Gate 1: Balance sheet identity
- Fails if relative gap between assets and liabilities+equity > `0.03`.

2. Gate 2: Cash reconciliation
- Fails if relative gap between opening+net_change and closing > `0.03`.
- Missing leg may be inferred if other two legs exist.

3. Gate 3: Net income linkage
- Compares net income across income, cashflow, equity.
- Fails if relative gap > `0.03`.

4. Gate 4: Multi-year continuity
- For assets, revenue, equity series.
- YoY jump threshold = `3.0 * year_gap`.
- Fails when absolute YoY exceeds threshold.

5. Gate 5: Unit consistency
- Fails if more than one currency or multiplier appears across years.

If any gate fails:
- analysis enters restricted mode,
- advanced analytics are blocked/reduced,
- confidence is later capped (see section 6.4).

## 4) Ratio Engine Formulas

Implemented in `services/analysis_service/analytics/ratio_engine.py`.

## 4.1 Growth Metrics

- YoY growth:
  - `revenue_growth_yoy = (rev_t - rev_t-1) / abs(rev_t-1)`
  - similarly for net profit, operating profit, EPS, assets, equity.
- CAGR-like growth (for revenue/profit/assets/equity series):
  - `((last / first)^(1/periods)) - 1`, with safeguards for missing/non-positive first value.

## 4.2 Profitability and Return Ratios

- `gross_margin = gross_profit / revenue`
- `ebitda_margin = ebitda / revenue`
- `operating_margin = operating_profit / revenue`
- `net_margin = net_profit / revenue`
- `return_on_equity (roe) = net_profit / avg(equity_t, equity_t-1)` (fallback to current equity)
- `return_on_assets (roa) = net_profit / avg(assets_t, assets_t-1)` (fallback to current assets)
- `roce = operating_profit / (assets - current_liabilities)`
- `roic = operating_profit / (debt + equity)`

## 4.3 Liquidity and Solvency

- `current_ratio = current_assets / current_liabilities`
- `quick_ratio = (current_assets - inventory) / current_liabilities`
- `cash_ratio = cash / current_liabilities`
- `operating_cash_flow_ratio = operating_cash_flow / current_liabilities`
- `debt_to_equity = debt / equity` (debt falls back to liabilities if missing)
- `debt_ratio = debt / assets`
- `financial_leverage_ratio = assets / equity`
- `interest_coverage = operating_profit / interest_expense`

## 4.4 Efficiency and Working Capital

- `asset_turnover = revenue / assets`
- `inventory_turnover = cost_of_revenue / inventory`
- `inventory_days = 365 / inventory_turnover`
- `receivable_days = (receivables / revenue) * 365`
- `payable_days = (payables / cost_of_revenue) * 365`
- `cash_conversion_cycle = receivable_days + inventory_days - payable_days`

## 4.5 Cash Quality and Shareholder Metrics

- `operating_cashflow_to_net_profit = operating_cash_flow / net_profit`
- `free_cash_flow = operating_cash_flow - capex_proxy`
  - where capex_proxy may use absolute investing cash flow if investing CF is negative.
- `free_cash_flow_growth = YoY(free_cash_flow)`
- `cash_conversion_quality_score = clamp(operating_cash_flow/net_profit, 0..1.5) / 1.5`
- `book_value_per_share` (if missing) = `equity / shares_outstanding`
- `earnings_yield = eps / price`
- `dividend_payout_ratio = dividends_paid / net_profit`
- `retention_ratio = 1 - dividend_payout_ratio`

## 4.6 Financial-Sector-Specific Ratios

- `net_interest_margin = net_interest_income / assets`
- `loan_to_deposit_ratio = loans / deposits`
- `cost_to_income_ratio = cost_of_revenue / operating_income_total` (fallback to revenue)
- `equity_to_assets_proxy = equity / assets`

## 4.7 Forensic Flags and Trend Diagnostics

Forensic conditions include patterns such as:
- Profit rising while operating cash flow falling.
- Debt growth > 25% YoY.
- Receivables or inventory growth outpacing revenue growth.
- Negative latest free cash flow.

Trend diagnostics:
- Linear slope of revenue growth series.
- Linear slope of profit growth series.
- Earnings volatility as sample standard deviation of net profit series.
- Growth consistency = positive growth count / growth observation count.

## 4.8 Ratio Guardrails

`_apply_ratio_guardrails(...)` nullifies out-of-range values:
- `revenue_growth_yoy` outside [-0.50, 1.50]
- `net_profit_growth_yoy` outside [-0.50, 1.50]
- `roe` outside [-0.50, 0.60]
- `debt_to_equity` outside [0.0, 10.0]
- `interest_coverage` outside [0.0, 50.0]

## 5) Data Reliability Report Score

`_build_data_reliability_report(...)`:
- Starts at 100.
- subtract `12 * gate_failures_count`
- subtract `min(20, 4 * error_issue_count)`
- subtract `min(10, 1 * warning_issue_count)`
- subtract `min(15, 2 * restatement_events_count)`
- subtract `min(15, 5 * data_gaps_count)`
- clamp to [0, 100]

Bands:
- high: >= 80
- medium: >= 60 and < 80
- low: < 60

## 6) Confidence and Risk Scoring

## 6.1 Confidence Score

`compute_confidence(...)` starts from `0.20` and applies weighted components:
- `+0.20 * statement_completeness`
- `+0.20 * validation_pass_rate`
- `+0.15 * unit_consistency`
- `+0.15 * multi_year_continuity`
- `+0.15 * year_coverage`
- `+0.10 * re_extraction_success`
- `+0.05 * ratio_coverage`
- `- issue_penalty`, where `issue_penalty = min(issue_count * 0.04, 0.30)`
- extra penalties:
  - `-0.1` if no ratios
  - `-0.1` if no KPIs
- final clamp to [0, 1]

Definitions:
- `ratio_coverage = min(1, numeric_ratio_count / 20)`
- `year_coverage = min(1, numeric_year_count / 3)`
- `validation_pass_rate = passed_gates / total_gates`
- `re_extraction_success = clamp(1 - ((avg_attempts - 1) / 3), 0..1)`

Confidence band:
- high: >= 0.8
- medium: >= 0.6 and < 0.8
- low: < 0.6

## 6.2 Risk Score Model

`compute_risk_signals(...)` computes component risk strengths from thresholds, then weighted score:
- profitability weight 0.20
- liquidity weight 0.15
- debt weight 0.20
- cashflow weight 0.20
- growth stability weight 0.15
- accounting red flags weight 0.10

`overall_risk_score = weighted_score_0_1 * 100`

Risk band by score:
- low: 0-30
- moderate: 31-60
- high: 61-100

## 6.3 Sector Comparison

`compare_sector(...)` benchmarks latest values vs static targets:
- benchmarks:
  - current_ratio: 1.5
  - debt_to_assets: 0.55
  - return_on_assets: 0.08
- delta per metric = `actual - benchmark`.

## 6.4 Analysis Gating Thresholds

In analyze orchestration:
- Ratio engine blocked if no year reaches required metric count >= 5.
- Risk blocked if confidence score < 0.75.
- Risk blocked if latest ratio coverage < 0.25.
- Sector blocked if latest ratio coverage < 0.50.
- If hard validation fails:
  - restricted mode applies,
  - risk/sector are blocked,
  - confidence score is capped to max 0.25 and band forced low.

Note: `_latest_ratio_coverage` uses denominator 13 (`numeric_count / 13`) while confidence ratio coverage uses denominator 20 (`numeric_count / 20`).

## 7) Validation/Anomaly Checks (Additional)

- Schema validator raises missing statement issues if income/balance/cashflow sections are empty.
- Cross-statement validator flags when cashflow exists without income statement.
- Anomaly detector warns if absolute balance sheet value > `1e14`.

## 8) Node Backend Derived Quality Score (API Layer)

In `pipelineRoutes.js`, `deriveQualityScore(...)` for validated view:

- `avgRowConfidence = mean(validated_rows[*].confidence_score)`
- `issuePenalty = min(validation_issue_count * 0.04, 0.4)`
- `checkBonus = (passed_deterministic_checks / check_count) * 0.1` (if checks exist)
- `qualityScore = clamp(avgRowConfidence - issuePenalty + checkBonus, 0..1)`

This score is returned as `overall_data_quality_score` for validated payloads.

## 9) Frontend-Derived Display Metrics

These are UI summaries, not core analytics model outputs:

- Quality gauge percent = `round(score * 100)`.
- Quality color bands:
  - green if >= 0.8
  - amber if >= 0.5 and < 0.8
  - red if < 0.5
- Valid row count: confidence >= 0.6.
- Provisional row count: 0.4 <= confidence < 0.6.
- Confidence distribution buckets:
  - Weak [0.0, 0.4)
  - Moderate [0.4, 0.6)
  - High [0.6, 0.8)
  - Very High [0.8, 1.01)

## 10) Reporting Narrative Threshold Rules

`narrative_generator.py` uses threshold-based statements:
- Bull point if `net_margin > 0.1`.
- Bull point if `current_ratio >= 1.2`.
- Bear point if `overall_risk_score >= 61`.

These are narrative interpretation triggers, not upstream scoring formulas.

## 11) Output Stores and Artifacts (Calculation Results)

Main computed artifacts are stored in Redis keys such as:
- `report:{id}:extraction_coverage`
- `report:{id}:canonical_validated`
- `report:{id}:data_reliability_report`
- `report:{id}:ratios`
- `report:{id}:patterns`
- `report:{id}:confidence`
- `report:{id}:risk`
- `report:{id}:sector_comparison`
- `report:{id}:analysis_coverage`

These keys represent the current canonical calculation outputs consumed by API and frontend layers.
