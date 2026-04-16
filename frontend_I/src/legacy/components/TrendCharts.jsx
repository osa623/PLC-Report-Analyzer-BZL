import React, { useMemo } from 'react';

const TREND_CONFIGS = [
  { key: 'revenue', label: 'Revenue Trend', color: '#334155', match: ['revenue', 'total_revenue', 'turnover', 'sales'] },
  { key: 'profit', label: 'Profit Trend', color: '#0f172a', match: ['net_profit', 'profit_after_tax', 'net_income'] },
  { key: 'cash', label: 'Cash Position', color: '#64748b', match: ['cash', 'cash_and_cash_equivalents', 'cash_balance'] },
];

function extractTrendData(rows) {
  const trends = {};
  for (const cfg of TREND_CONFIGS) {
    const matchingRows = rows.filter((r) => cfg.match.some((m) => (r.canonical_label || '').toLowerCase().includes(m)));
    if (matchingRows.length > 0) {
      const byYear = {};
      for (const row of matchingRows) {
        const year = String(row.year || 'unknown');
        if (!byYear[year] && typeof row.value === 'number') byYear[year] = row.value;
      }
      const sorted = Object.entries(byYear).sort(([a], [b]) => a.localeCompare(b)).map(([year, value]) => ({ year, value }));
      if (sorted.length > 0) trends[cfg.key] = { ...cfg, data: sorted };
    }
  }
  return trends;
}

function MiniBarChart({ data, color }) {
  const maxVal = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <div className="flex items-end gap-2" style={{ height: 80 }}>
      {data.map((d, i) => {
        const h = (Math.abs(d.value) / maxVal) * 70;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="chart-bar w-full max-w-[40px]" style={{ height: Math.max(h, 4), background: color, opacity: 0.85 }} />
            <span className="text-[9px] text-slate-500 font-semibold tracking-[-0.01em]">{d.year}</span>
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

  if (trendEntries.length === 0) return null;

  return (
    <div className="card fade-in">
      <div className="card-header">Financial Trends (Validated Data)</div>
      <div className="card-body">
        <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${Math.min(trendEntries.length, 3)}, 1fr)` }}>
          {trendEntries.map((trend) => (
            <div key={trend.key}>
              <div className="text-[12px] font-semibold text-slate-500 mb-2 tracking-[-0.01em]">{trend.label}</div>
              <MiniBarChart data={trend.data} color={trend.color} />
              <div className="mt-1.5 flex justify-between">
                {trend.data.map((d, i) => (
                  <span key={i} className="text-[10px] text-slate-800 font-semibold tracking-[-0.01em]">{formatLargeNum(d.value)}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
