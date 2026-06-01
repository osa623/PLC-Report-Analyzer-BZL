import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { safeGet, extractYears, CHART_COLORS, formatPercentage } from '../../utils/formatters';

const TrendAnalysisCharts = ({ data, entity = 'bank' }) => {
  const [selectedMetric, setSelectedMetric] = useState('All');

  if (!data) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <p className="text-sm text-slate-400 text-center py-8">No data available for trend charts</p>
      </div>
    );
  }

  const years = extractYears(data).reverse(); // Oldest to newest for proper timeline plotting

  // Format data for Recharts
  const chartData = years.map((y) => {
    const growth = safeGet(data, `growth_analysis.${entity}.${y}`, {});
    const revObj = growth['Revenue Growth'] || {};
    const profObj = growth['Net Profit Growth'] || {};
    const assetObj = growth['Asset Growth'] || {};
    const eqObj = growth['Equity Growth'] || {};

    return {
      year: y,
      'Revenue Growth': revObj.status === 'OK' ? Number(revObj.value) * 100 : null,
      'Net Profit Growth': profObj.status === 'OK' ? Number(profObj.value) * 100 : null,
      'Asset Growth': assetObj.status === 'OK' ? Number(assetObj.value) * 100 : null,
      'Equity Growth': eqObj.status === 'OK' ? Number(eqObj.value) * 100 : null,
    };
  });

  const metricsConfig = [
    { key: 'Revenue Growth', label: 'Revenue Growth', color: CHART_COLORS.indigo },
    { key: 'Net Profit Growth', label: 'Profit Growth', color: CHART_COLORS.emerald },
    { key: 'Asset Growth', label: 'Asset Growth', color: CHART_COLORS.sky },
    { key: 'Equity Growth', label: 'Equity Growth', color: CHART_COLORS.violet },
  ];

  const getFilteredMetrics = () => {
    if (selectedMetric === 'All') return metricsConfig;
    return metricsConfig.filter((m) => m.key === selectedMetric);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm border border-slate-200 p-3 rounded-xl shadow-lg">
          <p className="text-xs font-semibold text-slate-800 mb-1.5">{label}</p>
          <div className="space-y-1">
            {payload.map((entry) => (
              <div key={entry.name} className="flex items-center gap-4 justify-between">
                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  {entry.name}
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {entry.value != null ? `${entry.value.toFixed(1)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800 tracking-tight">Growth Trend Analysis</h3>
          <p className="text-xs text-slate-500">Year-over-year rate of change across key financial structures.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl max-w-fit">
          <button
            onClick={() => setSelectedMetric('All')}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 ${
              selectedMetric === 'All'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Metrics
          </button>
          {metricsConfig.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedMetric(m.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 ${
                selectedMetric === m.key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="year"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span className="text-xs text-slate-500 font-medium ml-1">{value}</span>}
              />
              {getFilteredMetrics().map((m) => (
                <Line
                  key={m.key}
                  name={m.key}
                  type="monotone"
                  dataKey={m.key}
                  stroke={m.color}
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 1.5, fill: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default TrendAnalysisCharts;
