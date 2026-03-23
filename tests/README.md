# Test Execution Guide

This repository follows step-based test suites aligned to `ROAD_MAP.md`.

## Structure
- `tests/step_01/` -> tests for roadmap Step 1 (config/logging/error code baseline)
- `tests/step_02/` -> tests for async parent-child jobs
- `tests/step_03/` -> tests for polling and retries (to be added)
- Continue this pattern for each implementation step.

## How to Run
From repository root:

```powershell
python -m unittest discover -s tests -p "test_*.py"
```

Run a single step suite:

```powershell
python -m unittest discover -s tests/step_01 -p "test_*.py"
```

Run Step 12 benchmark suite:

```powershell
python -m unittest discover -s tests/step_12 -p "test_*.py"
```

Generate the golden benchmark report (and fail build on regression):

```powershell
python scripts/run_golden_benchmark.py --metadata data/eval/golden_set_metadata.json --thresholds data/eval/thresholds.json --output data/eval/last_benchmark_report.json --fail-on-regression
```

Run Step 13 beta readiness suite:

```powershell
python -m unittest discover -s tests/step_13 -p "test_*.py"
```

Run beta readiness gate (and fail on blockers):

```powershell
python scripts/run_beta_readiness.py --benchmark-report data/eval/last_benchmark_report.json --ops-snapshot data/eval/ops_snapshot.json --output data/eval/last_beta_readiness_report.json --fail-on-blocker
```

Run Step 14 release readiness suite:

```powershell
python -m unittest discover -s tests/step_14 -p "test_*.py"
```

Run public launch readiness gate:

```powershell
python scripts/run_release_readiness.py --benchmark-report data/eval/last_benchmark_report.json --beta-report data/eval/last_beta_readiness_report.json --readiness-snapshot data/eval/release_readiness_snapshot.json --output data/eval/last_release_readiness_report.json --fail-on-blocker
```

## Rules
- Every roadmap step should include at least one automated test suite before moving to the next step.
- Keep tests deterministic and independent of external services where possible.
- Mock model/API/network dependencies in unit tests.
