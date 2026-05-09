import React, { useMemo } from 'react';

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function toTitleCase(text) {
  return String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatPercent(value, digits = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const normalized = Math.abs(value) <= 1.2 ? value * 100 : value;
  return `${normalized.toFixed(digits)}%`;
}

function formatNumber(value, digits = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

function formatCurrency(value, currency = 'LKR') {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const prefix = currency === 'USD' ? '$' : 'LKR ';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${prefix}${Math.round(value / 1e6).toLocaleString('en-US')}M`;
  if (abs >= 1e3) return `${prefix}${Math.round(value).toLocaleString('en-US')}`;
  return `${prefix}${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatMetricByKey(key, value, currency = 'LKR') {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const k = String(key || '').toLowerCase();
  if (
    k.includes('margin') ||
    k.includes('return') ||
    k.includes('yoy') ||
    k.includes('growth') ||
    k.includes('yield') ||
    k.includes('ratio')
  ) {
    if (k.includes('ratio') || k.includes('multiple')) return value.toFixed(2);
    return formatPercent(value, 1);
  }
  if (k.includes('score')) return value.toFixed(2);
  return formatCurrency(value, currency);
}

function inferTrend(values) {
  const numeric = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (numeric.length < 2) return 'stable';
  const first = numeric[0];
  const last = numeric[numeric.length - 1];
  const delta = Math.abs(first) < 1e-9 ? last : (last - first) / Math.abs(first);
  if (delta >= 0.1) return 'improving';
  if (delta <= -0.1) return 'declining';
  return 'stable';
}

function summaryTone(value) {
  if (value === 'improving') return { bg: '#ecfdf5', text: '#166534' };
  if (value === 'declining') return { bg: '#fef2f2', text: '#991b1b' };
  return { bg: '#f8fafc', text: '#334155' };
}

function extractRatiosByYear(analytics) {
  const byYear = analytics?.ratios?.by_year;
  if (!byYear || typeof byYear !== 'object') return { years: [], byYear: {} };
  const years = Object.keys(byYear)
    .filter((year) => /^\d{4}$/.test(year))
    .sort((a, b) => Number(a) - Number(b));
  return { years, byYear };
}

function extractLatestMetrics(analytics) {
  const { years, byYear } = extractRatiosByYear(analytics);
  const latestYear = analytics?.ratios?.latest_year && byYear[analytics.ratios.latest_year]
    ? analytics.ratios.latest_year
    : years[years.length - 1] || null;

  const latest = latestYear ? byYear[latestYear] || {} : {};

  return {
    latestYear,
    latest,
    years,
    byYear,
  };
}

function extractAllNumericMetrics(analytics, currency = 'LKR') {
  const { years, byYear, latestYear, latest } = extractLatestMetrics(analytics);

  const latestNumericMetrics = Object.entries(latest || {})
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([key, value]) => ({
      key,
      label: toTitleCase(key),
      value,
      display: formatMetricByKey(key, value, currency),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const allKeys = Array.from(
    new Set(
      years.flatMap((year) =>
        Object.entries(byYear[year] || {})
          .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
          .map(([key]) => key)
      )
    )
  ).sort((a, b) => a.localeCompare(b));

  const yearlyTable = allKeys.map((key) => ({
    key,
    label: toTitleCase(key),
    values: years.map((year) => {
      const raw = byYear[year]?.[key];
      return {
        year,
        raw,
        display: formatMetricByKey(key, raw, currency),
      };
    }),
  }));

  return {
    latestYear,
    latestNumericMetrics,
    years,
    yearlyTable,
  };
}

function buildMetricCards(latest, currency = 'LKR') {
  const cards = [
    {
      id: 'revenue',
      label: 'Revenue',
      value: latest.revenue,
      display: formatCurrency(latest.revenue, currency),
      interpretation:
        typeof latest.revenue === 'number'
          ? 'Indicates the scale of the operating engine and the top-line earning power.'
          : 'Revenue value is unavailable in this run.',
    },
    {
      id: 'net_profit_margin',
      label: 'Net Profit Margin',
      value: latest.net_profit_margin,
      display: formatPercent(latest.net_profit_margin),
      interpretation:
        typeof latest.net_profit_margin === 'number'
          ? latest.net_profit_margin >= 0.1
            ? 'Healthy margin profile with room to absorb operating pressure.'
            : latest.net_profit_margin >= 0.05
              ? 'Moderate profitability; track cost discipline closely.'
              : 'Thin margin profile, vulnerable to input or financing volatility.'
          : 'Margin value is unavailable in this run.',
    },
    {
      id: 'current_ratio',
      label: 'Current Ratio',
      value: latest.current_ratio,
      display: formatNumber(latest.current_ratio),
      interpretation:
        typeof latest.current_ratio === 'number'
          ? latest.current_ratio >= 1.5
            ? 'Strong near-term liquidity buffer.'
            : latest.current_ratio >= 1.0
              ? 'Adequate short-term coverage, but not very defensive.'
              : 'Potential short-term liquidity pressure needs attention.'
          : 'Liquidity ratio is unavailable in this run.',
    },
    {
      id: 'debt_to_equity',
      label: 'Debt to Equity',
      value: latest.debt_to_equity,
      display: formatNumber(latest.debt_to_equity),
      interpretation:
        typeof latest.debt_to_equity === 'number'
          ? latest.debt_to_equity <= 1.0
            ? 'Conservative leverage profile.'
            : latest.debt_to_equity <= 2.0
              ? 'Balanced leverage, still manageable under normal cycles.'
              : 'Leverage is elevated and may amplify downside risk.'
          : 'Leverage ratio is unavailable in this run.',
    },
    {
      id: 'cash_flow_to_net_income',
      label: 'Cash Flow to Net Income',
      value: latest.cash_flow_to_net_income,
      display: formatNumber(latest.cash_flow_to_net_income),
      interpretation:
        typeof latest.cash_flow_to_net_income === 'number'
          ? latest.cash_flow_to_net_income >= 1.0
            ? 'Earnings are strongly supported by cash conversion.'
            : latest.cash_flow_to_net_income >= 0.7
              ? 'Cash conversion is acceptable but should be monitored.'
              : 'Weak cash conversion may indicate quality-of-earnings risk.'
          : 'Cash conversion metric is unavailable in this run.',
    },
  ];

  return cards;
}

function buildExecutiveSummary(latest, risk, years, byYear) {
  const netMarginTrend = inferTrend(
    years.map((year) => byYear?.[year]?.net_profit_margin).filter((v) => typeof v === 'number')
  );
  const revenueTrend = inferTrend(
    years.map((year) => byYear?.[year]?.revenue).filter((v) => typeof v === 'number')
  );
  const currentRatio = latest.current_ratio;
  const debtToEquity = latest.debt_to_equity;
  const cfoQuality = latest.cash_flow_to_net_income;
  const riskLevel = String(risk?.overall_risk_level || risk?.risk_rating || 'moderate').toLowerCase();

  const bullets = [];

  bullets.push(
    revenueTrend === 'improving'
      ? 'Revenue trajectory is improving, suggesting stronger market absorption over time.'
      : revenueTrend === 'declining'
        ? 'Revenue trajectory is softening and should be validated against segment-level demand.'
        : 'Revenue trajectory is stable with no major directional break in recent periods.'
  );

  bullets.push(
    netMarginTrend === 'improving'
      ? 'Profitability trend is improving, indicating better earnings efficiency.'
      : netMarginTrend === 'declining'
        ? 'Profitability trend is declining, indicating margin pressure that needs management response.'
        : 'Profitability trend is broadly stable without severe swings.'
  );

  if (typeof currentRatio === 'number') {
    bullets.push(
      currentRatio >= 1.5
        ? 'Liquidity coverage is strong, supporting short-term obligations with adequate current assets.'
        : currentRatio >= 1.0
          ? 'Liquidity coverage is acceptable, but resilience during shocks is moderate.'
          : 'Liquidity coverage is weak, indicating potential working-capital stress.'
    );
  }

  if (typeof debtToEquity === 'number') {
    bullets.push(
      debtToEquity <= 1
        ? 'Leverage remains conservative and balance-sheet risk is relatively contained.'
        : debtToEquity <= 2
          ? 'Leverage is moderate; debt service conditions should still be monitored.'
          : 'Leverage is elevated and increases vulnerability to earnings volatility.'
    );
  }

  if (typeof cfoQuality === 'number') {
    bullets.push(
      cfoQuality >= 1
        ? 'Cash conversion supports earnings quality, lowering accrual-related risk.'
        : cfoQuality >= 0.7
          ? 'Cash conversion is moderate and should be validated alongside receivable trends.'
          : 'Cash conversion is weak relative to net income and may signal quality concerns.'
    );
  }

  bullets.push(
    `Risk model indicates a ${riskLevel} profile${typeof risk?.overall_risk_score === 'number' ? ` (${risk.overall_risk_score.toFixed(1)}/100)` : ''}.`
  );

  return bullets.slice(0, 6);
}

function buildInterpretationRows(years, byYear) {
  const metricDefs = [
    { key: 'revenue', label: 'Revenue' },
    { key: 'net_profit_margin', label: 'Net Profit Margin' },
    { key: 'current_ratio', label: 'Current Ratio' },
    { key: 'debt_to_equity', label: 'Debt to Equity' },
    { key: 'return_on_equity', label: 'ROE' },
    { key: 'return_on_assets', label: 'ROA' },
  ];

  return metricDefs.map((metric) => {
    const points = years
      .map((year) => byYear?.[year]?.[metric.key])
      .filter((value) => typeof value === 'number' && Number.isFinite(value));

    const trend = inferTrend(points);
    return {
      ...metric,
      trend,
      latest: points[points.length - 1],
      message:
        trend === 'improving'
          ? 'Trend is strengthening year over year.'
          : trend === 'declining'
            ? 'Trend is deteriorating and requires attention.'
            : 'Trend is stable without major volatility.',
    };
  });
}

function extractGrowthSnapshot(analytics) {
  const raw = analytics?.ratios?.latest_growth_snapshot;
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw)
    .filter(([key, value]) => key.endsWith('_yoy') && typeof value === 'number' && Number.isFinite(value))
    .map(([key, value]) => ({
      key,
      label: toTitleCase(key.replace(/_yoy$/, '')),
      value,
      display: formatPercent(value),
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 6);
}

function extractRiskSignals(analytics) {
  const riskScores = analytics?.risk?.risk_scores;
  const riskLevels = analytics?.risk?.risk_levels || {};
  if (!riskScores || typeof riskScores !== 'object') return [];

  return Object.entries(riskScores)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([key, value]) => ({
      key,
      label: toTitleCase(key),
      score: value,
      level: String(riskLevels[key] || 'unknown'),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function buildPatternMatrix(analytics, latest, years, byYear) {
  const patternSource = Array.isArray(analytics?.patterns)
    ? analytics.patterns
    : Array.isArray(analytics?.patterns?.patterns)
      ? analytics.patterns.patterns
      : [];

  const patternHints = patternSource
    .map((entry) => {
      if (typeof entry === 'string') return entry.toLowerCase();
      return String(entry?.description || entry?.pattern_type || entry?.name || '').toLowerCase();
    })
    .filter(Boolean);

  const numericSeries = (metricKeys) =>
    years
      .map((year) => {
        const metricMap = byYear?.[year] || {};
        for (const key of metricKeys) {
          const value = metricMap?.[key];
          if (typeof value === 'number' && Number.isFinite(value)) return value;
        }
        return null;
      })
      .filter((value) => typeof value === 'number' && Number.isFinite(value));

  const growthRates = (series) => {
    const rates = [];
    for (let i = 1; i < series.length; i += 1) {
      const prev = series[i - 1];
      const curr = series[i];
      if (Math.abs(prev) < 1e-9) continue;
      rates.push((curr - prev) / Math.abs(prev));
    }
    return rates;
  };

  const stdDev = (values) => {
    if (!values.length) return 0;
    const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
    const variance = values.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / values.length;
    return Math.sqrt(variance);
  };

  const revenueSeries = numericSeries(['revenue']);
  const marginSeries = numericSeries(['net_profit_margin']);
  const debtSeries = numericSeries(['debt_to_equity', 'total_liabilities']);
  const assetSeries = numericSeries(['total_assets']);
  const cashFlowSeries = numericSeries(['total_cash_flow', 'operating_cash_flow']);
  const earningsSeries = numericSeries(['net_income', 'net_profit']);

  const marginGrowth = growthRates(marginSeries);
  const revenueGrowth = growthRates(revenueSeries);
  const debtGrowth = growthRates(debtSeries);
  const assetGrowth = growthRates(assetSeries);
  const cashGrowth = growthRates(cashFlowSeries);
  const earningsGrowth = growthRates(earningsSeries);

  const latestMarginGrowth = marginGrowth[marginGrowth.length - 1] ?? 0;
  const latestRevenueGrowth = revenueGrowth[revenueGrowth.length - 1] ?? 0;
  const previousRevenueGrowth = revenueGrowth.length > 1 ? revenueGrowth[revenueGrowth.length - 2] : 0;
  const latestDebtGrowth = debtGrowth[debtGrowth.length - 1] ?? 0;
  const latestAssetGrowth = assetGrowth[assetGrowth.length - 1] ?? 0;
  const latestCashGrowth = cashGrowth[cashGrowth.length - 1] ?? 0;
  const latestEarningsGrowth = earningsGrowth[earningsGrowth.length - 1] ?? 0;

  const globalConfidence = typeof analytics?.confidence?.overall_data_quality_score === 'number'
    ? clamp(analytics.confidence.overall_data_quality_score)
    : typeof analytics?.confidence?.score === 'number'
      ? clamp(analytics.confidence.score)
      : typeof analytics?.confidence?.raw_score === 'number'
        ? clamp(analytics.confidence.raw_score)
        : 0.5;
  const dataCoverage = clamp(years.length / 3);

  const confidenceFromSignal = ({ detected, signalStrength, hintBoost = 0 }) => {
    const detectionAdjustment = detected ? 0.08 : -0.04;
    const score =
      (0.46 * globalConfidence)
      + (0.30 * dataCoverage)
      + (0.20 * clamp(signalStrength))
      + detectionAdjustment
      + hintBoost;
    return clamp(score, 0.2, 0.98);
  };

  const marginSignal = clamp(Math.abs(latestMarginGrowth) / 0.1);
  const revenueSignal = clamp(Math.abs(latestRevenueGrowth - previousRevenueGrowth) / 0.2);
  const volatilitySignal = clamp(stdDev(earningsGrowth) / 0.6);
  const debtSignal = clamp(
    Math.max(
      Math.abs(latestDebtGrowth) / 0.5,
      typeof latest.debt_to_equity === 'number' ? latest.debt_to_equity / 4 : 0
    )
  );
  const cashDivergenceSignal = clamp(
    Math.max(
      Math.abs(latestCashGrowth - latestEarningsGrowth) / 0.7,
      typeof latest.cash_flow_to_net_income === 'number' ? Math.abs(1 - latest.cash_flow_to_net_income) / 1.2 : 0
    )
  );
  const assetSignal = clamp(Math.abs(latestAssetGrowth) / 0.6);

  const hasVolatilityHint = patternHints.some((hint) => hint.includes('volatile') || hint.includes('instability'));
  const marginExpansion = latestMarginGrowth >= 0.02;
  const marginCompression = latestMarginGrowth <= -0.02;
  const revenueAcceleration = latestRevenueGrowth - previousRevenueGrowth >= 0.05;
  const revenueDeceleration = latestRevenueGrowth - previousRevenueGrowth <= -0.05;
  const earningsVolatility = volatilitySignal >= 0.55 || hasVolatilityHint;
  const debtAccumulation = latestDebtGrowth >= 0.2 || (typeof latest.debt_to_equity === 'number' && latest.debt_to_equity > 2);
  const cashFlowDivergence = cashDivergenceSignal >= 0.5 || (typeof latest.cash_flow_to_net_income === 'number' && latest.cash_flow_to_net_income < 0.7);
  const assetGrowthSurge = latestAssetGrowth >= 0.25;

  const checks = [
    {
      id: 'margin_expansion',
      title: 'Margin Expansion',
      detected: marginExpansion,
      confidence: confidenceFromSignal({ detected: marginExpansion, signalStrength: marginSignal }),
      meaning: 'Detects strengthening profitability with positive margin momentum.',
    },
    {
      id: 'margin_compression',
      title: 'Margin Compression',
      detected: marginCompression,
      confidence: confidenceFromSignal({ detected: marginCompression, signalStrength: marginSignal }),
      meaning: 'Flags shrinking profit margins that can pressure earnings quality.',
    },
    {
      id: 'revenue_acceleration',
      title: 'Revenue Acceleration',
      detected: revenueAcceleration,
      confidence: confidenceFromSignal({ detected: revenueAcceleration, signalStrength: revenueSignal }),
      meaning: 'Highlights improving top-line growth velocity across periods.',
    },
    {
      id: 'revenue_deceleration',
      title: 'Revenue Deceleration',
      detected: revenueDeceleration,
      confidence: confidenceFromSignal({ detected: revenueDeceleration, signalStrength: revenueSignal }),
      meaning: 'Highlights weakening top-line growth velocity across periods.',
    },
    {
      id: 'earnings_volatility',
      title: 'Earnings Volatility',
      detected: earningsVolatility,
      confidence: confidenceFromSignal({
        detected: earningsVolatility,
        signalStrength: volatilitySignal,
        hintBoost: hasVolatilityHint ? 0.03 : 0,
      }),
      meaning: 'Detects unstable earnings behavior or volatility patterns.',
    },
    {
      id: 'debt_accumulation',
      title: 'Debt Accumulation',
      detected: debtAccumulation,
      confidence: confidenceFromSignal({ detected: debtAccumulation, signalStrength: debtSignal }),
      meaning: 'Flags leverage build-up that may elevate financing risk.',
    },
    {
      id: 'cash_flow_divergence',
      title: 'Cash Flow Divergence',
      detected: cashFlowDivergence,
      confidence: confidenceFromSignal({ detected: cashFlowDivergence, signalStrength: cashDivergenceSignal }),
      meaning: 'Detects divergence between cash generation and accounting earnings.',
    },
    {
      id: 'asset_growth_surge',
      title: 'Asset Growth Surge',
      detected: assetGrowthSurge,
      confidence: confidenceFromSignal({ detected: assetGrowthSurge, signalStrength: assetSignal }),
      meaning: 'Flags rapid balance-sheet expansion requiring quality review.',
    },
  ];

  return checks;
}

function RadarPanel({ latest }) {
  const axes = [
    {
      label: 'Profitability',
      value:
        typeof latest.net_profit_margin === 'number'
          ? clamp((latest.net_profit_margin + 0.05) / 0.25)
          : 0.2,
    },
    {
      label: 'Liquidity',
      value:
        typeof latest.current_ratio === 'number'
          ? clamp(latest.current_ratio / 2.5)
          : 0.2,
    },
    {
      label: 'Leverage',
      value:
        typeof latest.debt_to_equity === 'number'
          ? clamp(1 - latest.debt_to_equity / 3)
          : 0.2,
    },
    {
      label: 'Cash Quality',
      value:
        typeof latest.cash_flow_to_net_income === 'number'
          ? clamp(latest.cash_flow_to_net_income / 1.5)
          : 0.2,
    },
    {
      label: 'Efficiency',
      value:
        typeof latest.return_on_assets === 'number'
          ? clamp((latest.return_on_assets + 0.02) / 0.15)
          : 0.2,
    },
  ];

  const cx = 110;
  const cy = 105;
  const radius = 72;
  const angleStep = (Math.PI * 2) / axes.length;

  const points = axes.map((axis, index) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const r = radius * axis.value;
    return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
  });

  const grid = [0.25, 0.5, 0.75, 1].map((level) =>
    axes
      .map((_, index) => {
        const angle = -Math.PI / 2 + index * angleStep;
        const r = radius * level;
        return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
      })
      .join(' ')
  );

  return (
    <div className="metric-card" style={{ padding: 14 }}>
      <div className="metric-card-label">Profitability Radar Chart</div>
      <svg viewBox="0 0 220 220" className="w-full mt-2" style={{ maxHeight: 210 }}>
        {grid.map((poly, idx) => (
          <polygon key={idx} points={poly} fill="none" stroke="#e2e8f0" strokeWidth="1" />
        ))}
        {axes.map((axis, index) => {
          const angle = -Math.PI / 2 + index * angleStep;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          const lx = cx + Math.cos(angle) * (radius + 16);
          const ly = cy + Math.sin(angle) * (radius + 16);
          return (
            <g key={axis.label}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={lx} y={ly} textAnchor="middle" fontSize="8" fill="#64748b">{axis.label}</text>
            </g>
          );
        })}
        <polygon points={points.join(' ')} fill="rgba(15, 23, 42, 0.18)" stroke="#0f172a" strokeWidth="2" />
      </svg>
    </div>
  );
}

function GrowthBarsPanel({ growthItems }) {
  const maxAbs = Math.max(
    0.01,
    ...growthItems.map((item) => Math.abs(item.value)),
  );

  return (
    <div className="metric-card" style={{ padding: 14 }}>
      <div className="metric-card-label">Growth Bar Panel</div>
      <div className="mt-3 space-y-2.5">
        {growthItems.length === 0 && (
          <div className="text-[12px] text-slate-500">No YoY growth snapshot available.</div>
        )}
        {growthItems.map((item) => {
          const width = `${Math.max(6, (Math.abs(item.value) / maxAbs) * 100)}%`;
          const positive = item.value >= 0;
          return (
            <div key={item.key}>
              <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                <span>{item.label}</span>
                <span className="font-semibold text-slate-800">{item.display}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width,
                    background: positive ? '#0f766e' : '#b91c1c',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiskGaugePanel({ riskScore, riskLevel }) {
  const safeScore = typeof riskScore === 'number' ? clamp(riskScore / 100, 0, 1) : 0.5;
  const angle = Math.round(safeScore * 180);

  return (
    <div className="metric-card" style={{ padding: 14 }}>
      <div className="metric-card-label">Financial Health Gauge</div>
      <div className="mt-3 flex items-center gap-4">
        <div
          className="relative w-[110px] h-[110px] rounded-full"
          style={{
            background: `conic-gradient(#16a34a 0deg, #eab308 90deg, #dc2626 180deg, #f8fafc 180deg)`,
          }}
        >
          <div
            className="absolute left-1/2 top-1/2 w-[2px] h-[42px] bg-slate-800 origin-bottom"
            style={{
              transform: `translate(-50%, -100%) rotate(${angle - 90}deg)`,
            }}
          />
          <div className="absolute inset-[22px] rounded-full bg-white border border-slate-200" />
        </div>
        <div>
          <div className="text-[12px] text-slate-500">Overall Risk</div>
          <div className="text-[26px] font-bold text-slate-900 leading-none">
            {typeof riskScore === 'number' ? riskScore.toFixed(1) : '—'}
          </div>
          <div className="text-[12px] text-slate-600 mt-1">{toTitleCase(riskLevel || 'moderate')}</div>
        </div>
      </div>
    </div>
  );
}

function CashQualityPanel({ cashFlowToIncome }) {
  const score = typeof cashFlowToIncome === 'number' ? clamp(cashFlowToIncome / 1.2, 0, 1) : 0.5;
  const pct = Math.round(score * 100);

  return (
    <div className="metric-card" style={{ padding: 14 }}>
      <div className="metric-card-label">Cash Quality Indicator</div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] text-slate-500">CFO / Net Income</div>
          <div className="text-[26px] font-bold text-slate-900 leading-none">
            {formatNumber(cashFlowToIncome)}
          </div>
          <div className="text-[11px] text-slate-600 mt-1">
            {pct >= 80
              ? 'High-quality earnings support.'
              : pct >= 60
                ? 'Moderate cash support.'
                : 'Weak cash support versus earnings.'}
          </div>
        </div>
        <div
          className="w-[78px] h-[78px] rounded-full border-4 grid place-items-center text-[14px] font-bold"
          style={{
            borderColor: pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444',
            color: pct >= 80 ? '#166534' : pct >= 60 ? '#92400e' : '#991b1b',
            background: '#f8fafc',
          }}
        >
          {pct}%
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsCards({ analytics, currency = 'LKR' }) {
  const { latestYear, latest, years, byYear } = useMemo(() => extractLatestMetrics(analytics), [analytics]);
  const numeric = useMemo(() => extractAllNumericMetrics(analytics, currency), [analytics, currency]);
  const growthItems = useMemo(() => extractGrowthSnapshot(analytics), [analytics]);
  const riskSignals = useMemo(() => extractRiskSignals(analytics), [analytics]);

  const metricCards = useMemo(() => buildMetricCards(latest, currency), [latest, currency]);
  const executiveSummary = useMemo(
    () => buildExecutiveSummary(latest, analytics?.risk || {}, years, byYear),
    [latest, analytics, years, byYear]
  );
  const interpretationRows = useMemo(() => buildInterpretationRows(years, byYear), [years, byYear]);
  const patternRows = useMemo(() => buildPatternMatrix(analytics, latest, years, byYear), [analytics, latest, years, byYear]);

  const hasData = metricCards.some((card) => typeof card.value === 'number') || numeric.latestNumericMetrics.length > 0;
  if (!hasData) {
    return (
      <div className="card">
        <div className="card-header">Financial Health Summary</div>
        <div className="card-body text-center text-slate-400 py-8 text-[13px] tracking-[-0.01em]">
          Analytics not yet available. Pipeline must complete analytics stage.
        </div>
      </div>
    );
  }

  const overallRiskScore = typeof analytics?.risk?.overall_risk_score === 'number'
    ? analytics.risk.overall_risk_score
    : null;
  const overallRiskLevel = analytics?.risk?.overall_risk_level || analytics?.risk?.risk_rating || 'moderate';

  return (
    <div className="card fade-in">
      <div className="card-header">Financial Health Summary</div>
      <div className="card-body space-y-4">
        <div className="text-[11px] text-slate-500">Display Currency: {currency}</div>
        <section className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">Financial Health Summary</div>
          <div className="text-[12px] text-slate-500 mt-1">
            {latestYear ? `Based on ${latestYear} latest period signals with historical trend context.` : 'Summary based on available analytics signals.'}
          </div>
          <ul className="mt-3 space-y-1.5 text-[12px] text-slate-700">
            {executiveSummary.map((line, idx) => (
              <li key={idx} className="leading-relaxed">- {line}</li>
            ))}
          </ul>
        </section>

        <section>
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 mb-2">Key Signals and What They Mean</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            {metricCards.map((card) => (
              <div key={card.id} className="metric-card">
                <div className="metric-card-label">{card.label}</div>
                <div className="metric-card-value">{card.display}</div>
                <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">{card.interpretation}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="metric-card" style={{ padding: 14 }}>
          <div className="metric-card-label">Interpretation Engine</div>
          <div className="mt-3 space-y-2">
            {interpretationRows.map((row) => {
              const tone = summaryTone(row.trend);
              return (
                <div key={row.key} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12px] font-semibold text-slate-800">{row.label}</div>
                    <span
                      className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full"
                      style={{ background: tone.bg, color: tone.text }}
                    >
                      {row.trend}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">{row.message}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 mb-2">Visual Signal Panels</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <RadarPanel latest={latest} />
            <GrowthBarsPanel growthItems={growthItems} />
            <RiskGaugePanel riskScore={overallRiskScore} riskLevel={overallRiskLevel} />
            <CashQualityPanel cashFlowToIncome={latest.cash_flow_to_net_income} />
          </div>
        </section>

        <section>
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 mb-2">Pattern Detector Matrix</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {patternRows.map((pattern) => (
              <div key={pattern.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[12px] font-semibold text-slate-800">{pattern.title}</div>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase"
                    style={{
                      background: pattern.detected ? '#fef2f2' : '#ecfdf5',
                      color: pattern.detected ? '#991b1b' : '#166534',
                    }}
                  >
                    {pattern.detected ? 'detected' : 'clear'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">{pattern.meaning}</div>
                <div className="mt-2 text-[11px] text-slate-700">
                  Confidence: <span className="font-semibold">{Math.round(pattern.confidence * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <div className="metric-card" style={{ padding: 14 }}>
            <div className="metric-card-label">Latest Period Ratios</div>
            <div className="mt-2 space-y-1.5">
              {[
                ['Gross Profit Margin', latest.gross_profit_margin, 'percent'],
                ['Net Profit Margin', latest.net_profit_margin, 'percent'],
                ['Current Ratio', latest.current_ratio, 'number'],
                ['Debt to Equity', latest.debt_to_equity, 'number'],
                ['ROE', latest.return_on_equity, 'percent'],
                ['ROA', latest.return_on_assets, 'percent'],
              ].map(([label, value, kind]) => (
                <div key={label} className="flex items-center justify-between text-[12px]">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-800">
                    {kind === 'percent' ? formatPercent(value) : formatNumber(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="metric-card" style={{ padding: 14 }}>
            <div className="metric-card-label">Risk Signals</div>
            <div className="mt-2 space-y-1.5">
              {riskSignals.length === 0 && (
                <div className="text-[12px] text-slate-500">No risk signal map available.</div>
              )}
              {riskSignals.map((signal) => (
                <div key={signal.key} className="flex items-center justify-between text-[12px]">
                  <span className="text-slate-500">{signal.label}</span>
                  <span className="font-semibold text-slate-800">
                    {Math.round(signal.score * 100)}% ({toTitleCase(signal.level)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {numeric.latestNumericMetrics.length > 0 && (
          <section className="metric-card" style={{ padding: 14 }}>
            <div className="metric-card-label">
              All Numeric Calculations {numeric.latestYear ? `(Latest: ${numeric.latestYear})` : ''}
            </div>
            <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
              {numeric.latestNumericMetrics.map((item) => (
                <div key={item.key} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
                  <div className="text-[13px] font-semibold text-slate-900 mt-1">{item.display}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {numeric.yearlyTable.length > 0 && (
          <section className="metric-card" style={{ padding: 14 }}>
            <div className="metric-card-label">Year-wise Numeric Matrix</div>
            <div className="mt-3 overflow-x-auto">
              <table className="data-table min-w-[680px]">
                <thead>
                  <tr>
                    <th>Metric</th>
                    {numeric.years.map((year) => (
                      <th key={year} className="text-right">{year}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {numeric.yearlyTable.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      {row.values.map((entry) => (
                        <td key={`${row.key}-${entry.year}`} className="text-right font-semibold text-slate-800">
                          {entry.display}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
