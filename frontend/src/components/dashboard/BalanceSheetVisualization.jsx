import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { safeGet, extractYears, CHART_COLORS, formatCurrency, formatLargeNumber } from '../../utils/formatters';

const BalanceSheetVisualization = ({ data, entity = 'bank' }) => {
  if (!data) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <p className="text-sm text-slate-400 text-center py-8">No balance sheet data available</p>
      </div>
    );
  }

  const years = extractYears(data).reverse(); // Oldest to newest for proper timeline progression

  const getEntityYear = (year) => {
    const entityKey = entity === 'group' ? 'group_analysis' : 'bank_analysis';
    let result = safeGet(data, `${entityKey}.years.${year}`, null);
    if (!result) {
      const extraction = safeGet(data, 'extraction', {});
      const yearData = (extraction.years || extraction.financial_graph || {})[year];
      if (yearData) result = yearData;
    }
    return result || {};
  };

  const resolveValue = (yearData, section, fields) => {
    const sec = yearData[section] || yearData?.mapping_results?.[section] || {};
    for (const f of fields) {
      const val = sec[f];
      if (val != null && Number.isFinite(Number(val))) return Number(val);
      const mapped = yearData?.mapping_diagnostics?.fields_mapped || {};
      if (mapped[f]?.value != null) return Number(mapped[f].value);
      const standardized = yearData?.standardized_fields || {};
      if (standardized[f] != null) return Number(standardized[f]);
    }
    return null;
  };

  // Build structure for stacked bar charts
  const chartData = years.map((y) => {
    const yData = getEntityYear(y);
    const assets = resolveValue(yData, 'balance_sheet', ['total_assets', 'assets_total']);
    const liabilities = resolveValue(yData, 'balance_sheet', ['total_liabilities', 'liabilities_total']);
    const equity = resolveValue(yData, 'balance_sheet', ['total_equity', 'shareholders_equity', 'shareholders_funds', 'equity']);

    return {
      year: y,
      Assets: assets,
      Liabilities: liabilities,
      Equity: equity,
      // Total L&E for check
      'Liabilities & Equity': (liabilities || 0) + (equity || 0),
    };
  });

  // Get composition of latest year for donut chart
  const latestYear = years[years.length - 1];
  const latestData = chartData.find((d) => d.year === latestYear) || {};
  const compositionData = [
    { name: 'Liabilities', value: latestData.Liabilities || 0, color: CHART_COLORS.amber },
    { name: 'Equity', value: latestData.Equity || 0, color: CHART_COLORS.indigo },
  ];

  const totalCap = compositionData.reduce((acc, curr) => acc + curr.value, 0);

  const CustomTooltipBar = ({ active, payload, label }) => {
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
                  {entry.value != null ? formatCurrency(entry.value) : '—'}
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
      <div>
        <h3 className="text-base font-semibold text-slate-800 tracking-tight">Balance Sheet Structure</h3>
        <p className="text-xs text-slate-500">Double-entry accounting comparison: Assets vs. Liabilities & Shareholders' Equity.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-700">Assets vs. Liabilities & Equity Trend</span>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  tickFormatter={formatLargeNumber}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                />
                <Tooltip content={<CustomTooltipBar />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs text-slate-500 font-medium ml-1">{value}</span>}
                />
                <Bar dataKey="Assets" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} maxBarSize={45} />
                <Bar dataKey="Liabilities" stackId="le" fill={CHART_COLORS.amber} maxBarSize={45} />
                <Bar dataKey="Equity" stackId="le" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} maxBarSize={45} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Latest Capital Structure Donut Chart */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-700">Capital Structure ({latestYear})</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Ratio of liabilities to total shareholder funds.</p>
          </div>

          <div className="relative h-[180px] flex items-center justify-center">
            {totalCap > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={compositionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {compositionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Donut Center */}
                <div className="absolute text-center">
                  <span className="text-[10px] text-slate-400 font-medium block">Total Funding</span>
                  <span className="text-sm font-bold text-slate-800">{formatLargeNumber(totalCap)}</span>
                </div>
              </>
            ) : (
              <span className="text-xs text-slate-300">No composition data</span>
            )}
          </div>

          <div className="space-y-2 mt-4">
            {compositionData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs border-b border-slate-50 pb-1.5">
                <span className="flex items-center gap-2 text-slate-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <div className="text-right">
                  <span className="font-bold text-slate-800 block">{formatCurrency(d.value)}</span>
                  <span className="text-[9px] font-semibold text-slate-400">
                    {totalCap > 0 ? ((d.value / totalCap) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceSheetVisualization;
