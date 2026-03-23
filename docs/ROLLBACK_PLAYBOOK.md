# Rollback Playbook

## Trigger Conditions
- Sustained API failure rate above alert threshold.
- Regression gate or release gate failure after deployment.
- Data integrity incident affecting report outputs.

## Immediate Actions
1. Declare incident and assign incident commander.
2. Enable rollback feature toggle path.
3. Route traffic to last stable release.
4. Verify status endpoints and queue drain behavior.

## Validation Checklist
- Submit/status APIs return healthy responses.
- Queue depth returns to baseline range.
- Error rate and latency recover to pre-incident levels.
- No new critical alerts for 30 minutes.

## Communication
- Post incident update with ETA to stakeholders.
- Publish rollback complete notice with root-cause follow-up timeline.

## Post-Rollback
- Freeze new rollouts until corrective patch is validated.
- Add failing scenario to golden dataset and regression tests.
