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
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  if (rows.length === 0) {
    return (
      <div className="card">
        <div className="card-header">Validated Data Table</div>
        <div className="card-body text-center text-slate-400 py-10 text-[13px] tracking-[-0.01em]">
          No validated data available yet. Pipeline must complete validation stage.
        </div>
      </div>
    );
  }

  return (
    <div className="card fade-in">
      <div className="card-header flex items-center justify-between flex-wrap gap-3">
        <span>Validated Data Table</span>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-slate-500 font-medium tracking-[-0.01em]">Confidence Filter:</span>
          <span className="text-[12px] font-semibold text-slate-800 min-w-[40px] tracking-[-0.01em]">Min: {minConfidence.toFixed(1)}</span>
          <input type="range" min="0" max="1" step="0.05" value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            className="w-[120px] accent-slate-900" id="confidence-slider" />
          <span className="text-[12px] font-semibold text-slate-800 tracking-[-0.01em]">Max: 1.0</span>
          <span className="text-[11px] text-slate-400 ml-2 tracking-[-0.01em]">{filteredRows.length} / {rows.length} rows</span>
        </div>
      </div>
      <div className="overflow-x-auto max-h-full">
        <table className="data-table">
          <thead>
            <tr>
              {['canonical_label', 'value', 'year', 'statement_type', 'confidence_score'].map((col) => (
                <th key={col} onClick={() => handleSort(col)} className="cursor-pointer select-none">
                  {col === 'canonical_label' ? 'Label' : col === 'value' ? 'Value' : col === 'year' ? 'Year' : col === 'statement_type' ? 'Statement' : col === 'confidence_score' ? 'Confidence' : 'Page'}
                  {sortCol === col && (sortAsc ? ' ▲' : ' ▼')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.slice(0, 200).map((row, i) => (
              <tr key={row.row_id || i}>
                <td className="font-medium max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap">{row.original_label || row.canonical_label || '—'}</td>
                <td className="font-mono font-semibold text-right">{formatValue(row.value)}</td>
                <td>{row.year || '—'}</td>
                <td><span className="text-[11px] bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg tracking-[-0.01em]">{row.statement_type || '—'}</span></td>
                <td><span className={`confidence-badge ${confidenceClass(row.confidence_score || 0)}`}>{((row.confidence_score || 0) * 100).toFixed(0)}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length > 200 && (
          <div className="py-3 text-center text-[12px] text-slate-400 tracking-[-0.01em]">Showing 200 of {filteredRows.length} rows</div>
        )}
      </div>
    </div>
  );
}
