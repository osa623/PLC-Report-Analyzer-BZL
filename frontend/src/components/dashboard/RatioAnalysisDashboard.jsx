import React, { useState } from 'react';
import { safeGet, formatRatioPercent, formatPercentage, formatCurrency, getTrendDirection, getTrendChange, extractYears } from '../../utils/formatters';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, MinusIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const RatioCard = ({ name, ratioData, prevRatioData }) => {
  if (!ratioData) return null;

  const { status, value, source_fields, diagnostics } = ratioData;
  const prevValue = prevRatioData?.status === 'OK' ? prevRatioData.value : null;

  // Formatting value
  const isPercentageRatio = ['ROA', 'ROE', 'Net Profit Margin', 'Operating Margin', 'Gross Margin', 'OCF Ratio', 'Loan To Deposit Ratio'].includes(name);
  const isCurrency = name === 'Free Cash Flow';

  const formatVal = (val) => {
    if (val == null) return '—';
    if (isPercentageRatio) return formatPercentage(val, 2);
    if (isCurrency) return formatCurrency(val);
    return Number(val).toFixed(2);
  };

  // Determine health status of ratio
  let health = 'neutral';
  let badgeColor = 'bg-slate-100 text-slate-600 border-slate-200';
  let badgeText = 'Unknown';

  if (status === 'OK' && value != null) {
    if (name === 'ROA') {
      if (value >= 0.015) { health = 'healthy'; badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100'; badgeText = 'Healthy'; }
      else if (value >= 0.005) { health = 'warning'; badgeColor = 'bg-amber-50 text-amber-700 border-amber-100'; badgeText = 'Moderate'; }
      else { health = 'critical'; badgeColor = 'bg-red-50 text-red-700 border-red-100'; badgeText = 'Critical'; }
    } else if (name === 'ROE') {
      if (value >= 0.12) { health = 'healthy'; badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100'; badgeText = 'Healthy'; }
      else if (value >= 0.05) { health = 'warning'; badgeColor = 'bg-amber-50 text-amber-700 border-amber-100'; badgeText = 'Moderate'; }
      else { health = 'critical'; badgeColor = 'bg-red-50 text-red-700 border-red-100'; badgeText = 'Critical'; }
    } else if (name === 'Current Ratio') {
      if (value >= 1.5 && value <= 3.0) { health = 'healthy'; badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100'; badgeText = 'Healthy'; }
      else if (value >= 1.0) { health = 'warning'; badgeColor = 'bg-amber-50 text-amber-700 border-amber-100'; badgeText = 'Moderate'; }
      else { health = 'critical'; badgeColor = 'bg-red-50 text-red-700 border-red-100'; badgeText = 'Critical'; }
    } else if (name === 'Debt To Equity') {
      if (value <= 1.5) { health = 'healthy'; badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100'; badgeText = 'Healthy'; }
      else if (value <= 3.0) { health = 'warning'; badgeColor = 'bg-amber-50 text-amber-700 border-amber-100'; badgeText = 'Elevated'; }
      else { health = 'critical'; badgeColor = 'bg-red-50 text-red-700 border-red-100'; badgeText = 'Critical'; }
    } else {
      health = 'healthy';
      badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
      badgeText = 'Passed';
    }
  } else if (status === 'NOT_APPLICABLE') {
    badgeColor = 'bg-slate-50 text-slate-400 border-slate-100';
    badgeText = 'N/A';
  } else {
    badgeColor = 'bg-red-50 text-red-500 border-red-100';
    badgeText = 'Failed';
  }

  const dir = getTrendDirection(value, prevValue);
  const change = getTrendChange(value, prevValue);

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-4 hover:shadow-md transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{name}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
            {badgeText}
          </span>
        </div>

        {status === 'OK' && value != null ? (
          <div className="mt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900 tracking-tight">{formatVal(value)}</span>
              {prevValue != null && (
                <span className={`flex items-center text-[10px] font-semibold ${dir === 'up' ? 'text-emerald-600' : dir === 'down' ? 'text-red-500' : 'text-slate-400'}`}>
                  {dir === 'up' && <ArrowTrendingUpIcon className="w-3 h-3 mr-0.5" />}
                  {dir === 'down' && <ArrowTrendingDownIcon className="w-3 h-3 mr-0.5" />}
                  {dir === 'flat' && <MinusIcon className="w-3 h-3 mr-0.5" />}
                  {change != null ? `${Math.abs(change).toFixed(1)}%` : '0.0%'}
                </span>
              )}
            </div>
            {prevValue != null && (
              <span className="text-[10px] text-slate-400 block mt-0.5">Prior: {formatVal(prevValue)}</span>
            )}
          </div>
        ) : (
          <div className="py-2">
            <span className="text-sm font-medium text-slate-400">
              {status === 'NOT_APPLICABLE' ? 'Not applicable for this sector' : 'Analysis failed'}
            </span>
            {diagnostics?.reason && (
              <span className="text-[10px] text-red-400 block mt-1 leading-tight">{diagnostics.reason}</span>
            )}
          </div>
        )}
      </div>

      {source_fields && source_fields.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap gap-1 items-center">
          <InformationCircleIcon className="w-3 h-3 text-slate-400" />
          <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Inputs:</span>
          {source_fields.map((f) => (
            <span key={f} className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-mono">
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const RatioAnalysisDashboard = ({ data, entity = 'bank' }) => {
  const [activeCategory, setActiveCategory] = useState('All');
  if (!data) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <p className="text-sm text-slate-400 text-center py-8">No ratio data available</p>
      </div>
    );
  }

  const years = extractYears(data);
  const latestYear = years[0];
  const previousYear = years[1];

  const getRatiosForYear = (year) => {
    return safeGet(data, `ratio_analysis.${entity}.${year}`, {});
  };

  const latestRatios = getRatiosForYear(latestYear);
  const previousRatios = previousYear ? getRatiosForYear(previousYear) : {};

  // Group ratios logically
  const categories = {
    'Profitability': ['ROA', 'ROE', 'Net Profit Margin', 'Operating Margin', 'Gross Margin'],
    'Liquidity': ['Current Ratio', 'Quick Ratio', 'Cash Ratio', 'OCF Ratio'],
    'Solvency / Leverage': ['Debt To Equity', 'Debt Ratio', 'Cash Flow to Net Income', 'Free Cash Flow'],
    'Sector-Specific / Other': ['Asset Turnover', 'Loan To Deposit Ratio']
  };

  const allRatioNames = Object.keys(latestRatios).length > 0
    ? Object.keys(latestRatios)
    : ['ROA', 'ROE', 'Debt To Equity', 'Debt Ratio', 'Net Profit Margin', 'Operating Margin', 'Gross Margin', 'Current Ratio', 'Quick Ratio', 'Cash Ratio', 'Asset Turnover', 'Cash Flow to Net Income', 'OCF Ratio', 'Free Cash Flow', 'Loan To Deposit Ratio'];

  const getFilteredRatios = () => {
    if (activeCategory === 'All') return allRatioNames;
    return categories[activeCategory] || [];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800 tracking-tight">Financial Ratio Analysis</h3>
          <p className="text-xs text-slate-500">Key metrics on business health, profitability, and operational efficiency.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl max-w-fit">
          {['All', ...Object.keys(categories)].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 ${
                activeCategory === cat
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {getFilteredRatios().map((name) => (
          <RatioCard
            key={name}
            name={name}
            ratioData={latestRatios[name]}
            prevRatioData={previousRatios[name]}
          />
        ))}
      </div>
    </div>
  );
};

export default RatioAnalysisDashboard;
