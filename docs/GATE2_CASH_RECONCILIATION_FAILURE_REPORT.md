# Gate 2 Cash Reconciliation Failure Report

## Purpose
This document explains the current system failure state for Gate 2 (cash reconciliation), what has already been improved, what is still failing, and what should be implemented next.

## Gate Definition
Gate 2 validates the cash flow identity:

Opening Cash + Net Cash Change = Closing Cash

The analysis service currently fails Gate 2 when relative error is greater than 3%.

## Current Status (Latest Regression)
Batch file: data/eval/real_pdf_batch_summary_gate2_fix.json

From the latest real-PDF run on 4 annual reports:

- 1 of 4 reports passed Gate 2
- 3 of 4 reports still failed Gate 2
- Gate 3 (net-income linkage) now passes across all 4 reports after cross-statement normalization upgrades

## Evidence of Remaining Failures
### 431_1677837108267.pdf
- Opening Cash: 25155288000000.0
- Net Cash Change: 56559583000000.0
- Closing Cash: 90071931000000.0
- Computed LHS: 81714871000000.0
- Relative gap: 9.2782%
- Result: Gate 2 failed

### 431_1709205218085.pdf
- Opening Cash: 90071931000.0
- Net Cash Change: 29488884000.0
- Closing Cash: 113001014000.0
- Computed LHS: 119560815000.0
- Relative gap: 5.4866%
- Result: Gate 2 failed

### sampa -.pdf
- Opening Cash: 113001014000.0
- Net Cash Change: -36022686000.0
- Closing Cash: 71672859000.0
- Computed LHS: 76978328000.0
- Relative gap: 6.8922%
- Result: Gate 2 failed

## Root Cause
The remaining failures are caused by inconsistent cash-flow triplet selection (opening, net change, closing) for the same reporting period.

Observed behavior:
- Value trace frequently selects all three fields from table-pass output
- The selected rows or columns are sometimes not from a mutually consistent year-column alignment
- As a result, extracted triplets are internally inconsistent even when each individual value looks plausible

This is a data selection and column-alignment problem, not a Gate 2 logic bug.

## What Was Already Implemented
The system now includes:

- Expanded cash-flow label coverage
- Equation-first cashflow reconstruction and candidate optimization
- Pairwise implied-value inference (if two values are known)
- Cross-statement net-income normalization (PAT/PBT/tax bridge)

Impact:
- Gate 3 improved to pass on all tested reports
- Gate 2 improved for one report, but not all

## Why Failures Persist
Even after equation-first optimization, candidate pools still include cross-column values in some layouts.

When the candidate set itself is misaligned by period/column, optimization cannot always find a <=3% reconciliation triple.

## Required Next Upgrade
Implement year-column locked extraction for cashflow reconciliation fields:

- Detect year headers and map numeric columns to years
- Constrain opening, net change, and closing to the same detected year column
- Use equation-first optimization only within that column-locked candidate subset
- Keep fallback to cross-column candidates only when same-column candidates are unavailable
- Persist selected column metadata in value trace for debugging

## Acceptance Criteria for Fix
A candidate fix is accepted when:

- Gate 2 passes for the current 4-PDF real-data set, or
- Any remaining failure has explicit trace evidence that source document values are inherently inconsistent
- Relative gap for selected triplets is <=3% on passing reports

## Operational Note
If services are started without reload, code changes require a full process restart before validation runs.
