# Step 13 Beta Rollout and Tuning Plan

## Staged Rollout
1. Internal rollout (team-only): 2 to 5 days
2. Limited beta (selected customers): 1 to 2 weeks
3. Public rollout: after gates pass for two consecutive windows

## Beta Objectives
- Validate extraction quality with real report variance.
- Verify latency, failure rate, and queue stability under realistic load.
- Capture correction feedback to grow the golden dataset.

## Entry Gates (Limited Beta)
- Step 12 benchmark regression gate passes.
- No P0 incidents in last 72 hours.
- Observability alerts are active and tested.

## Weekly Tuning Loop
1. Collect top failure cases by domain/extractor.
2. Add corrected examples to `data/eval/cases` and update metadata.
3. Re-run benchmark and compare to previous report.
4. Tune thresholds, prompts, or validators where needed.
5. Document changes in release notes.

## Beta Exit Criteria
- Two consecutive benchmark runs meet thresholds.
- `p95_latency_ms <= 4000`.
- `failure_rate <= 0.05`.
- `queue_depth <= 250` during peak windows.
- Rollback checklist completed and verified.
