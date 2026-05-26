import React from 'react';
import { AlertTriangle, XCircle, AlertCircle, Info } from 'lucide-react';

function categorizeError(err) {
  if (typeof err === 'string' || (err && typeof err === 'object')) {
    const raw = typeof err === 'string'
      ? err
      : `${err.code || 'validation_issue'}: ${err.message || 'Validation issue'}`;
    const normalized = raw.trim();

    if (normalized.startsWith('BALANCE_SHEET_IDENTITY_FAILED')) {
      return { type: 'error', icon: XCircle, text: 'Balance Sheet Identity Failed', detail: 'Assets must equal liabilities plus equity.' };
    }
    if (normalized.startsWith('CASH_RECONCILIATION_FAILED')) {
      return { type: 'error', icon: XCircle, text: 'Cash Reconciliation Failed', detail: 'Opening cash + net cash flow does not equal closing cash.' };
    }
    if (normalized.startsWith('NET_INCOME_LINKAGE_FAILED')) {
      return { type: 'error', icon: AlertTriangle, text: 'Net Income Linkage Failed', detail: 'Net income is inconsistent across income statement, cash flow, and equity.' };
    }
    if (normalized.includes('balance_mismatch')) return { type: 'error', icon: XCircle, text: 'Balance Sheet Mismatch', detail: normalized };
    if (normalized.includes('revenue_lt_net_profit')) return { type: 'error', icon: AlertTriangle, text: 'Revenue less than Net Profit', detail: normalized };
    if (normalized.includes('missing')) return { type: 'warning', icon: AlertCircle, text: 'Missing Critical Values', detail: normalized };
    return { type: 'warning', icon: AlertCircle, text: normalized, detail: '' };
  }
  return { type: 'info', icon: Info, text: JSON.stringify(err), detail: '' };
}

export default function ErrorsPanel({ errors }) {
  if (!errors) {
    return (
      <div className="card">
        <div className="card-header">Errors & Warnings</div>
        <div className="card-body text-center text-slate-400 py-8 text-[13px] tracking-[-0.01em]">
          No error data available yet.
        </div>
      </div>
    );
  }

  const errorCatalog = errors.error_catalog || [];
  const missingValues = errors.missing_values || [];
  const weakEntries = errors.weak_data_entries || [];
  const extractionDocumentErrors = Array.isArray(errors?.extraction_failure?.document_errors)
    ? errors.extraction_failure.document_errors
    : [];

  const catalogItems = errorCatalog.map(categorizeError);
  const extractionItems = extractionDocumentErrors.slice(0, 8).map((entry, idx) => ({
    type: 'error', icon: XCircle,
    text: `Extraction gate failure (${idx + 1})`,
    detail: Array.isArray(entry?.errors) ? entry.errors.join('; ') : 'Document-level extraction validation failed.',
  }));

  const allItems = [
    ...catalogItems,
    ...extractionItems,
    ...missingValues.slice(0, 10).map((mv) => ({
      type: 'warning', icon: AlertCircle,
      text: `Missing values for row: ${mv.row_id || 'unknown'}`,
      detail: (mv.flags || []).join(', '),
    })),
    ...weakEntries.slice(0, 5).map((w) => ({
      type: 'info', icon: Info,
      text: `Weak Data Entry: ${w.canonical_label || 'unknown'}`,
      detail: `Confidence: ${((w.confidence_score || 0) * 100).toFixed(0)}%`,
    })),
  ].filter((item, index, arr) => {
    const key = `${item.type}|${item.text}|${item.detail || ''}`;
    return arr.findIndex((candidate) => `${candidate.type}|${candidate.text}|${candidate.detail || ''}` === key) === index;
  });

  const hasIssues = allItems.length > 0;

  return (
    <div className="card fade-in">
      <div className="card-header flex items-center justify-between">
        <span>Errors & Warnings</span>
        {hasIssues && (
          <span className="text-[11px] font-semibold bg-red-50/80 text-red-700 border border-red-200/60 px-2.5 py-0.5 rounded-lg tracking-[-0.01em]">
            {allItems.length} issues
          </span>
        )}
      </div>
      <div className="card-body flex flex-col gap-2" style={{ maxHeight: 350, overflowY: 'auto' }}>
        {!hasIssues ? (
          <div className="text-center text-green-600 py-5 font-semibold text-[13px] tracking-[-0.01em]">
            ✓ No errors or warnings detected
          </div>
        ) : (
          allItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className={`error-item ${item.type}`}>
                <Icon size={16} className="shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold tracking-[-0.01em]">{item.text}</div>
                  {item.detail && (
                    <div className="text-[11px] opacity-80 mt-0.5 tracking-[-0.01em]">{item.detail}</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
