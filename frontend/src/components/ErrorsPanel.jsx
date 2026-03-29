import React from 'react';
import { AlertTriangle, XCircle, AlertCircle, Info } from 'lucide-react';

function categorizeError(err) {
  if (typeof err === 'string') {
    if (err.includes('balance_mismatch')) return { type: 'error', icon: XCircle, text: 'Balance Sheet Mismatch', detail: err };
    if (err.includes('revenue_lt_net_profit')) return { type: 'error', icon: AlertTriangle, text: 'Revenue less than Net Profit', detail: err };
    if (err.includes('missing')) return { type: 'warning', icon: AlertCircle, text: 'Missing Critical Values', detail: err };
    return { type: 'warning', icon: AlertCircle, text: err, detail: '' };
  }
  return { type: 'info', icon: Info, text: JSON.stringify(err), detail: '' };
}

export default function ErrorsPanel({ errors }) {
  if (!errors) {
    return (
      <div className="card">
        <div className="card-header">Errors & Warnings</div>
        <div className="card-body" style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>
          No error data available yet.
        </div>
      </div>
    );
  }

  const errorCatalog = errors.error_catalog || [];
  const missingValues = errors.missing_values || [];
  const weakEntries = errors.weak_data_entries || [];

  const allItems = [
    ...errorCatalog.map(categorizeError),
    ...missingValues.slice(0, 10).map((mv) => ({
      type: 'warning',
      icon: AlertCircle,
      text: `Missing values for row: ${mv.row_id || 'unknown'}`,
      detail: (mv.flags || []).join(', '),
    })),
    ...weakEntries.slice(0, 5).map((w) => ({
      type: 'info',
      icon: Info,
      text: `Weak Data Entry: ${w.canonical_label || 'unknown'}`,
      detail: `Confidence: ${((w.confidence_score || 0) * 100).toFixed(0)}%`,
    })),
  ];

  const hasIssues = allItems.length > 0;

  return (
    <div className="card fade-in">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Errors & Warnings</span>
        {hasIssues && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            background: '#fef2f2',
            color: '#991b1b',
            padding: '3px 10px',
            borderRadius: 12,
          }}>
            {allItems.length} issues
          </span>
        )}
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 350, overflowY: 'auto' }}>
        {!hasIssues ? (
          <div style={{ textAlign: 'center', color: '#22c55e', padding: 20, fontWeight: 600, fontSize: 14 }}>
            ✓ No errors or warnings detected
          </div>
        ) : (
          allItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className={`error-item ${item.type}`}>
                <Icon size={16} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{item.text}</div>
                  {item.detail && (
                    <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{item.detail}</div>
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
