import React, { useMemo } from 'react';

const ORDERED_TREND_CONFIGS = [
  { key: 'revenue', label: 'Revenue', color: '#0f172a', valueType: 'currency' },
  { key: 'net_income', label: 'Net Income', color: '#1d4ed8', valueType: 'currency' },
  { key: 'gross_profit_margin', label: 'Gross Profit Margin', color: '#0f766e', valueType: 'percent' },
  { key: 'net_profit_margin', label: 'Net Profit Margin', color: '#155e75', valueType: 'percent' },
  { key: 'return_on_equity', label: 'ROE', color: '#0284c7', valueType: 'percent' },
  { key: 'return_on_assets', label: 'ROA', color: '#0369a1', valueType: 'percent' },
  { key: 'debt_to_equity', label: 'Debt to Equity', color: '#b45309', valueType: 'ratio' },
  { key: 'current_ratio', label: 'Current Ratio', color: '#9333ea', valueType: 'ratio' },
  { key: 'total_assets', label: 'Total Assets', color: '#7c2d12', valueType: 'currency' },
  { key: 'total_liabilities', label: 'Total Liabilities', color: '#9f1239', valueType: 'currency' },
  { key: 'total_equity', label: 'Total Equity', color: '#166534', valueType: 'currency' },
  { key: 'total_cash_flow', label: 'Total Cash Flow', color: '#334155', valueType: 'currency' },
];

function formatValue(value, type) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (type === 'percent') return `${(value * 100).toFixed(1)}%`;
  if (type === 'ratio') return value.toFixed(2);

  const abs = Math.abs(value);
  if (abs >= 1e9) return `LKR ${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `LKR ${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `LKR ${(value / 1e3).toFixed(1)}K`;
  return `LKR ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function extractOrderedRatioTrends(analytics) {
  const byYear = analytics?.ratios?.by_year;
  if (!byYear || typeof byYear !== 'object') return [];

  const years = Object.keys(byYear).sort((a, b) => a.localeCompare(b));
  if (years.length < 2) return [];

  return ORDERED_TREND_CONFIGS
    .map((metric) => {
      const data = years
        .map((year) => ({ year, value: byYear[year]?.[metric.key] }))
        .filter((entry) => typeof entry.value === 'number' && Number.isFinite(entry.value));
      if (data.length < 2) return null;
      return {
        key: metric.key,
        label: metric.label,
        color: metric.color,
        valueType: metric.valueType,
        data,
      };
    })
    .filter(Boolean);
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

export default function TrendCharts({ analytics }) {
  const trendEntries = useMemo(() => extractOrderedRatioTrends(analytics), [analytics]);

  if (trendEntries.length === 0) {
    return null;
  }

  return (
    <div className="card fade-in">
      <div className="card-header">Financial Trends (LKR)</div>
      <div className="card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
          {trendEntries.map((trend) => (
            <div key={trend.key}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                {trend.label} Trend
              </div>
              <MiniBarChart data={trend.data} color={trend.color} />
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                {trend.data.map((d, i) => (
                  <span key={i} style={{ fontSize: 10, color: '#1e293b', fontWeight: 600 }}>
                    {formatValue(d.value, trend.valueType)}
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
