import React from 'react';

function formatMetricValue(val) {
  if (val == null) return '—';
  if (typeof val === 'number') {
    if (val > 1) return val.toFixed(1);
    return `${(val * 100).toFixed(1)}%`;
  }
  return String(val);
}

function formatDisplayNumber(val, digits = 2) {
  if (typeof val !== 'number' || Number.isNaN(val)) return '—';
  return val.toFixed(digits);
}

function formatPercent(val, digits = 1) {
  if (typeof val !== 'number' || Number.isNaN(val)) return '—';
  return `${(val * 100).toFixed(digits)}%`;
}

function toTitleCase(text) {
  return String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatFinancialValue(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function isRatioLikeMetric(key = '') {
  const k = String(key).toLowerCase();
  return (
    k.includes('ratio') ||
    k.includes('margin') ||
    k.includes('growth') ||
    k.includes('return') ||
    k.includes('yoy') ||
    k.includes('score') ||
    k.includes('rate') ||
    k.includes('days') ||
    k.includes('cycle') ||
    k.includes('multiple') ||
    k.includes('turnover')
  );
}

function formatMetricByName(key, value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (isRatioLikeMetric(key)) {
    if (key.toLowerCase().includes('score')) return value.toFixed(2);
    if (key.toLowerCase().includes('days')) return value.toFixed(1);
    if (Math.abs(value) <= 1.5) return formatPercent(value, 1);
    return formatDisplayNumber(value, 2);
  }
  return formatFinancialValue(value);
}

function extractAllNumericMetrics(analytics) {
  const ratios = analytics?.ratios && typeof analytics.ratios === 'object' ? analytics.ratios : {};
  const byYear = ratios.by_year && typeof ratios.by_year === 'object' ? ratios.by_year : {};

  const years = Object.keys(byYear).sort((a, b) => a.localeCompare(b));
  const latestYear = typeof ratios.latest_year === 'string' ? ratios.latest_year : years[years.length - 1] || null;
  const latestValues = latestYear && byYear[latestYear] && typeof byYear[latestYear] === 'object'
    ? byYear[latestYear]
    : ratios;

  const latestNumericMetrics = Object.entries(latestValues || {})
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([key, value]) => ({
      key,
      label: toTitleCase(key),
      value,
      display: formatMetricByName(key, value),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const metricKeys = Array.from(
    new Set(
      years.flatMap((year) =>
        Object.entries(byYear[year] || {})
          .filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
          .map(([key]) => key)
      )
    )
  ).sort((a, b) => a.localeCompare(b));

  const yearlyTable = metricKeys.map((metricKey) => ({
    key: metricKey,
    label: toTitleCase(metricKey),
    values: years.map((year) => {
      const raw = byYear[year]?.[metricKey];
      return {
        year,
        raw,
        display: formatMetricByName(metricKey, raw),
      };
    }),
  }));

  const trendCandidates = yearlyTable
    .map((row) => ({
      ...row,
      numericValues: row.values
        .filter((item) => typeof item.raw === 'number' && Number.isFinite(item.raw))
        .map((item) => ({ year: item.year, value: item.raw })),
    }))
    .filter((row) => row.numericValues.length >= 2)
    .slice(0, 8);

  return {
    latestYear,
    latestNumericMetrics,
    years,
    yearlyTable,
    trendCandidates,
  };
}

function TinyTrendBars({ points }) {
  const maxAbs = Math.max(...points.map((p) => Math.abs(p.value)), 1);
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 46 }}>
      {points.map((point) => (
        <div key={`${point.year}-${point.value}`} style={{ flex: 1, minWidth: 10 }}>
          <div
            style={{
              width: '100%',
              borderRadius: 4,
              background: '#475569',
              opacity: 0.75,
              height: Math.max(6, (Math.abs(point.value) / maxAbs) * 40),
            }}
            title={`${point.year}: ${formatFinancialValue(point.value)}`}
          />
        </div>
      ))}
    </div>
  );
}

function extractKeyMetrics(analytics) {
  if (!analytics) return [];

  const metrics = [];
  const globalConfidence = typeof analytics?.confidence?.raw_score === 'number'
    ? analytics.confidence.raw_score
    : (typeof analytics?.confidence?.score === 'number' ? analytics.confidence.score : null);

  // Extract from ratios
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
          if (name.toLowerCase().includes(lower)) {
            if (val && typeof val === 'object') {
              return {
                value: val.value ?? null,
                confidence: typeof val.confidence_score === 'number'
                  ? val.confidence_score
                  : (typeof val.confidence === 'number' ? val.confidence : globalConfidence),
              };
            }
            return { value: val, confidence: globalConfidence };
          }
        }
      }
      return null;
    };

    const profitMargin = findRatio(['net_profit_margin', 'profit_margin']);
    const debtToEquity = findRatio(['debt_to_equity', 'debt equity', 'leverage']);
    const currentRatio = findRatio(['current_ratio', 'current ratio']);
    const roe = findRatio(['return_on_equity', 'return on equity']);

    if (profitMargin?.value != null) metrics.push({ label: 'Profit Margin', value: profitMargin.value, confidence: profitMargin.confidence });
    if (debtToEquity?.value != null) metrics.push({ label: 'Debt-to-Equity Ratio', value: debtToEquity.value, confidence: debtToEquity.confidence, isRatio: true });
    if (currentRatio?.value != null) metrics.push({ label: 'Current Ratio', value: currentRatio.value, confidence: currentRatio.confidence, isRatio: true });
    if (roe?.value != null) metrics.push({ label: 'ROE', value: roe.value, confidence: roe.confidence });
  }

  // Extract from patterns
  const patterns = analytics.patterns;
  if (patterns) {
    const patternList = patterns.patterns || patterns.data || (Array.isArray(patterns) ? patterns : []);
    if (Array.isArray(patternList) && patternList.length > 0) {
      const first = patternList[0];
      metrics.push({
        label: 'Growth Trend Detected',
        value: first.description || first.pattern_type || first.name || 'Pattern Found',
        confidence: typeof first.confidence_score === 'number'
          ? first.confidence_score
          : (typeof first.confidence === 'number' ? first.confidence : globalConfidence),
        isPattern: true,
      });
    }
  }

  return metrics;
}

function extractDetailedAnalytics(analytics) {
  const ratios = analytics?.ratios && typeof analytics.ratios === 'object' ? analytics.ratios : {};
  const risk = analytics?.risk && typeof analytics.risk === 'object' ? analytics.risk : {};

  const latestYear = typeof ratios.latest_year === 'string' ? ratios.latest_year : null;
  const latestFromByYear = latestYear && ratios.by_year && typeof ratios.by_year === 'object'
    ? ratios.by_year[latestYear]
    : null;
  const latestMetrics = latestFromByYear && typeof latestFromByYear === 'object' ? latestFromByYear : ratios;

  const periodRatios = [
    { label: 'Gross Profit Margin', value: formatPercent(latestMetrics.gross_profit_margin), raw: latestMetrics.gross_profit_margin },
    { label: 'Net Profit Margin', value: formatPercent(latestMetrics.net_profit_margin), raw: latestMetrics.net_profit_margin },
    { label: 'Current Ratio', value: formatDisplayNumber(latestMetrics.current_ratio), raw: latestMetrics.current_ratio },
    { label: 'Debt to Equity', value: formatDisplayNumber(latestMetrics.debt_to_equity), raw: latestMetrics.debt_to_equity },
    { label: 'Debt Ratio', value: formatPercent(latestMetrics.debt_ratio), raw: latestMetrics.debt_ratio },
    { label: 'ROE', value: formatPercent(latestMetrics.return_on_equity), raw: latestMetrics.return_on_equity },
    { label: 'ROA', value: formatPercent(latestMetrics.return_on_assets), raw: latestMetrics.return_on_assets },
    {
      label: 'Cash Flow to Net Income',
      value: formatDisplayNumber(latestMetrics.cash_flow_to_net_income),
      raw: latestMetrics.cash_flow_to_net_income,
    },
  ].filter((item) => item.raw != null && item.value !== '—');

  const growthSnapshotRaw = ratios.latest_growth_snapshot && typeof ratios.latest_growth_snapshot === 'object'
    ? ratios.latest_growth_snapshot
    : {};
  const growthSnapshot = Object.entries(growthSnapshotRaw)
    .filter(([key, value]) => key.endsWith('_yoy') && typeof value === 'number')
    .map(([key, value]) => ({
      label: toTitleCase(key.replace(/_yoy$/, '')),
      value: formatPercent(value),
      raw: value,
    }));

  const riskSignalsRaw = risk.risk_scores && typeof risk.risk_scores === 'object' ? risk.risk_scores : {};
  const riskLevels = risk.risk_levels && typeof risk.risk_levels === 'object' ? risk.risk_levels : {};
  const riskSignals = Object.entries(riskSignalsRaw)
    .filter(([, value]) => typeof value === 'number')
    .map(([key, value]) => ({
      label: toTitleCase(key),
      score: formatPercent(value, 0),
      level: riskLevels[key] || 'unknown',
      raw: value,
    }));

  const patternItems = Array.isArray(analytics?.patterns)
    ? analytics.patterns
    : (Array.isArray(analytics?.patterns?.patterns) ? analytics.patterns.patterns : []);
  const patterns = patternItems
    .map((item) => (typeof item === 'string' ? item : item?.description || item?.pattern_type || item?.name))
    .filter(Boolean)
    .slice(0, 6);

  const forensicFlags = Array.isArray(ratios.forensic_flags)
    ? ratios.forensic_flags.slice(0, 6)
    : [];

  const missingByYear = ratios.data_coverage?.missing_or_unverifiable_values;
  let coverageSummary = '—';
  if (missingByYear && typeof missingByYear === 'object') {
    const yearEntries = Object.entries(missingByYear);
    const missingCount = yearEntries.reduce(
      (sum, [, arr]) => sum + (Array.isArray(arr) ? arr.length : 0),
      0,
    );
    coverageSummary = `${missingCount} missing critical values across ${yearEntries.length} period(s)`;
  }

  return {
    latestYear,
    periodRatios,
    growthSnapshot,
    riskSignals,
    patterns,
    forensicFlags,
    overallRiskScore: typeof risk.overall_risk_score === 'number' ? risk.overall_risk_score : null,
    overallRiskLevel: risk.overall_risk_level || risk.risk_rating || null,
    coverageSummary,
  };
}

function riskTone(level) {
  const normalized = String(level || '').toLowerCase();
  if (normalized === 'high') return { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' };
  if (normalized === 'moderate' || normalized === 'medium') return { bg: '#fffbeb', border: '#fde68a', color: '#92400e' };
  if (normalized === 'low') return { bg: '#ecfdf5', border: '#bbf7d0', color: '#166534' };
  return { bg: '#f8fafc', border: '#e2e8f0', color: '#334155' };
}

export default function AnalyticsCards({ analytics }) {
  const metrics = extractKeyMetrics(analytics);
  const details = extractDetailedAnalytics(analytics);
  const numeric = extractAllNumericMetrics(analytics);

  if (
    metrics.length === 0 &&
    details.periodRatios.length === 0 &&
    details.riskSignals.length === 0 &&
    numeric.latestNumericMetrics.length === 0
  ) {
    return (
      <div className="card">
        <div className="card-header">Key Analytics Metrics</div>
        <div className="card-body" style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>
          Analytics not yet available. Pipeline must complete analytics stage.
        </div>
      </div>
    );
  }

  return (
    <div className="card fade-in">
      <div className="card-header">Key Analytics Metrics</div>
      <div className="card-body">
        {(details.overallRiskScore != null || details.overallRiskLevel) && (
          <div
            className="mb-4 rounded-xl border px-3 py-2"
            style={{
              background: riskTone(details.overallRiskLevel).bg,
              borderColor: riskTone(details.overallRiskLevel).border,
              color: riskTone(details.overallRiskLevel).color,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Risk Model Summary
            </div>
            <div style={{ fontSize: 13, marginTop: 3, fontWeight: 600 }}>
              Score: {details.overallRiskScore != null ? details.overallRiskScore.toFixed(2) : '—'} / 100
              {' · '}
              Level: {details.overallRiskLevel ? toTitleCase(details.overallRiskLevel) : 'Unknown'}
              {details.latestYear ? ` · Period: ${details.latestYear}` : ''}
            </div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
              Coverage: {details.coverageSummary}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {metrics.map((m, i) => (
            <div key={i} className="metric-card">
              <div className="metric-card-label">{m.label}</div>
              {m.isPattern ? (
                <div style={{
                  background: '#f1f5f9',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#1e293b',
                  marginTop: 4,
                }}>
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

        {(details.periodRatios.length > 0 || details.growthSnapshot.length > 0) && (
          <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {details.periodRatios.length > 0 && (
              <div className="metric-card" style={{ padding: 14 }}>
                <div className="metric-card-label">Latest Period Ratios</div>
                <div className="mt-2 space-y-1.5">
                  {details.periodRatios.map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-[12px]">
                      <span className="text-slate-500">{item.label}</span>
                      <span className="font-semibold text-slate-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {details.growthSnapshot.length > 0 && (
              <div className="metric-card" style={{ padding: 14 }}>
                <div className="metric-card-label">YoY Growth Snapshot</div>
                <div className="mt-2 space-y-1.5">
                  {details.growthSnapshot.slice(0, 6).map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-[12px]">
                      <span className="text-slate-500">{item.label}</span>
                      <span className="font-semibold text-slate-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {numeric.latestNumericMetrics.length > 0 && (
          <div className="mt-4 metric-card" style={{ padding: 14 }}>
            <div className="metric-card-label">All Numeric Calculations {numeric.latestYear ? `(Latest: ${numeric.latestYear})` : ''}</div>
            <div
              style={{
                marginTop: 10,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 10,
              }}
            >
              {numeric.latestNumericMetrics.map((item) => (
                <div
                  key={item.key}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '8px 10px',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 3 }}>{item.display}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {numeric.trendCandidates.length > 0 && (
          <div className="mt-4 metric-card" style={{ padding: 14 }}>
            <div className="metric-card-label">Metric Trend Bars</div>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {numeric.trendCandidates.map((row) => (
                <div key={row.key} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, background: '#ffffff' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 8 }}>{row.label}</div>
                  <TinyTrendBars points={row.numericValues} />
                  <div style={{ marginTop: 6, fontSize: 10, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                    {row.numericValues.map((p) => (
                      <span key={`${row.key}-${p.year}`}>{p.year}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {numeric.yearlyTable.length > 0 && (
          <div className="mt-4 metric-card" style={{ padding: 14 }}>
            <div className="metric-card-label">Year-wise Numeric Matrix</div>
            <div style={{ marginTop: 10, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontSize: 11, color: '#64748b', padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Metric</th>
                    {numeric.years.map((year) => (
                      <th key={year} style={{ textAlign: 'right', fontSize: 11, color: '#64748b', padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>{year}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {numeric.yearlyTable.map((row, idx) => (
                    <tr key={row.key} style={{ background: idx % 2 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ fontSize: 12, color: '#334155', padding: '7px 10px', borderBottom: '1px solid #e2e8f0' }}>{row.label}</td>
                      {row.values.map((item) => (
                        <td key={`${row.key}-${item.year}`} style={{ textAlign: 'right', fontSize: 12, color: '#0f172a', fontWeight: 600, padding: '7px 10px', borderBottom: '1px solid #e2e8f0' }}>
                          {item.display}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(details.riskSignals.length > 0 || details.forensicFlags.length > 0 || details.patterns.length > 0) && (
          <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {details.riskSignals.length > 0 && (
              <div className="metric-card" style={{ padding: 14 }}>
                <div className="metric-card-label">Risk Signals</div>
                <div className="mt-2 space-y-1.5">
                  {details.riskSignals.map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-[12px]">
                      <span className="text-slate-500">{item.label}</span>
                      <span className="font-semibold text-slate-800">{item.score} ({toTitleCase(item.level)})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {details.forensicFlags.length > 0 && (
              <div className="metric-card" style={{ padding: 14 }}>
                <div className="metric-card-label">Forensic Flags</div>
                <ul className="mt-2 space-y-1.5 text-[12px] text-slate-600">
                  {details.forensicFlags.map((item, idx) => (
                    <li key={`${item}-${idx}`}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}

            {details.patterns.length > 0 && (
              <div className="metric-card" style={{ padding: 14 }}>
                <div className="metric-card-label">Pattern Insights</div>
                <ul className="mt-2 space-y-1.5 text-[12px] text-slate-600">
                  {details.patterns.map((item, idx) => (
                    <li key={`${item}-${idx}`}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
