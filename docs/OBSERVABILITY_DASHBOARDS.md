# Observability Dashboards and Alerts

## Dashboard Definitions

### 1. Queue and Throughput Dashboard
- Metric: queue depth from `jobs:queue_depth`
- Metric: requests per hour from `obs:requests:{statement_type}:{hour}`
- Metric: output rows from payload metadata `observability_output_rows`
- Use: detect backlog and worker throughput drops

### 2. Extractor Failure Dashboard
- Metric: failures per hour from `obs:failures:{statement_type}:{hour}`
- Metric: failure rate from payload metadata `observability_failure_rate_percent`
- Dimension: statement type
- Use: identify service-specific regressions quickly

### 3. Latency and Confidence Dashboard
- Metric: per-report `observability_latency_ms`
- Metric: confidence band from payload metadata `confidence_band`
- Metric: alert count by type from `observability_alerts`
- Use: detect degraded model performance and low-confidence bursts

### 4. Fallback and Guardrail Dashboard
- Metric: `fallback_attempted`, `fallback_applied`, `fallback_reason`
- Metric: `guardrails_rejection_code` and rate-limited flags
- Use: verify routing and cost-protection behavior

## Alert Rules

1. Alert name: `latency_threshold_exceeded`
- Condition: latency exceeds `observability_latency_alert_ms`
- Severity: warning

2. Alert name: `queue_depth_threshold_exceeded`
- Condition: queue depth exceeds `observability_queue_depth_alert_threshold`
- Severity: critical

3. Alert name: `failure_rate_threshold_exceeded`
- Condition: failure rate exceeds `observability_failure_rate_alert_threshold`
- Severity: critical

4. Alert name: `low_confidence_output`
- Condition: confidence band is low and low-confidence alerting enabled
- Severity: warning

## Tracing Baseline
- Each extraction payload includes `observability_trace_id`
- Trace id format: `{statement_type}:{report_id}:{epoch_ms}`
- Use trace id to correlate API request, worker logs, and result payload
