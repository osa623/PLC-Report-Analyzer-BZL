# RUNBOOK

## Scope
This runbook covers Step 11 observability operations for extractor services.

## Primary Signals
- Queue depth: Redis key `jobs:queue_depth`
- Throughput: Redis keys `obs:requests:{statement_type}:{hour}`
- Failure rate: Redis keys `obs:failures:{statement_type}:{hour}`
- Last snapshot: Redis keys `obs:last:{report_id}:{statement_type}`
- Per-report trace id: `observability_trace_id` in extraction payload metadata

## Alerts and Immediate Actions
1. `latency_threshold_exceeded`
- Check extractor service logs for chunk extraction stalls.
- Verify external model latency and retry behavior.
- Mitigate by reducing concurrency pressure and reviewing chunk volume.

2. `queue_depth_threshold_exceeded`
- Inspect job producer rate and worker throughput.
- Temporarily scale workers if available.
- Throttle ingestion traffic using Step 10 guardrails if needed.

3. `failure_rate_threshold_exceeded`
- Sample failed payloads by statement type.
- Validate Redis chunk payload availability and schema integrity.
- Roll back recent prompt/model changes if correlated with spike.

4. `low_confidence_output`
- Confirm fallback policy execution path.
- Review confidence distribution and section summaries.
- Escalate to quality triage if sustained over multiple hours.

## Top Incidents
1. Queue backlog growth
- Trigger: queue depth continuously increasing for 10+ minutes.
- Action: reduce submission rate and increase worker capacity.

2. Model latency spike
- Trigger: sustained `latency_threshold_exceeded` alerts.
- Action: switch to lower-latency model profile and monitor impact.

3. Elevated extraction failures
- Trigger: `failure_rate_threshold_exceeded`.
- Action: investigate input quality, Redis availability, and recent deploy diff.

4. Fallback budget exhaustion
- Trigger: repeated `fallback_budget_exhausted` metadata.
- Action: tune confidence routing and fallback budget settings.

5. Missing chunks in Redis
- Trigger: `missing_document_chunks_in_redis` errors.
- Action: verify parser pipeline and key TTL settings.

6. Timeout breaches
- Trigger: `processing_timeout_exceeded` metadata.
- Action: inspect chunk cardinality and worker health.

7. Low-confidence waves
- Trigger: high volume of low confidence outputs.
- Action: evaluate source document quality and prompt strategy.

8. Alert flood with normal outputs
- Trigger: alerts without user-visible failures.
- Action: recalibrate thresholds in config.

9. Stale metrics snapshots
- Trigger: missing `obs:last:*` updates.
- Action: verify Redis write path and permissions.

10. Trace correlation gaps
- Trigger: payloads missing `observability_trace_id`.
- Action: validate observability service initialization in dependencies.
