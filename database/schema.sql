CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_state') THEN
    CREATE TYPE workflow_state AS ENUM (
      'UPLOADED',
      'PARSING',
      'STRUCTURE_DETECTED',
      'EXTRACTING',
      'AGGREGATING',
      'VALIDATING',
      'LOW_CONFIDENCE',
      'ANALYZING',
      'GENERATING_REPORT',
      'COMPLETED',
      'FAILED'
    );
  END IF;
END$$;

DO $$
BEGIN
  ALTER TYPE workflow_state ADD VALUE IF NOT EXISTS 'STRUCTURE_DETECTED';
  ALTER TYPE workflow_state ADD VALUE IF NOT EXISTS 'AGGREGATING';
  ALTER TYPE workflow_state ADD VALUE IF NOT EXISTS 'VALIDATING';
  ALTER TYPE workflow_state ADD VALUE IF NOT EXISTS 'LOW_CONFIDENCE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(32) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sector VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  file_path TEXT NOT NULL,
  pdf_path TEXT,
  workflow_state workflow_state NOT NULL DEFAULT 'UPLOADED',
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS income_statements (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  period VARCHAR(32) NOT NULL,
  revenue NUMERIC(20, 2),
  operating_profit NUMERIC(20, 2),
  net_profit NUMERIC(20, 2),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  extracted_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS balance_sheets (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  period VARCHAR(32) NOT NULL,
  total_assets NUMERIC(20, 2),
  total_liabilities NUMERIC(20, 2),
  total_equity NUMERIC(20, 2),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  extracted_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cashflows (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  period VARCHAR(32) NOT NULL,
  operating_cashflow NUMERIC(20, 2),
  investing_cashflow NUMERIC(20, 2),
  financing_cashflow NUMERIC(20, 2),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  extracted_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_ratios (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  period VARCHAR(32) NOT NULL,
  current_ratio NUMERIC(20, 6),
  debt_to_equity NUMERIC(20, 6),
  roe NUMERIC(20, 6),
  gross_margin NUMERIC(20, 6),
  net_margin NUMERIC(20, 6),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ratio_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS segments (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  segment_name TEXT NOT NULL,
  revenue NUMERIC(20, 2),
  profit NUMERIC(20, 2),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  board_size INTEGER,
  independent_directors INTEGER,
  governance_score NUMERIC(10, 4),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risks (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  risk_category TEXT NOT NULL,
  risk_text TEXT,
  severity_score NUMERIC(10, 4),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS esg_metrics (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value TEXT,
  score NUMERIC(10, 4),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patterns (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL,
  description TEXT,
  confidence NUMERIC(10, 4),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generated_reports (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  version VARCHAR(32) NOT NULL DEFAULT 'v1'
);

CREATE INDEX IF NOT EXISTS idx_reports_company_id ON reports(company_id);
CREATE INDEX IF NOT EXISTS idx_reports_state ON reports(workflow_state);
CREATE INDEX IF NOT EXISTS idx_income_report_id ON income_statements(report_id);
CREATE INDEX IF NOT EXISTS idx_balance_report_id ON balance_sheets(report_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_report_id ON cashflows(report_id);
CREATE INDEX IF NOT EXISTS idx_ratios_report_id ON financial_ratios(report_id);
CREATE INDEX IF NOT EXISTS idx_segments_report_id ON segments(report_id);
CREATE INDEX IF NOT EXISTS idx_governance_report_id ON governance(report_id);
CREATE INDEX IF NOT EXISTS idx_risks_report_id ON risks(report_id);
CREATE INDEX IF NOT EXISTS idx_esg_report_id ON esg_metrics(report_id);
CREATE INDEX IF NOT EXISTS idx_patterns_report_id ON patterns(report_id);
CREATE INDEX IF NOT EXISTS idx_generated_report_id ON generated_reports(report_id);
