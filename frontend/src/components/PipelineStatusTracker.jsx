import React, { useState, useEffect, useRef, useCallback } from 'react';
import { pdfService } from '../services/api';
import {
  CheckCircleIcon,
  CloudArrowUpIcon,
  DocumentMagnifyingGlassIcon,
  CircleStackIcon,
  ChartBarIcon,
  DocumentTextIcon,
  FlagIcon,
} from '@heroicons/react/24/outline';

const STAGE_CONFIG = [
  { key: 'upload', label: 'Uploading Files', icon: CloudArrowUpIcon },
  { key: 'extraction', label: 'Extracting Financial Statements', icon: DocumentMagnifyingGlassIcon },
  { key: 'normalization', label: 'Generating Normalized Dataset', icon: CircleStackIcon },
  { key: 'analysis', label: 'Running Financial Analysis', icon: ChartBarIcon },
  { key: 'report_generation', label: 'Generating Report Data', icon: DocumentTextIcon },
  { key: 'completed', label: 'Completed', icon: FlagIcon },
];

const STATUS_COLORS = {
  completed: 'text-emerald-500',
  running: 'text-indigo-500',
  pending: 'text-slate-300',
  failed: 'text-red-500',
  skipped: 'text-amber-400',
};

const PipelineStatusTracker = ({ batchId, onComplete }) => {
  const [stages, setStages] = useState(null);
  const [currentStage, setCurrentStage] = useState(null);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    if (!batchId) return;
    try {
      const data = await pdfService.fetchBatchStatus(batchId);
      if (data?.stages) {
        setStages(data.stages);
        setCurrentStage(data.current_stage);

        const allDone = Object.values(data.stages).every(
          (s) => s.status === 'completed' || s.status === 'skipped'
        );
        if (allDone || data.current_stage === 'completed') {
          setIsComplete(true);
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          onComplete?.();
        }
      }
      setError(null);
    } catch (err) {
      setError('Unable to fetch pipeline status');
    }
  }, [batchId, onComplete]);

  useEffect(() => {
    if (!batchId) return;
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [batchId, fetchStatus]);

  const completedCount = stages
    ? Object.values(stages).filter((s) => s.status === 'completed').length
    : 0;
  const progressPct = stages ? Math.round((completedCount / STAGE_CONFIG.length) * 100) : 0;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Pipeline Progress</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {isComplete ? 'All stages complete' : currentStage ? `Stage: ${currentStage}` : 'Initializing...'}
          </p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          isComplete
            ? 'bg-emerald-50 text-emerald-600'
            : error
            ? 'bg-red-50 text-red-600'
            : 'bg-indigo-50 text-indigo-600'
        }`}>
          {isComplete ? '✓ Done' : error ? 'Error' : `${progressPct}%`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-5">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isComplete ? 'bg-emerald-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Stage list */}
      <div className="space-y-3">
        {STAGE_CONFIG.map(({ key, label, icon: Icon }, idx) => {
          const stageData = stages?.[key];
          const status = stageData?.status || 'pending';
          const isActive = currentStage === key && !isComplete;

          return (
            <div
              key={key}
              className={`flex items-center gap-3 transition-all duration-300 ${
                status === 'completed' ? 'opacity-100' : status === 'pending' ? 'opacity-40' : 'opacity-100'
              }`}
            >
              {status === 'completed' ? (
                <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : isActive ? (
                <span className="flex h-5 w-5 items-center justify-center shrink-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
                </span>
              ) : status === 'failed' ? (
                <span className="flex h-5 w-5 items-center justify-center shrink-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
              ) : (
                <Icon className="w-5 h-5 text-slate-300 shrink-0" />
              )}

              <span
                className={`text-sm tracking-tight ${
                  status === 'completed'
                    ? 'text-emerald-600 font-medium'
                    : isActive
                    ? 'text-indigo-600 font-medium'
                    : status === 'failed'
                    ? 'text-red-600 font-medium'
                    : 'text-slate-400'
                }`}
              >
                {label}
              </span>

              {isActive && (
                <span className="ml-auto text-[10px] uppercase tracking-widest text-indigo-400 font-medium">
                  Running
                </span>
              )}
              {status === 'completed' && stageData?.timestamp && (
                <span className="ml-auto text-[10px] text-slate-400">
                  {new Date(stageData.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
};

export default PipelineStatusTracker;
