import React, { useMemo } from 'react';
import {
    ArrowUpTrayIcon,
    DocumentMagnifyingGlassIcon,
    ChartBarSquareIcon,
    DocumentChartBarIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    ClockIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline';

// ─── Stage definitions ─────────────────────────────────────────
const PIPELINE_STAGES = [
    { key: 'UPLOAD', label: 'Upload', icon: ArrowUpTrayIcon },
    { key: 'EXTRACTION', label: 'Extraction', icon: DocumentMagnifyingGlassIcon },
    { key: 'ANALYSIS', label: 'Analysis', icon: ChartBarSquareIcon },
    { key: 'REPORTING', label: 'Report', icon: DocumentChartBarIcon },
];

// ─── Status helpers ────────────────────────────────────────────
const STATUS_CONFIG = {
    completed: {
        bg: 'bg-green-500',
        ring: 'ring-green-200',
        text: 'text-green-700',
        badgeBg: 'bg-green-50/80 border-green-200/60',
        label: 'Done',
        iconColor: 'text-white',
    },
    running: {
        bg: 'bg-indigo-500',
        ring: 'ring-indigo-200',
        text: 'text-indigo-700',
        badgeBg: 'bg-indigo-50/80 border-indigo-200/60',
        label: 'Running',
        iconColor: 'text-white',
    },
    failed: {
        bg: 'bg-red-500',
        ring: 'ring-red-200',
        text: 'text-red-700',
        badgeBg: 'bg-red-50/80 border-red-200/60',
        label: 'Failed',
        iconColor: 'text-white',
    },
    skipped: {
        bg: 'bg-amber-400',
        ring: 'ring-amber-200',
        text: 'text-amber-700',
        badgeBg: 'bg-amber-50/80 border-amber-200/60',
        label: 'Skipped',
        iconColor: 'text-white',
    },
    pending: {
        bg: 'bg-slate-200',
        ring: 'ring-slate-100',
        text: 'text-slate-400',
        badgeBg: 'bg-slate-50 border-slate-200/80',
        label: 'Pending',
        iconColor: 'text-slate-400',
    },
};

function StageStatusIcon({ status }) {
    if (status === 'completed') return <CheckCircleIcon className="w-4 h-4 text-white" />;
    if (status === 'running') return <ArrowPathIcon className="w-4 h-4 text-white animate-spin" />;
    if (status === 'failed') return <ExclamationTriangleIcon className="w-4 h-4 text-white" />;
    return <ClockIcon className="w-4 h-4 text-slate-400" />;
}

// ─── Pipeline Stage Node ───────────────────────────────────────
function PipelineStageNode({ stage, status, isLast }) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = stage.icon;

    return (
        <div className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
                <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm
                        ${config.bg} ${status === 'running' ? 'ring-2 ring-offset-1 ' + config.ring : ''}`}
                >
                    {status === 'running' ? (
                        <ArrowPathIcon className="w-4 h-4 text-white animate-spin" />
                    ) : status === 'completed' ? (
                        <CheckCircleIcon className="w-4 h-4 text-white" />
                    ) : status === 'failed' ? (
                        <ExclamationTriangleIcon className="w-4 h-4 text-white" />
                    ) : (
                        <Icon className={`w-4 h-4 ${config.iconColor}`} />
                    )}
                </div>
                <span className={`text-[10px] font-medium tracking-wide ${config.text}`}>
                    {stage.label}
                </span>
            </div>
            {!isLast && (
                <div className="flex items-center mx-1.5 -mt-4">
                    <div
                        className={`h-0.5 w-6 sm:w-8 transition-all duration-500 rounded-full
                            ${status === 'completed' ? 'bg-green-400' : status === 'running' ? 'bg-indigo-300 animate-pulse' : 'bg-slate-200'}`}
                    />
                </div>
            )}
        </div>
    );
}

// ─── Per-Document Row ──────────────────────────────────────────
function DocumentRow({ doc, stages }) {
    const shortName = String(doc.pdf_name || doc.file_path || 'document').split(/[/\\]/).pop();
    const currentStage = doc.stage || 'UPLOAD';
    const docStatus = doc.status || 'queued';

    // Derive per-stage statuses for this document
    const stageOrder = ['UPLOAD', 'EXTRACTION', 'ANALYSIS', 'REPORTING'];
    const currentIndex = stageOrder.indexOf(currentStage);
    const isDone = docStatus === 'completed';
    const isFailed = docStatus === 'failed';

    const getStageStatus = (stageKey) => {
        const idx = stageOrder.indexOf(stageKey);
        if (stageKey === 'UPLOAD') return 'completed'; // always uploaded
        if (isFailed && idx >= currentIndex) return idx === currentIndex ? 'failed' : 'pending';
        if (isDone) return 'completed';
        if (idx < currentIndex) return 'completed';
        if (idx === currentIndex) return docStatus === 'running' ? 'running' : 'pending';
        return 'pending';
    };

    const statusBadge = isDone
        ? 'bg-green-50/80 text-green-700 border-green-200/60'
        : isFailed
        ? 'bg-red-50/80 text-red-700 border-red-200/60'
        : docStatus === 'running'
        ? 'bg-indigo-50/80 text-indigo-700 border-indigo-200/60'
        : 'bg-slate-50 text-slate-500 border-slate-200/80';

    return (
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-apple-sm transition-all duration-200 hover:shadow-apple">
            {/* File info header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <DocumentTextIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-[12px] font-medium text-slate-700 truncate tracking-refined" title={shortName}>
                        {shortName}
                    </span>
                </div>
                <span className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded-lg border tracking-wide whitespace-nowrap ${statusBadge}`}>
                    {isDone ? 'Done' : isFailed ? 'Failed' : docStatus === 'running' ? 'Processing' : 'Queued'}
                </span>
            </div>

            {/* Mini pipeline stages */}
            <div className="flex items-center justify-center gap-0">
                {PIPELINE_STAGES.map((stage, idx) => (
                    <PipelineStageNode
                        key={stage.key}
                        stage={stage}
                        status={getStageStatus(stage.key)}
                        isLast={idx === PIPELINE_STAGES.length - 1}
                    />
                ))}
            </div>
        </div>
    );
}

// ─── Main Pipeline Workflow Map ────────────────────────────────
export default function PipelineWorkflowMap({ stagesData, documentStatuses, workflowState }) {
    const stages = stagesData?.stages || [];
    const documents = documentStatuses?.documents || [];
    const counts = documentStatuses?.counts || {};

    // Overall progress
    const overallProgress = useMemo(() => {
        if (!counts.total) return 0;
        return Math.min(100, Math.round(((counts.completed || 0) / Math.max(counts.total, 1)) * 100));
    }, [counts]);

    // Derive overall stage statuses from backend stages array
    const overallStageStatus = useMemo(() => {
        const map = {};
        map['UPLOAD'] = 'completed'; // always done at this point
        for (const s of stages) {
            const key = s.stage;
            // Map extraction-related sub-stages to EXTRACTION (legacy + new names)
            if (['PARSING', 'STRUCTURE', 'EXTRACTION',
                 'DOCUMENT_INGESTION', 'PAGE_CLASSIFICATION', 'STATEMENT_DETECTION',
                 'MULTI_EXTRACTOR_EXECUTION', 'CROSS_EXTRACTOR_RECONCILIATION'].includes(key)) {
                if (!map['EXTRACTION'] || map['EXTRACTION'] === 'pending') {
                    map['EXTRACTION'] = s.status;
                } else if (s.status === 'running') {
                    map['EXTRACTION'] = 'running';
                } else if (s.status === 'failed' && map['EXTRACTION'] !== 'running') {
                    map['EXTRACTION'] = 'failed';
                }
            }
            // Map analysis-related sub-stages to ANALYSIS (legacy + new names)
            if (['AGGREGATION', 'VALIDATION', 'ANALYTICS',
                 'ACCOUNTING_VALIDATION', 'COVERAGE_SCORING_GATE', 'FINANCIAL_ANALYSIS'].includes(key)) {
                if (!map['ANALYSIS'] || map['ANALYSIS'] === 'pending') {
                    map['ANALYSIS'] = s.status;
                } else if (s.status === 'running') {
                    map['ANALYSIS'] = 'running';
                } else if (s.status === 'completed' && map['ANALYSIS'] !== 'running') {
                    map['ANALYSIS'] = 'completed';
                }
            }
            // Map report stage (legacy + new name)
            if (key === 'REPORT' || key === 'REPORT_GENERATION') {
                map['REPORTING'] = s.status;
            }
        }
        return map;
    }, [stages]);

    const wf = String(workflowState || '');
    const isComplete = wf === 'COMPLETED' || wf === 'LOW_CONFIDENCE';
    const isFailed = wf === 'FAILED' || wf.includes('FAILED') || wf === 'EXTRACTION_INCOMPLETE' || wf === 'EXTRACTION_FAILED';

    return (
        <div className="space-y-4 fade-in">
            {/* ─── Overall Pipeline Header ───────────────────────── */}
            <div className="card">
                <div className="card-header flex items-center justify-between">
                    <div>
                        <span className="font-semibold text-slate-900 tracking-[-0.025em]">Pipeline Processing</span>
                        <p className="text-[11px] font-normal text-slate-500 mt-0.5 tracking-[-0.01em] normal-case">
                            {isComplete
                                ? 'All stages completed successfully'
                                : isFailed
                                ? 'Pipeline encountered an error'
                                : 'Processing your documents through the analysis pipeline'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 tracking-[-0.01em]">
                            {counts.completed || 0}/{counts.total || 0} documents
                        </span>
                        {!isComplete && !isFailed && (
                            <ArrowPathIcon className="w-4 h-4 text-slate-400 animate-spin" />
                        )}
                        {isFailed && (
                          <span className="text-[12px] text-red-600 ml-3">Pipeline reported failure — check stage diagnostics.</span>
                        )}
                    </div>
                </div>

                <div className="card-body">
                    {/* Overall progress bar */}
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-4">
                        <div
                            className={`h-full rounded-full transition-all duration-500
                                ${isFailed ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-slate-900'}`}
                            style={{ width: `${isComplete ? 100 : isFailed ? overallProgress : Math.max(overallProgress, 5)}%` }}
                        />
                    </div>

                    {/* Overall stage indicators */}
                    <div className="flex items-center justify-center gap-0 py-1">
                        {PIPELINE_STAGES.map((stage, idx) => (
                            <PipelineStageNode
                                key={stage.key}
                                stage={stage}
                                status={overallStageStatus[stage.key] || 'pending'}
                                isLast={idx === PIPELINE_STAGES.length - 1}
                            />
                        ))}
                    </div>

                    {/* Status badges */}
                    {counts.total > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] tracking-wide uppercase">
                            {counts.queued > 0 && (
                                <span className="px-2 py-0.5 rounded-lg border border-slate-200/80 bg-slate-50 text-slate-500">
                                    queued {counts.queued}
                                </span>
                            )}
                            {counts.running > 0 && (
                                <span className="px-2 py-0.5 rounded-lg border border-slate-900 bg-slate-900 text-white">
                                    running {counts.running}
                                </span>
                            )}
                            {counts.completed > 0 && (
                                <span className="px-2 py-0.5 rounded-lg border border-green-200/60 bg-green-50/80 text-green-700">
                                    completed {counts.completed}
                                </span>
                            )}
                            {counts.failed > 0 && (
                                <span className="px-2 py-0.5 rounded-lg border border-red-200/60 bg-red-50/80 text-red-700">
                                    failed {counts.failed}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Per-Document Cards ────────────────────────────── */}
            {documents.length > 0 && (
                <div className="card">
                    <div className="card-header">Document Progress</div>
                    <div className="card-body">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {documents.map((doc, idx) => (
                                <DocumentRow
                                    key={`${doc.pdf_name || doc.file_path || 'doc'}-${idx}`}
                                    doc={doc}
                                    stages={stages}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Low Confidence Warning ────────────────────────── */}
            {workflowState === 'LOW_CONFIDENCE' && (
                <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 flex gap-3 items-start fade-in">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[13px] font-semibold text-amber-800 tracking-[-0.01em]">
                            Low Confidence — Limited Data Coverage
                        </p>
                        <p className="text-[12px] text-amber-700 mt-0.5 tracking-[-0.01em]">
                            Pipeline completed but with limited data coverage. Review the extracted data below.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
