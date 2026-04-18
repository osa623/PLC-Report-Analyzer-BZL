import React, { useMemo } from 'react';

function QualityGauge({ score }) {
  const percent = typeof score === 'number' ? Math.round(score * 100) : 0;
  const color = percent >= 80 ? '#22c55e' : percent >= 50 ? '#f59e0b' : '#ef4444';
  const rotation = (percent / 100) * 180;

  return (
    <div style={{ position: 'relative', width: 120, height: 70 }}>
      <svg width="120" height="70" viewBox="0 0 120 70">
        {/* Background arc */}
        <path
          d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * 157} 157`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          bottom: 2,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 20,
          fontWeight: 800,
          color: color,
        }}
      >
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
    const provisionalRows = rows.filter(
      (r) => (r.confidence_score || 0) >= 0.4 && (r.confidence_score || 0) < 0.6
    ).length;
    const issues =
      (errors?.total_errors || 0) + (errors?.total_missing || 0) + (errors?.total_weak || 0);

    return {
      score,
      totalRows: rows.length,
      validRows,
      provisionalRows,
      issues,
    };
  }, [validatedData, errors]);

  return (
    <div className="card fade-in">
      <div className="card-header">Data Quality Summary</div>
      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
          {/* Gauge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <QualityGauge score={stats.score} />
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
              Overall Quality Score
            </span>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Valid Rows
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b' }}>{stats.validRows}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Rows
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b' }}>{stats.totalRows}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Provisional Rows
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b' }}>{stats.provisionalRows}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Issues Found
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: stats.issues > 0 ? '#ef4444' : '#22c55e' }}>
                {stats.issues}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
