import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line } from 'recharts';
import { safeGet, extractYears, CHART_COLORS, formatCurrency, formatLargeNumber } from '../../utils/formatters';

const CashFlowDashboard = ({ data, entity = 'bank' }) => {
  if (!data) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <p className="text-sm text-slate-400 text-center py-8">No cash flow data available</p>
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
    const ocf = resolveValue(yData, 'cash_flow', ['operating_cash_flow', 'cash_flows_from_operating_activities']);
    const icf = resolveValue(yData, 'cash_flow', ['investing_cash_flow', 'cash_flows_from_investing_activities']);
    const fcf = resolveValue(yData, 'cash_flow', ['financing_cash_flow', 'cash_flows_from_financing_activities']);
    const net = resolveValue(yData, 'cash_flow', ['net_cash_flow', 'increase_decrease_in_cash']);

    return {
      year: y,
      'Operating Cash Flow': ocf,
      'Investing Cash Flow': icf,
      'Financing Cash Flow': fcf,
      'Net Cash Movement': net,
    };
  });

  const latestYear = years[years.length - 1];
  const latestData = chartData.find((d) => d.year === latestYear) || {};

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
                <span className={`text-xs font-bold ${entry.value < 0 ? 'text-red-500' : 'text-slate-900'}`}>
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
        <h3 className="text-base font-semibold text-slate-800 tracking-tight">Cash Flow Analysis</h3>
        <p className="text-xs text-slate-500">Breakdown of cash generation across Operations, Investments, and Debt/Equity financing.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Card Summaries for Latest Year */}
        {[
          { title: 'Operating Cash Flow', val: latestData['Operating Cash Flow'], color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
          { title: 'Investing Cash Flow', val: latestData['Investing Cash Flow'], color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { title: 'Financing Cash Flow', val: latestData['Financing Cash Flow'], color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
          { title: 'Net Cash Movement', val: latestData['Net Cash Movement'], color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
        ].map((item) => (
          <div key={item.title} className={`border rounded-xl p-4 ${item.bg} hover:shadow-md transition-all duration-300`}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">{item.title} ({latestYear})</span>
            <span className={`text-lg font-bold block mt-1.5 ${item.color}`}>
              {formatCurrency(item.val)}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
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
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span className="text-xs text-slate-500 font-medium ml-1">{value}</span>}
              />
              <Bar dataKey="Operating Cash Flow" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar dataKey="Investing Cash Flow" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar dataKey="Financing Cash Flow" fill={CHART_COLORS.rose} radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Line
                name="Net Cash Movement"
                type="monotone"
                dataKey="Net Cash Movement"
                stroke={CHART_COLORS.emerald}
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#fff', strokeWidth: 1.5 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default CashFlowDashboard;
