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

## Rules
- Every roadmap step should include at least one automated test suite before moving to the next step.
- Keep tests deterministic and independent of external services where possible.
- Mock model/API/network dependencies in unit tests.
