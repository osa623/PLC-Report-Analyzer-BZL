import os

TARGET_SERVICES = [
    'balance_sheet_extractor',
    'cashflow_statement_extractor',
    'income_statement_extractor',
    'income_notes_extractor',
    'esg_extractor',
    'governance_extractor',
    'risk_extractor',
    'segment_extractor',
]

for service in TARGET_SERVICES:
    with open(f'{service}/core/config.py', 'w') as f:
        f.write('''from pydantic import BaseSettings

class Settings(BaseSettings):
    observability_enabled: bool = True
    observability_tracing_enabled: bool = True
    observability_latency_alert_ms: int = 60000
    observability_queue_depth_alert_threshold: int = 100
    observability_failure_rate_alert_threshold: float = 20.0
    observability_low_confidence_alert_enabled: bool = True
''')
