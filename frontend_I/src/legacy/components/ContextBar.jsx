import React from 'react';

const CONTEXT_TABS = [
  'Pipeline Overview',
  'Validated Data',
  'Analytics',
  'Errors & Warnings',
  'Data Quality Summary',
];

export default function ContextBar({
  reportId,
  company,
  qualityScore,
  activeContextTab,
  onContextTabChange,
}) {
  const scoreColor =
    qualityScore >= 0.8 ? '#22c55e' : qualityScore >= 0.5 ? '#f59e0b' : '#ef4444';
  const scorePercent = typeof qualityScore === 'number' ? `${Math.round(qualityScore * 100)}%` : '—';

  return (
    <div className="sticky top-14 z-40 bg-white/95 backdrop-blur-lg border-b border-slate-200/40">
      {/* Top row: Report info + quality score */}
      <div className="flex items-center justify-between px-6 lg:px-8 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold text-slate-800 tracking-[-0.01em]">
            Report: {reportId ? reportId.slice(0, 8) : '—'}
          </span>
          <span className="text-slate-300 text-[12px]">·</span>
          <span className="text-[12px] text-slate-500 font-medium tracking-[-0.01em]">
            {company || 'No company selected'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium tracking-[-0.01em]">Quality:</span>
          <span className="text-[14px] font-bold" style={{ color: scoreColor }}>{scorePercent}</span>
        </div>
      </div>

      {/* Bottom row: tabs */}
      <div className="flex gap-0 px-6 lg:px-8 border-t border-slate-100/60">
        {CONTEXT_TABS.map((tab) => {
          const isActive = activeContextTab === tab;
          return (
            <button
              key={tab}
              id={`context-tab-${tab.toLowerCase().replace(/[^a-z]/g, '-')}`}
              onClick={() => onContextTabChange(tab)}
              className={`px-3.5 py-2.5 text-[12px] font-medium border-b-2 transition-all duration-200 whitespace-nowrap tracking-[-0.01em]
                ${isActive
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-700 hover:border-slate-300'}`}
            >
              {tab}
            </button>
          );
        })}
      </div>
    </div>
  );
}
