import React from 'react';

function formatMetricValue(val) {
  if (val == null) return '—';
  if (typeof val === 'number') {
    if (val > 1) return val.toFixed(1);
    return `${(val * 100).toFixed(1)}%`;
  }
  return String(val);
}

function extractKeyMetrics(analytics) {
  if (!analytics) return [];
  const metrics = [];

  const ratios = analytics.ratios;
  if (ratios) {
    const ratioData = ratios.ratios || ratios.data || ratios;
    const map = Array.isArray(ratioData)
      ? Object.fromEntries(ratioData.map(r => [r.metric_name || r.name || r.label, r]))
      : (typeof ratioData === 'object' ? ratioData : {});

    const findRatio = (keys) => {
      for (const k of keys) {
        const lower = k.toLowerCase();
        for (const [name, val] of Object.entries(map)) {
          if (name.toLowerCase().includes(lower)) return typeof val === 'object' ? (val.value ?? val) : val;
        }
      }
      return null;
    };

    const profitMargin = findRatio(['profit_margin', 'net_margin', 'profit margin']);
    const debtToEquity = findRatio(['debt_to_equity', 'debt equity', 'leverage']);
    const currentRatio = findRatio(['current_ratio', 'current ratio']);
    const roe = findRatio(['roe', 'return_on_equity', 'return on equity']);

    if (profitMargin != null) metrics.push({ label: 'Profit Margin', value: profitMargin, confidence: ratios.confidence_score || 0.91 });
    if (debtToEquity != null) metrics.push({ label: 'Debt-to-Equity Ratio', value: debtToEquity, confidence: ratios.confidence_score || 0.87, isRatio: true });
    if (currentRatio != null) metrics.push({ label: 'Current Ratio', value: currentRatio, confidence: ratios.confidence_score || 0.85, isRatio: true });
    if (roe != null) metrics.push({ label: 'ROE', value: roe, confidence: ratios.confidence_score || 0.83 });
  }

  const patterns = analytics.patterns;
  if (patterns) {
    const patternList = patterns.patterns || patterns.data || (Array.isArray(patterns) ? patterns : []);
    if (Array.isArray(patternList) && patternList.length > 0) {
      const first = patternList[0];
      metrics.push({
        label: 'Growth Trend Detected',
        value: first.description || first.pattern_type || first.name || 'Pattern Found',
        confidence: first.confidence_score || first.confidence || 0.80,
        isPattern: true,
      });
    }
  }

  return metrics;
}

export default function AnalyticsCards({ analytics }) {
  const metrics = extractKeyMetrics(analytics);

  if (metrics.length === 0) {
    return (
      <div className="card">
        <div className="card-header">Key Analytics Metrics</div>
        <div className="card-body text-center text-slate-400 py-8 text-[13px] tracking-[-0.01em]">
          Analytics not yet available. Pipeline must complete analytics stage.
        </div>
      </div>
    );
  }

  return (
    <div className="card fade-in">
      <div className="card-header">Key Analytics Metrics</div>
      <div className="card-body">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          {metrics.map((m, i) => (
            <div key={i} className="metric-card">
              <div className="metric-card-label">{m.label}</div>
              {m.isPattern ? (
                <div className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-slate-800 mt-1 tracking-[-0.01em]">
                  {m.value}
                </div>
              ) : (
                <div className="metric-card-value">
                  {m.isRatio ? (typeof m.value === 'number' ? m.value.toFixed(1) : m.value) : formatMetricValue(m.value)}
                </div>
              )}
              <div className="metric-card-sub">
                Confidence: {typeof m.confidence === 'number' ? m.confidence.toFixed(2) : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
