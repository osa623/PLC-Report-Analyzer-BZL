import React, { useMemo } from 'react';

const BUCKETS = [
  { label: 'Weak', range: [0, 0.4], color: '#f87171' },
  { label: 'Moderate', range: [0.4, 0.6], color: '#fbbf24' },
  { label: 'High', range: [0.6, 0.8], color: '#34d399' },
  { label: 'Very High', range: [0.8, 1.01], color: '#22c55e' },
];

export default function ConfidenceChart({ validatedData }) {
  const distribution = useMemo(() => {
    const rows = validatedData?.validated?.validated_rows || [];
    if (rows.length === 0) return null;

    const counts = BUCKETS.map((b) => ({
      ...b,
      count: rows.filter(
        (r) => (r.confidence_score || 0) >= b.range[0] && (r.confidence_score || 0) < b.range[1]
      ).length,
    }));

    return counts;
  }, [validatedData]);

  if (!distribution) {
    return (
      <div className="card">
        <div className="card-header">Confidence Distribution</div>
        <div className="card-body" style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>
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
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 160, padding: '0 8px' }}>
          {distribution.map((bucket) => {
            const height = maxCount > 0 ? (bucket.count / maxCount) * 130 : 0;
            return (
              <div
                key={bucket.label}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                  {bucket.count}
                </span>
                <div
                  className="chart-bar"
                  style={{
                    width: '100%',
                    maxWidth: 56,
                    height: Math.max(height, 4),
                    background: bucket.color,
                  }}
                />
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, textAlign: 'center' }}>
                  {bucket.label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Y-axis labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '0 20px' }}>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>0</span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{Math.ceil(maxCount / 2)}</span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{maxCount}</span>
        </div>
      </div>
    </div>
  );
}
