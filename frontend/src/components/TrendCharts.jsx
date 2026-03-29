import React, { useMemo } from 'react';

const TREND_CONFIGS = [
  {
    key: 'revenue',
    label: 'Revenue Trend',
    color: '#3b82f6',
    match: ['revenue', 'total_revenue', 'turnover', 'sales'],
  },
  {
    key: 'profit',
    label: 'Profit Trend',
    color: '#22c55e',
    match: ['net_profit', 'profit_after_tax', 'net_income'],
  },
  {
    key: 'cash',
    label: 'Cash Position',
    color: '#8b5cf6',
    match: ['cash', 'cash_and_cash_equivalents', 'cash_balance'],
  },
];

function extractTrendData(rows) {
  const trends = {};

  for (const cfg of TREND_CONFIGS) {
    const matchingRows = rows.filter((r) =>
      cfg.match.some((m) => (r.canonical_label || '').toLowerCase().includes(m))
    );
    if (matchingRows.length > 0) {
      // Group by year, take first match
      const byYear = {};
      for (const row of matchingRows) {
        const year = String(row.year || 'unknown');
        if (!byYear[year] && typeof row.value === 'number') {
          byYear[year] = row.value;
        }
      }
      const sorted = Object.entries(byYear)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, value]) => ({ year, value }));
      if (sorted.length > 0) {
        trends[cfg.key] = { ...cfg, data: sorted };
      }
    }
  }

  return trends;
}

function MiniBarChart({ data, color }) {
  const maxVal = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
      {data.map((d, i) => {
        const h = (Math.abs(d.value) / maxVal) * 70;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <div
              className="chart-bar"
              style={{
                width: '100%',
                maxWidth: 40,
                height: Math.max(h, 4),
                background: color,
                opacity: 0.85,
              }}
            />
            <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>{d.year}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatLargeNum(val) {
  if (val == null) return '—';
  const abs = Math.abs(val);
  if (abs >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
  return val.toLocaleString();
}

export default function TrendCharts({ validatedData }) {
  const rows = validatedData?.validated?.validated_rows || [];
  const trends = useMemo(() => extractTrendData(rows), [rows]);

  const trendEntries = Object.values(trends);

  if (trendEntries.length === 0) {
    return null; // Don't render if no trend data
  }

  return (
    <div className="card fade-in">
      <div className="card-header">Financial Trends (Validated Data)</div>
      <div className="card-body">
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(trendEntries.length, 3)}, 1fr)`, gap: 20 }}>
          {trendEntries.map((trend) => (
            <div key={trend.key}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                {trend.label}
              </div>
              <MiniBarChart data={trend.data} color={trend.color} />
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                {trend.data.map((d, i) => (
                  <span key={i} style={{ fontSize: 10, color: '#1e293b', fontWeight: 600 }}>
                    {formatLargeNum(d.value)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
