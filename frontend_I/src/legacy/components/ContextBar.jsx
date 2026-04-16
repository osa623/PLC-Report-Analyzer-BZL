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
    <div
      id="context-bar"
      style={{
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Top row: Report info + quality score */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 0 6px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
            Report ID: {reportId ? reportId.slice(0, 8) : '—'}
          </span>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>|</span>
          <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
            {company || 'Select Company'} ▾
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Overall Quality Score:</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: scoreColor }}>{scorePercent}</span>
        </div>
      </div>

      {/* Bottom row: tabs */}
      <div style={{ display: 'flex', gap: 0, borderTop: '1px solid #f1f5f9' }}>
        {CONTEXT_TABS.map((tab) => {
          const isActive = activeContextTab === tab;
          return (
            <button
              key={tab}
              id={`context-tab-${tab.toLowerCase().replace(/[^a-z]/g, '-')}`}
              onClick={() => onContextTabChange(tab)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #2d3a8c' : '2px solid transparent',
                color: isActive ? '#2d3a8c' : '#64748b',
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>
    </div>
  );
}
