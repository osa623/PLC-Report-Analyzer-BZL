import React, { useMemo } from 'react';

const BUCKETS = [
  { label: 'Weak', range: [0, 0.4], color: '#94a3b8' },
  { label: 'Moderate', range: [0.4, 0.6], color: '#64748b' },
  { label: 'High', range: [0.6, 0.8], color: '#334155' },
  { label: 'Very High', range: [0.8, 1.01], color: '#0f172a' },
];

export default function ConfidenceChart({ validatedData }) {
  const distribution = useMemo(() => {
    const rows = validatedData?.validated?.validated_rows || [];
    if (rows.length === 0) return null;
    return BUCKETS.map((b) => ({
      ...b,
      count: rows.filter((r) => (r.confidence_score || 0) >= b.range[0] && (r.confidence_score || 0) < b.range[1]).length,
    }));
  }, [validatedData]);

  if (!distribution) {
    return (
      <div className="card">
        <div className="card-header">Confidence Distribution</div>
        <div className="card-body text-center text-slate-400 py-8 text-[13px] tracking-[-0.01em]">
          No data available for confidence chart.
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="card fade-in">
      <div className="card-header">Confidence Distribution</div>
      <div className="card-body">
        <div className="flex items-end gap-4" style={{ height: 160, padding: '0 8px' }}>
          {distribution.map((bucket) => {
            const height = maxCount > 0 ? (bucket.count / maxCount) * 130 : 0;
            return (
              <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[12px] font-bold text-slate-800 tracking-[-0.025em]">{bucket.count}</span>
                <div className="chart-bar w-full max-w-[56px]" style={{ height: Math.max(height, 4), background: bucket.color }} />
                <span className="text-[11px] text-slate-500 font-medium text-center tracking-[-0.01em]">{bucket.label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 px-5">
          <span className="text-[10px] text-slate-400">0</span>
          <span className="text-[10px] text-slate-400">{Math.ceil(maxCount / 2)}</span>
          <span className="text-[10px] text-slate-400">{maxCount}</span>
        </div>
      </div>
    </div>
  );
}
