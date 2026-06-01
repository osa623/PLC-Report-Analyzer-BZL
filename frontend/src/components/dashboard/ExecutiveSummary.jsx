import React from 'react';
import { safeGet, formatPercentage, extractYears } from '../../utils/formatters';
import { ShieldCheckIcon, ChartBarIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const ScoreGauge = ({ label, value, icon: Icon }) => {
  const pct = value != null && Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : null;
  const color = pct == null ? 'slate' : pct >= 70 ? 'emerald' : pct >= 40 ? 'amber' : 'red';
  const colorMap = {
    emerald: { ring: 'border-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
    amber: { ring: 'border-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
    red: { ring: 'border-red-400', bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
    slate: { ring: 'border-slate-200', bg: 'bg-slate-50', text: 'text-slate-400', badge: 'bg-slate-100 text-slate-400' },
  };
  const c = colorMap[color];

  return (
    <div className={`flex flex-col items-center p-4 rounded-xl ${c.bg} border ${c.ring} border-opacity-50 transition-all duration-300 hover:shadow-md`}>
      <div className={`w-14 h-14 rounded-full border-4 ${c.ring} flex items-center justify-center mb-2 ${c.bg}`}>
        {pct != null ? (
          <span className={`text-lg font-bold ${c.text}`}>{pct}</span>
        ) : (
          <span className="text-sm text-slate-300">—</span>
        )}
      </div>
      <div className="flex items-center gap-1 mb-1">
        {Icon && <Icon className={`w-3.5 h-3.5 ${c.text}`} />}
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>
        {pct != null ? `${pct}%` : 'N/A'}
      </span>
    </div>
  );
};

const ExecutiveSummary = ({ data }) => {
  if (!data) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <p className="text-sm text-slate-400 text-center py-8">No data available</p>
      </div>
    );
  }

  const companyName = safeGet(data, 'extraction.company_name') || safeGet(data, 'extraction.company') || 'Unknown Company';
  const sector = safeGet(data, 'sector_classification.detected_sector') || 'Diversified';
  const years = extractYears(data);
  const confidence = safeGet(data, 'confidence_scores.overall_confidence') ?? safeGet(data, 'confidence_scores.analysis_confidence');
  const reliability = safeGet(data, 'reliability_scores.overall_reliability') ?? safeGet(data, 'reliability_scores.data_reliability');
  const completeness = safeGet(data, 'completeness_metrics.overall_completeness') ?? safeGet(data, 'completeness_metrics.data_completeness');
  const riskScore = safeGet(data, 'risk_scores.overall_risk') ?? safeGet(data, 'risk_scores.composite_risk');

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">{companyName}</h2>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">{sector}</span>
            <span className="text-xs text-slate-400">
              {years.length > 0 ? `${years[years.length - 1]} — ${years[0]}` : 'No years detected'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">Report Years</span>
          <div className="flex gap-1 mt-1">
            {years.map((y) => (
              <span key={y} className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{y}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <ScoreGauge label="Confidence" value={confidence} icon={ShieldCheckIcon} />
        <ScoreGauge label="Reliability" value={reliability} icon={ChartBarIcon} />
        <ScoreGauge label="Completeness" value={completeness} icon={ChartBarIcon} />
        <ScoreGauge label="Risk" value={riskScore} icon={ExclamationTriangleIcon} />
      </div>
    </div>
  );
};

export default ExecutiveSummary;
