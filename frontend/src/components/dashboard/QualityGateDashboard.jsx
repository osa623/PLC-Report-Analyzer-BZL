import React, { useState } from 'react';
import { safeGet, extractYears, getStatusColor, getStatusBg } from '../../utils/formatters';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const GateCard = ({ name, title, gateData }) => {
  if (!gateData) return null;

  const { status, difference, reason, missing_fields, jumps, invalid_fields, completeness_score } = gateData;
  const isPass = status === 'PASS' || status === 'NOT_APPLICABLE';
  const isWarning = status === 'WARNING' || (status === 'FAILED' && name === 'multi_year_continuity');
  const isFail = status === 'FAILED' && !isWarning;

  let icon = <CheckCircleIcon className="w-5 h-5 text-emerald-500" />;
  let cardClass = 'border-emerald-100 bg-emerald-50/10';
  let badgeText = 'Pass';
  let badgeClass = 'bg-emerald-50 text-emerald-700';

  if (isFail) {
    icon = <XCircleIcon className="w-5 h-5 text-red-500" />;
    cardClass = 'border-red-100 bg-red-50/10';
    badgeText = 'Failed';
    badgeClass = 'bg-red-50 text-red-700';
  } else if (isWarning) {
    icon = <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />;
    cardClass = 'border-amber-100 bg-amber-50/10';
    badgeText = 'Warning';
    badgeClass = 'bg-amber-50 text-amber-700';
  } else if (status === 'NOT_APPLICABLE') {
    icon = <InformationCircleIcon className="w-5 h-5 text-slate-400" />;
    cardClass = 'border-slate-100 bg-slate-50/20';
    badgeText = 'N/A';
    badgeClass = 'bg-slate-50 text-slate-400';
  }

  return (
    <div className={`border rounded-xl p-4 transition-all duration-300 hover:shadow-sm ${cardClass} flex flex-col justify-between`}>
      <div>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs font-semibold text-slate-700 capitalize">{title}</span>
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
            {badgeText}
          </span>
        </div>

        {/* Detailed context on failures */}
        {!isPass && (
          <div className="space-y-1.5 text-[11px] text-slate-600 leading-normal pl-7">
            {difference != null && (
              <p>Discrepancy: <span className="font-bold text-red-600">{(difference * 100).toFixed(3)}%</span></p>
            )}
            {reason && <p className="text-slate-500 font-medium">{reason}</p>}
            {missing_fields && missing_fields.length > 0 && (
              <div>
                <p className="text-red-500/80 font-medium">Missing mapped inputs:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {missing_fields.map((f) => (
                    <span key={f} className="text-[9px] bg-red-50 text-red-600 font-mono px-1 py-0.2 rounded">{f}</span>
                  ))}
                </div>
              </div>
            )}
            {jumps && jumps.length > 0 && (
              <div>
                <p className="text-amber-600 font-medium">Extreme multi-year fluctuation:</p>
                <div className="space-y-1 mt-1 font-mono text-[10px]">
                  {jumps.map((j) => (
                    <div key={j.field} className="flex justify-between border-b border-slate-100 pb-0.5">
                      <span className="text-slate-500">{j.field}:</span>
                      <span className="font-bold text-amber-600">+{Math.round(j.change * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {invalid_fields && invalid_fields.length > 0 && (
              <div>
                <p className="text-red-500/80 font-medium">Malformed data types in:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {invalid_fields.map((f) => (
                    <span key={f} className="text-[9px] bg-red-50 text-red-600 font-mono px-1 py-0.2 rounded">{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {isPass && (
          <div className="text-[11px] text-slate-400 pl-7 leading-relaxed">
            {name === 'balance_sheet_identity' && <p>Total Assets align correctly with Liabilities + Equity.</p>}
            {name === 'cash_flow_reconciliation' && <p>Opening Cash + Net Cash Flow reconciles with Closing Cash.</p>}
            {name === 'multi_year_continuity' && <p>Continuous multi-year trend patterns within nominal boundaries.</p>}
            {name === 'completeness_validation' && (
              <p>Statement mapped variables completeness check passed at <span className="font-bold text-emerald-600">{completeness_score}%</span>.</p>
            )}
            {name === 'numeric_integrity' && <p>All processed entries successfully validated as valid floating-point numbers.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

const QualityGateDashboard = ({ data, entity = 'bank' }) => {
  const years = extractYears(data);
  const [selectedYear, setSelectedYear] = useState(years[0] || '');

  if (!data || years.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <p className="text-sm text-slate-400 text-center py-8">No quality gate records available</p>
      </div>
    );
  }

  const gates = safeGet(data, `validation_results.${entity}.${selectedYear}`, {});

  const gatesConfig = [
    { name: 'balance_sheet_identity', title: 'Balance Sheet Balance check' },
    { name: 'cash_flow_reconciliation', title: 'Cash Flow Reconciliation check' },
    { name: 'multi_year_continuity', title: 'Multi-Year Trend Continuity check' },
    { name: 'completeness_validation', title: 'Completeness check' },
    { name: 'numeric_integrity', title: 'Numeric Type Integrity check' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800 tracking-tight">Statement Quality Control Gates</h3>
          <p className="text-xs text-slate-500">Automated financial data integrity audit suite and consistency validation status.</p>
        </div>

        {/* Year Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Analysis Year:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {gatesConfig.map((g) => (
          <GateCard
            key={g.name}
            name={g.name}
            title={g.title}
            gateData={gates[g.name]}
          />
        ))}
      </div>
    </div>
  );
};

export default QualityGateDashboard;
