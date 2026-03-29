import React, { useState, useMemo } from 'react';

function confidenceClass(score) {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'moderate';
  return 'low';
}

function formatValue(val) {
  if (val == null) return '—';
  if (typeof val === 'number') {
    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return val.toLocaleString();
  }
  return String(val);
}

export default function ValidatedDataTable({ data }) {
  const [minConfidence, setMinConfidence] = useState(0);
  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  const rows = useMemo(() => {
    if (!data?.validated?.validated_rows) return [];
    return data.validated.validated_rows;
  }, [data]);

  const filteredRows = useMemo(() => {
    let filtered = rows.filter((r) => (r.confidence_score || 0) >= minConfidence);
    if (sortCol) {
      filtered = [...filtered].sort((a, b) => {
        const av = a[sortCol] ?? '';
        const bv = b[sortCol] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
        return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    return filtered;
  }, [rows, minConfidence, sortCol, sortAsc]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="card">
        <div className="card-header">Validated Data Table</div>
        <div className="card-body" style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
          No validated data available yet. Pipeline must complete validation stage.
        </div>
      </div>
    );
  }

  return (
    <div className="card fade-in">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <span>Validated Data Table</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Confidence Filter:</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', minWidth: 40 }}>
            Min: {minConfidence.toFixed(1)}
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            style={{ width: 140 }}
            id="confidence-slider"
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>Max: 1.0</span>
          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>
            {filteredRows.length} / {rows.length} rows
          </span>
        </div>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 420 }}>
        <table className="data-table">
          <thead>
            <tr>
              {['canonical_label', 'value', 'year', 'statement_type', 'confidence_score', 'page_number'].map(
                (col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    {col === 'canonical_label' ? 'Label' :
                     col === 'value' ? 'Value' :
                     col === 'year' ? 'Year' :
                     col === 'statement_type' ? 'Statement' :
                     col === 'confidence_score' ? 'Confidence' :
                     'Page'}
                    {sortCol === col && (sortAsc ? ' ▲' : ' ▼')}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filteredRows.slice(0, 200).map((row, i) => (
              <tr key={row.row_id || i}>
                <td style={{ fontWeight: 500, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.original_label || row.canonical_label || '—'}
                </td>
                <td style={{ fontFamily: 'monospace', fontWeight: 600, textAlign: 'right' }}>
                  {formatValue(row.value)}
                </td>
                <td>{row.year || '—'}</td>
                <td>
                  <span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>
                    {row.statement_type || '—'}
                  </span>
                </td>
                <td>
                  <span className={`confidence-badge ${confidenceClass(row.confidence_score || 0)}`}>
                    {((row.confidence_score || 0) * 100).toFixed(0)}%
                  </span>
                </td>
                <td style={{ color: '#64748b' }}>{row.page_number ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length > 200 && (
          <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
            Showing 200 of {filteredRows.length} rows
          </div>
        )}
      </div>
    </div>
  );
}
