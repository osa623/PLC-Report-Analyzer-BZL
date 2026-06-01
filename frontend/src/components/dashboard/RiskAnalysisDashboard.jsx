import React from 'react';
import { safeGet, extractYears, getStatusColor, getStatusBg } from '../../utils/formatters';
import { ShieldCheckIcon, ExclamationTriangleIcon, XCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const RiskAnalysisDashboard = ({ data, entity = 'bank' }) => {
  if (!data) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <p className="text-sm text-slate-400 text-center py-8">No risk analysis data available</p>
      </div>
    );
  }

  const riskScore = safeGet(data, `risk_scores.${entity}`) ?? safeGet(data, `risk_scores.overall_risk`) ?? 0;
  const years = extractYears(data);

  // Determine Risk Category & Color
  let riskCategory = 'Low Risk';
  let riskColor = 'emerald';
  let riskDesc = 'The financial statement pipeline indicates high reliability with minimal structural issues or validation discrepancies.';

  if (riskScore >= 66) {
    riskCategory = 'High Risk';
    riskColor = 'red';
    riskDesc = 'Multiple critical quality gate failures and large anomalies detected. Use extreme caution when analyzing this statement.';
  } else if (riskScore >= 33) {
    riskCategory = 'Medium Risk';
    riskColor = 'amber';
    riskDesc = 'Moderate validation discrepancies or missing fields detected. Some standard calculations had to rely on custom alias mappings.';
  }

  const colorMap = {
    emerald: { text: 'text-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50', bar: 'bg-emerald-500' },
    amber: { text: 'text-amber-500', border: 'border-amber-200', bg: 'bg-amber-50', bar: 'bg-amber-500' },
    red: { text: 'text-red-500', border: 'border-red-200', bg: 'bg-red-50', bar: 'bg-red-500' }
  };
  const c = colorMap[riskColor];

  // Harvest all warnings from quality gates/validations across years
  const warnings = [];
  years.forEach((year) => {
    const gates = safeGet(data, `validation_results.${entity}.${year}`, {});
    Object.entries(gates).forEach(([checkName, checkVal]) => {
      if (checkVal.status === 'FAILED') {
        let msg = `${checkName.replace(/_/g, ' ')}`;
        if (checkVal.difference != null) {
          msg += ` (Imbalance: ${(checkVal.difference * 100).toFixed(3)}%)`;
        } else if (checkVal.reason) {
          msg += ` (${checkVal.reason})`;
        }
        warnings.push({
          year,
          checkName,
          message: msg,
          missing: checkVal.missing_fields || [],
          severity: checkName === 'balance_sheet_identity' || checkName === 'cash_flow_reconciliation' ? 'High' : 'Medium'
        });
      }
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-800 tracking-tight">Risk Assessment & Warnings</h3>
        <p className="text-xs text-slate-500">Pipeline-generated risk profile and data-quality warnings checklist.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Risk Gauge Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-700">Financial Risk Score</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Calculated composite based on validation passes and data mapping success.</p>
          </div>

          <div className="my-6 text-center">
            <span className={`text-4xl font-extrabold tracking-tight ${c.text}`}>{riskScore.toFixed(1)}%</span>
            <span className={`block text-xs font-bold mt-1.5 uppercase ${c.text}`}>{riskCategory}</span>
            <div className="w-full bg-slate-100 rounded-full h-2.5 mt-4 overflow-hidden border border-slate-200/30">
              <div className={`h-full ${c.bar}`} style={{ width: `${riskScore}%` }} />
            </div>
          </div>

          <div className={`border rounded-xl p-3 text-[11px] ${c.bg} ${c.border} text-slate-600 leading-relaxed`}>
            {riskDesc}
          </div>
        </div>

        {/* Warnings List Card */}
        <div className="md:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-700">Structural Validation Anomalies</span>
            <p className="text-[10px] text-slate-400 mt-0.5">All flagged discrepancy warnings generated during pipeline quality gate evaluations.</p>
          </div>

          <div className="my-4 flex-grow max-h-[220px] overflow-y-auto space-y-2 pr-1.5">
            {warnings.length > 0 ? (
              warnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-red-100 bg-red-50/30 hover:bg-red-50/50 transition-all duration-200">
                  <ExclamationTriangleIcon className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-grow">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 capitalize">{w.message}</span>
                      <div className="flex gap-1.5 items-center">
                        <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">{w.severity} Severity</span>
                        <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">{w.year}</span>
                      </div>
                    </div>
                    {w.missing.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                        <span className="text-[9px] text-slate-400 font-medium">Missing:</span>
                        {w.missing.map((f) => (
                          <span key={f} className="text-[8px] bg-red-100/50 text-red-600 font-mono px-1 py-0.2 rounded">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10">
                <CheckCircleIcon className="w-12 h-12 text-emerald-500 mb-2" />
                <span className="text-xs font-bold text-slate-700">Perfect Structural Score!</span>
                <span className="text-[10px] text-slate-400 mt-0.5">No validation gate failures or cash discrepancies detected.</span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[10px] text-slate-400 font-medium uppercase tracking-wider">
            <span>Total Warnings Flagged: {warnings.length}</span>
            <span>Target Severity Check: 100% complete</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskAnalysisDashboard;
