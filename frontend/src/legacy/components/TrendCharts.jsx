import React, { useMemo } from 'react';

const ORDERED_TREND_CONFIGS = [
  { key: 'revenue', label: 'Revenue Trend', color: '#0f172a', valueType: 'currency' },
  { key: 'net_income', label: 'Net Income', color: '#1d4ed8', valueType: 'currency' },
  { key: 'gross_profit_margin', label: 'Gross Profit Margin', color: '#0f766e', valueType: 'percent' },
  { key: 'net_profit_margin', label: 'Net Profit Margin', color: '#155e75', valueType: 'percent' },
  { key: 'return_on_equity', label: 'Return on Equity', color: '#0284c7', valueType: 'percent' },
  { key: 'return_on_assets', label: 'Return on Assets', color: '#0369a1', valueType: 'percent' },
  { key: 'debt_to_equity', label: 'Debt to Equity', color: '#b45309', valueType: 'ratio' },
  { key: 'current_ratio', label: 'Current Ratio', color: '#9333ea', valueType: 'ratio' },
  { key: 'total_assets', label: 'Total Assets', color: '#7c2d12', valueType: 'currency' },
  { key: 'total_liabilities', label: 'Total Liabilities', color: '#9f1239', valueType: 'currency' },
  { key: 'total_equity', label: 'Total Equity', color: '#166534', valueType: 'currency' },
  { key: 'total_cash_flow', label: 'Total Cash Flow', color: '#334155', valueType: 'currency' },
];

function formatValue(value, type, currency = 'LKR') {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (type === 'percent') return `${(value * 100).toFixed(1)}%`;
  if (type === 'ratio') return value.toFixed(2);

  const prefix = currency === 'USD' ? '$' : 'LKR ';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${prefix}${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${prefix}${(value / 1e3).toFixed(1)}K`;
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function sortedYears(analytics) {
  const detectedYears = Array.isArray(analytics?.ratios?.detected_years)
    ? analytics.ratios.detected_years.filter((y) => typeof y === 'string' && /^\d{4}$/.test(y))
    : [];
  if (detectedYears.length > 0) {
    return Array.from(new Set(detectedYears)).sort((a, b) => a.localeCompare(b));
  }

  const byYear = analytics?.ratios?.by_year;
  if (!byYear || typeof byYear !== 'object') return [];
  return Object.keys(byYear).filter((y) => /^\d{4}$/.test(y)).sort((a, b) => a.localeCompare(b));
}

function metricValue(yearMetrics, key) {
  if (!yearMetrics || typeof yearMetrics !== 'object') return null;
  const primary = yearMetrics[key];
  if (typeof primary === 'number' && Number.isFinite(primary)) return primary;
  if (key === 'net_income') {
    const fallback = yearMetrics.net_profit;
    if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback;
  }
  return null;
}

function extractOrderedRatioTrends(analytics, currency = 'LKR') {
  const byYear = analytics?.ratios?.by_year;
  if (!byYear || typeof byYear !== 'object') return [];

  const years = sortedYears(analytics);
  if (years.length === 0) return [];

  return ORDERED_TREND_CONFIGS
    .map((metric) => {
      const data = years.map((year) => {
        const yearMetrics = byYear[year];
        return {
          year,
          value: metricValue(yearMetrics, metric.key),
        };
      });

      if (data.length === 0) return null;

      return {
        key: metric.key,
        label: metric.label,
        color: metric.color,
        valueType: metric.valueType,
        currency,
        data,
      };
    })
    .filter(Boolean);
}

function MiniBarChart({ data, color }) {
  const numericValues = data
    .map((d) => d.value)
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  const maxVal = Math.max(...numericValues.map((v) => Math.abs(v)), 1);

  return (
    <div className="flex items-end gap-2" style={{ height: 80 }}>
      {data.map((d, i) => {
        const hasValue = typeof d.value === 'number' && Number.isFinite(d.value);
        const h = hasValue ? (Math.abs(d.value) / maxVal) * 70 : 6;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="chart-bar w-full max-w-[40px]"
              style={{
                height: Math.max(h, 4),
                background: hasValue ? color : 'transparent',
                border: hasValue ? 'none' : '1px dashed #cbd5e1',
                opacity: hasValue ? 0.85 : 1,
              }}
            />
            <span className="text-[9px] text-slate-500 font-semibold tracking-[-0.01em]">{d.year}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function TrendCharts({ analytics, currency = 'LKR' }) {
  const trendEntries = useMemo(() => extractOrderedRatioTrends(analytics, currency), [analytics, currency]);

  if (trendEntries.length === 0) {
    return (
      <div className="card fade-in">
        <div className="card-header">Financial Trends ({currency})</div>
        <div className="card-body text-[12px] text-slate-500">Trend chart data is not available for the detected reporting years.</div>
      </div>
    );
  }

  return (
    <div className="card fade-in">
      <div className="card-header">Financial Trends ({currency})</div>
      <div className="card-body">
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {trendEntries.map((trend) => (
            <div className='border-2 p-4 shadow-xl rounded-lg' key={trend.key}>
              <div className="text-[12px] font-semibold text-slate-500 mb-8 tracking-[-0.01em]">{trend.label}</div>
              <MiniBarChart data={trend.data} color={trend.color} />
              <div className="mt-1.5 flex justify-between">
                {trend.data.map((d, i) => (
                  <span key={i} className="text-[10px] text-slate-800 font-semibold tracking-[-0.01em]">{formatValue(d.value, trend.valueType, trend.currency)}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
