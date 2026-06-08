import React from 'react';
import { safeGet, formatCurrency, getTrendDirection, getTrendChange, extractYears } from '../../utils/formatters';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, MinusIcon } from '@heroicons/react/24/outline';

const TrendBadge = ({ current, previous }) => {
  const dir = getTrendDirection(current, previous);
  const change = getTrendChange(current, previous);
  if (dir === 'flat' || change == null) return <MinusIcon className="w-4 h-4 text-slate-300" />;
  const isUp = dir === 'up';
  return (
    <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
      {isUp ? <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> : <ArrowTrendingDownIcon className="w-3.5 h-3.5" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
};

const KpiCard = ({ label, value, previousValue, currency = 'LKR' }) => (
  <div className="bg-white border border-slate-200/80 rounded-xl p-4 hover:shadow-md transition-all duration-300">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{label}</span>
      <TrendBadge current={value} previous={previousValue} />
    </div>
    <p className="text-lg font-bold text-slate-900 tracking-tight">
      {formatCurrency(value, currency)}
    </p>
    {previousValue != null && (
      <p className="text-[10px] text-slate-400 mt-1">Prior: {formatCurrency(previousValue, currency)}</p>
    )}
  </div>
);

const FinancialHealthOverview = ({ data, entity = 'bank' }) => {
  if (!data) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <p className="text-sm text-slate-400 text-center py-8">No financial data available</p>
      </div>
    );
  }

  const years = extractYears(data);
  const latestYear = years[0];
  const previousYear = years[1];

  const getEntityYear = (year) => {
    const entityKey = entity === 'group' ? 'group_analysis' : 'bank_analysis';
    let result = safeGet(data, `${entityKey}.${year}`, null);
    if (!result) {
      const extraction = safeGet(data, 'extraction', {});
      const yearData = (extraction.years || extraction.financial_graph || {})[year];
      if (yearData) result = yearData;
    }
    return result || {};
  };

  const resolveField = (yearData, section, fields) => {
    const sec = yearData[section] || yearData?.mapping_results?.[section] || {};
    for (const f of fields) {
      const val = sec[f];
      if (val != null && Number.isFinite(Number(val))) return Number(val);
      // Check inside ratio results or mapped fields
      const mapped = yearData?.mapping_diagnostics?.fields_mapped || {};
      if (mapped[f]?.value != null) return Number(mapped[f].value);
    }
    return null;
  };

  const latest = getEntityYear(latestYear);
  const previous = previousYear ? getEntityYear(previousYear) : {};

  const metrics = [
    { label: 'Total Assets', section: 'balance_sheet', fields: ['total_assets', 'assets_total'] },
    { label: 'Total Liabilities', section: 'balance_sheet', fields: ['total_liabilities', 'liabilities_total'] },
    { label: 'Total Equity', section: 'balance_sheet', fields: ['total_equity', 'shareholders_equity', 'shareholders_funds'] },
    { label: 'Revenue', section: 'income_statement', fields: ['revenue', 'total_revenue', 'total_operating_income', 'net_interest_income', 'gross_income'] },
    { label: 'Net Profit', section: 'income_statement', fields: ['net_profit', 'profit_for_the_year', 'profit_after_tax', 'net_income'] },
    { label: 'Cash Position', section: 'balance_sheet', fields: ['cash_and_cash_equivalents', 'cash_and_short_term_funds'] },
  ];

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Financial Health Overview</h3>
          <p className="text-xs text-slate-400 mt-0.5">{latestYear || 'Latest'} vs {previousYear || 'Prior'}</p>
        </div>
        {latestYear && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">{latestYear}</span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map(({ label, section, fields }) => (
          <KpiCard
            key={label}
            label={label}
            value={resolveField(latest, section, fields)}
            previousValue={resolveField(previous, section, fields)}
          />
        ))}
      </div>
    </div>
  );
};

export default FinancialHealthOverview;
