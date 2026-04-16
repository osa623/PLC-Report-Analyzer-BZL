import React, { useMemo } from 'react';

function QualityGauge({ score }) {
  const percent = typeof score === 'number' ? Math.round(score * 100) : 0;
  const color = percent >= 80 ? '#22c55e' : percent >= 50 ? '#f59e0b' : '#ef4444';
  const rotation = (percent / 100) * 180;

  return (
    <div className="relative" style={{ width: 120, height: 70 }}>
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(percent / 100) * 157} 157`} style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
      </svg>
      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-xl font-bold tracking-[-0.025em]" style={{ color }}>
        {percent}%
      </div>
    </div>
  );
}

export default function QualitySummary({ validatedData, errors }) {
  const stats = useMemo(() => {
    const validated = validatedData?.validated || {};
    const rows = validated.validated_rows || [];
    const score = validated.overall_data_quality_score;
    const validRows = rows.filter((r) => (r.confidence_score || 0) >= 0.6).length;
    const provisionalRows = rows.filter((r) => (r.confidence_score || 0) >= 0.4 && (r.confidence_score || 0) < 0.6).length;
    const issues = (errors?.total_errors || 0) + (errors?.total_missing || 0) + (errors?.total_weak || 0);
    return { score, totalRows: rows.length, validRows, provisionalRows, issues };
  }, [validatedData, errors]);

  return (
    <div className="card fade-in">
      <div className="card-header">Data Quality Summary</div>
      <div className="card-body">
        <div className="flex items-center gap-8 flex-wrap">
          <div className="flex flex-col items-center gap-1">
            <QualityGauge score={stats.score} />
            <span className="text-[12px] text-slate-500 font-medium tracking-[-0.01em]">Overall Quality Score</span>
          </div>
          <div className="grid grid-cols-2 gap-4 flex-1">
            {[
              { label: 'Valid Rows', value: stats.validRows, color: 'text-slate-900' },
              { label: 'Total Rows', value: stats.totalRows, color: 'text-slate-900' },
              { label: 'Provisional Rows', value: stats.provisionalRows, color: 'text-amber-600' },
              { label: 'Issues Found', value: stats.issues, color: stats.issues > 0 ? 'text-red-500' : 'text-green-600' },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest">{item.label}</div>
                <div className={`text-2xl font-bold tracking-[-0.025em] ${item.color}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
