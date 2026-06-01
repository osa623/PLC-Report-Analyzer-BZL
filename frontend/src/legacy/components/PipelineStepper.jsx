import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, SkipForward } from 'lucide-react';

const STAGE_LABELS = {
  // Legacy stage names
  UPLOAD: 'Upload', PARSING: 'Parsing', STRUCTURE: 'Structure', EXTRACTION: 'Extraction',
  AGGREGATION: 'Aggregation', VALIDATION: 'Validation', ANALYTICS: 'Analytics', REPORT: 'Report Gen',
  // New 9-stage pipeline names from backend
  DOCUMENT_INGESTION: 'Ingestion',
  PAGE_CLASSIFICATION: 'Classification',
  STATEMENT_DETECTION: 'Detection',
  MULTI_EXTRACTOR_EXECUTION: 'Extraction',
  CROSS_EXTRACTOR_RECONCILIATION: 'Reconciliation',
  ACCOUNTING_VALIDATION: 'Validation',
  COVERAGE_SCORING_GATE: 'Scoring Gate',
  FINANCIAL_ANALYSIS: 'Analysis',
  REPORT_GENERATION: 'Report Gen',
};

function StepIcon({ status }) {
  if (status === 'completed') return <CheckCircle size={18} color="#fff" />;
  if (status === 'failed') return <XCircle size={18} color="#fff" />;
  if (status === 'skipped') return <SkipForward size={16} color="#fff" />;
  if (status === 'running') return <Clock size={16} color="#fff" />;
  return <span className="text-[12px] text-slate-300">●</span>;
}

function formatDuration(ms) {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function PipelineStepper({ stages }) {
  if (!stages || stages.length === 0) {
    return (
      <div className="card p-6">
        <div className="h-20 w-full bg-slate-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '16px 0' }}>
      <div className="px-5 pb-3 text-[14px] font-semibold text-slate-900 tracking-[-0.025em]">
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
          const diag = (stage.diagnostics && (stage.diagnostics.reason || stage.diagnostics.error || stage.diagnostics.message)) || stage.message || null;

          return (
            <React.Fragment key={stage.stage}>
              <div className={`pipeline-step ${stage.status}`}>
                <div className="pipeline-step-icon">
                  <StepIcon status={stage.status} />
                </div>
                <div className="pipeline-step-label">{label}</div>
                <div className="pipeline-step-status">
                  {statusLabel}
                  {duration && ` · ${duration}`}
                  {diag && <div className="text-[11px] text-red-600 mt-1">{diag}</div>}
                </div>
              </div>
              {i < stages.length - 1 && (
                <div className={`pipeline-step-connector ${
                  stage.status === 'completed' ? 'completed' :
                  stage.status === 'running' ? 'active' : ''
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
