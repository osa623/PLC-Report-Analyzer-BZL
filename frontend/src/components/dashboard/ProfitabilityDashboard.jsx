import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { safeGet, extractYears, CHART_COLORS, formatCurrency, formatLargeNumber, formatPercentage } from '../../utils/formatters';

const ProfitabilityDashboard = ({ data, entity = 'bank' }) => {
  if (!data) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <p className="text-sm text-slate-400 text-center py-8">No profitability data available</p>
      </div>
    );
  }

  const years = extractYears(data).reverse();

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

  const chartData = years.map((y) => {
    const yData = getEntityYear(y);
    const revenue = resolveValue(yData, 'income_statement', ['revenue', 'total_revenue', 'total_operating_income', 'net_interest_income', 'gross_income']);
    const operatingProfit = resolveValue(yData, 'income_statement', ['operating_profit', 'operating_income', 'results_from_operating_activities']);
    const netProfit = resolveValue(yData, 'income_statement', ['net_profit', 'profit_for_the_year', 'profit_after_tax', 'net_income']);

    // NPM Calculation
    const npm = revenue && netProfit ? (netProfit / revenue) * 100 : null;

    return {
      year: y,
      Revenue: revenue,
      'Operating Profit': operatingProfit,
      'Net Profit': netProfit,
      'Net Profit Margin': npm,
    };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm border border-slate-200 p-3 rounded-xl shadow-lg">
          <p className="text-xs font-semibold text-slate-800 mb-1.5">{label}</p>
          <div className="space-y-1.5">
            {payload.map((entry) => {
              const isMargin = entry.name === 'Net Profit Margin';
              return (
                <div key={entry.name} className="flex items-center gap-4 justify-between">
                  <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    {entry.name}
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {entry.value != null
                      ? isMargin
                        ? `${entry.value.toFixed(1)}%`
                        : formatCurrency(entry.value)
                      : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-800 tracking-tight">Income Statement & Margins</h3>
        <p className="text-xs text-slate-500">Visualization of Revenue conversion pipeline and Net Profit Margin expansion/compression.</p>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.indigo} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.indigo} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorOperating" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.sky} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.sky} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="year"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatLargeNumber}
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
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
              <Area
                yAxisId="left"
                name="Revenue"
                type="monotone"
                dataKey="Revenue"
                stroke={CHART_COLORS.indigo}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
              <Area
                yAxisId="left"
                name="Operating Profit"
                type="monotone"
                dataKey="Operating Profit"
                stroke={CHART_COLORS.sky}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorOperating)"
              />
              <Area
                yAxisId="left"
                name="Net Profit"
                type="monotone"
                dataKey="Net Profit"
                stroke={CHART_COLORS.emerald}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorNet)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ProfitabilityDashboard;
