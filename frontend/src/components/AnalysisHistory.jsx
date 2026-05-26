import React from 'react';
import {
  CalendarDaysIcon,
  ArrowUpRightIcon,
  ArrowDownRightIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';

const formatTimestamp = (ts) => {
  if (!ts) return 'n/a';
  const date = new Date(ts);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const DeltaBadge = ({ currentValue, previousValue, isInverse = false }) => {
  if (previousValue === undefined || previousValue === null) return null;
  
  const diff = currentValue - previousValue;
  if (Math.abs(diff) < 0.01) return null;
  
  const isPositive = diff > 0;
  const formattedDiff = `${isPositive ? '+' : ''}${diff.toFixed(1)}`;
  
  // For risk, an increase is bad (red) and a decrease is good (green)
  // For reliability, an increase is good (green) and a decrease is bad (red)
  const isGood = isInverse ? !isPositive : isPositive;
  
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
      isGood 
        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
        : 'bg-rose-50 text-rose-600 border border-rose-100'
    }`}>
      {isGood ? (
        <ArrowUpRightIcon className="w-3 h-3" />
      ) : (
        <ArrowDownRightIcon className="w-3 h-3" />
      )}
      {formattedDiff}
    </span>
  );
};

const AnalysisHistory = ({ companyId, history }) => {
  const runs = history?.runs || [];

  if (runs.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-xl border border-slate-100 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Analysis History</h3>
        <p className="text-xs text-slate-500">No previous analysis runs found for this company.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <CalendarDaysIcon className="w-5 h-5 text-indigo-500" />
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Calculation Run History</h2>
          <p className="text-[11px] text-slate-400">Track and compare changes across previous analysis reports</p>
        </div>
      </div>

      <div className="overflow-hidden border border-slate-100 rounded-xl bg-slate-50/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/60 border-b border-slate-100">
                <th className="px-4 py-3 text-xs font-bold text-slate-600 tracking-refined">Run Timestamp</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 tracking-refined">Report ID</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 tracking-refined">Reliability Score</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 tracking-refined">Risk Score</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 tracking-refined">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/50">
              {runs.map((run, index) => {
                const prevRun = runs[index + 1];
                const relScore = run.scores?.reliability_score ?? run.scores?.overall_health_score ?? 0;
                const prevRelScore = prevRun?.scores?.reliability_score ?? prevRun?.scores?.overall_health_score;
                const riskScore = run.scores?.risk_score ?? 0;
                const prevRiskScore = prevRun?.scores?.risk_score;

                return (
                  <tr key={run.report_id} className="hover:bg-slate-50/30 transition-all select-none">
                    <td className="px-4 py-3.5 text-xs text-slate-700 font-medium">
                      {formatTimestamp(run.timestamp)}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400 font-mono">
                      {run.report_id.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-slate-800">
                          {relScore.toFixed(1)}%
                        </span>
                        <DeltaBadge
                          currentValue={relScore}
                          previousValue={prevRelScore}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-slate-800">
                          {riskScore.toFixed(1)}%
                        </span>
                        <DeltaBadge
                          currentValue={riskScore}
                          previousValue={prevRiskScore}
                          isInverse={true}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        {run.version || 'v1.0'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalysisHistory;
