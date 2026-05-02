import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, SkipForward } from 'lucide-react';

const STAGE_LABELS = {
  DOCUMENT_INGESTION: 'Document ingestion',
  PAGE_CLASSIFICATION: 'Page classification',
  STATEMENT_DETECTION: 'Gemini Vision statement detection',
  MULTI_EXTRACTOR_EXECUTION: 'Multi-extractor execution',
  CROSS_EXTRACTOR_RECONCILIATION: 'Cross-extractor reconciliation',
  ACCOUNTING_VALIDATION: 'Accounting validation',
  COVERAGE_SCORING_GATE: 'Coverage scoring gate',
  FINANCIAL_ANALYSIS: 'Financial analysis',
  REPORT_GENERATION: 'Report generation',
};

function StepIcon({ status }) {
  if (status === 'completed')
    return <CheckCircle size={18} color="#fff" />;
  if (status === 'failed')
    return <XCircle size={18} color="#fff" />;
  if (status === 'skipped')
    return <SkipForward size={16} color="#fff" />;
  if (status === 'running')
    return <Clock size={16} color="#fff" />;
  return <span style={{ fontSize: 12, color: '#94a3b8' }}>●</span>;
}

function formatDuration(ms) {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function PipelineStepper({ stages }) {
  if (!stages || stages.length === 0) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <div className="skeleton" style={{ height: 80, width: '100%' }} />
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '16px 0' }}>
      <div style={{ padding: '0 20px 12px', fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
        Processing Pipeline
      </div>
      <div className="pipeline-stepper">
        {stages.map((stage, i) => {
          const label = STAGE_LABELS[stage.stage] || stage.stage;
          const statusLabel =
            stage.status === 'completed' ? 'Completed' :
            stage.status === 'running' ? 'Running...' :
            stage.status === 'failed' ? 'Failed' :
            stage.status === 'skipped' ? 'Skipped' :
            'Pending';
          const duration = formatDuration(stage.duration_ms);

          return (
            <React.Fragment key={stage.stage}>
              <div className={`pipeline-step ${stage.status}`}>
                <div className="pipeline-step-icon">
                  <StepIcon status={stage.status} />
                </div>
                <div className="pipeline-step-label">{label}</div>
                <div className="pipeline-step-status">
                  {statusLabel}
                  {duration && ` • ${duration}`}
                </div>
              </div>
              {i < stages.length - 1 && (
                <div
                  className={`pipeline-step-connector ${
                    stage.status === 'completed'
                      ? 'completed'
                      : stage.status === 'running'
                      ? 'active'
                      : ''
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
