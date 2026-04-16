import React, { useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const toClipboardText = (grid) => grid.map((row) => row.map((v) => String(v ?? '')).join('\t')).join('\n');

const headerImpliesThousands = (header) => {
  const text = String(header ?? '').toLowerCase();
  return /\b000\b|'\s*000|\(\s*000\s*\)|thousand/.test(text);
};

const parseNumericValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const text = value.trim();
  if (!text) return null;
  if (['-', '--', '—', '–', 'n/a', 'na', 'nil', 'none', 'null'].includes(text.toLowerCase())) return null;

  const isBracketNegative = text.startsWith('(') && text.endsWith(')');
  const cleaned = text.replace(/[(),\s]/g, '');
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return isBracketNegative ? -Math.abs(parsed) : parsed;
};

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return value;
  const hasFraction = Math.abs(value % 1) > 0;
  return value.toLocaleString('en-US', hasFraction
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : undefined);
};

const InteractiveDataTable = ({ section }) => {
  const gridRef = useRef(null);
  const [search, setSearch] = useState('');
  const [selectedColumn, setSelectedColumn] = useState(null);

  const headers = useMemo(() => {
    if (Array.isArray(section?.headers) && section.headers.length) return section.headers;
    const colCount = Number.isFinite(section?.column_count) ? Number(section.column_count) : 0;
    if (colCount > 0) return Array.from({ length: colCount }, (_, idx) => `Column ${idx + 1}`);
    return ['Item'];
  }, [section]);

  const hasThousandUnit = useMemo(() => {
    const fromHeaders = headers.some((h, idx) => idx > 0 && headerImpliesThousands(h));
    const notes = String(section?.notes ?? '').toLowerCase();
    const fromNotes = /\b000\b|'\s*000|\(\s*000\s*\)|thousand/.test(notes);
    return fromHeaders || fromNotes;
  }, [headers, section?.notes]);

  const getFormattedValue = useMemo(() => (header, rawValue, colIndex) => {
    const numeric = parseNumericValue(rawValue);
    if (numeric === null) return rawValue ?? '';

    const shouldScale = colIndex > 0 && (hasThousandUnit || headerImpliesThousands(header));
    const adjusted = shouldScale ? numeric * 1000 : numeric;
    return formatNumber(adjusted);
  }, [hasThousandUnit]);

  const normalizedRows = useMemo(() => {
    const sourceRows = Array.isArray(section?.rows) ? section.rows : [];
    return sourceRows.map((row) => {
      if (Array.isArray(row)) {
        return row;
      }
      if (row && typeof row === 'object') {
        const item = row.item ?? row.label ?? '';
        const values = Array.isArray(row.values) ? row.values : [];
        return [item, ...values];
      }
      return [row ?? ''];
    });
  }, [section]);

  const rowData = useMemo(() => (
    normalizedRows.map((row, rowIndex) => {
      const out = { __rowId: rowIndex };
      headers.forEach((header, idx) => {
        out[String(header)] = row[idx] ?? '';
      });
      return out;
    })
  ), [headers, normalizedRows]);

  const columnDefs = useMemo(() => headers.map((header, idx) => ({
    field: String(header),
    headerName: String(header),
    sortable: true,
    resizable: true,
    filter: true,
    minWidth: idx === 0 ? 220 : 130,
    flex: idx === 0 ? 1.35 : 1,
    cellClass: idx === 0 ? 'font-medium text-left' : 'text-right',
    headerClass: selectedColumn === String(header) ? 'bg-slate-100' : '',
    valueFormatter: (params) => getFormattedValue(header, params.value, idx),
  })), [getFormattedValue, headers, selectedColumn]);

  const copySelected = async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    const selectedRows = api.getSelectedRows();
    if (selectedRows.length) {
      const rows = selectedRows.map((row) => headers.map((h, idx) => getFormattedValue(h, row[String(h)], idx)));
      await navigator.clipboard.writeText(toClipboardText([headers, ...rows]));
      return;
    }

    const ranges = api.getCellRanges?.() || [];
    if (!ranges.length) return;

    const out = [];
    for (const range of ranges) {
      const cols = range.columns || [];
      const start = Math.min(range.startRow?.rowIndex ?? 0, range.endRow?.rowIndex ?? 0);
      const end = Math.max(range.startRow?.rowIndex ?? 0, range.endRow?.rowIndex ?? 0);
      out.push(cols.map((c) => c.getColDef().headerName || c.getColId()));
      for (let idx = start; idx <= end; idx += 1) {
        const row = api.getDisplayedRowAtIndex(idx)?.data || {};
        out.push(cols.map((c) => {
          const header = c.getColDef().headerName || c.getColId();
          const colIndex = headers.findIndex((h) => String(h) === String(c.getColId()));
          return getFormattedValue(header, row[c.getColId()], colIndex);
        }));
      }
    }

    await navigator.clipboard.writeText(toClipboardText(out));
  };

  const copyRow = async () => {
    const api = gridRef.current?.api;
    if (!api) return;
    const selectedRows = api.getSelectedRows();
    if (!selectedRows.length) return;
    const rows = selectedRows.map((row) => headers.map((h, idx) => getFormattedValue(h, row[String(h)], idx)));
    await navigator.clipboard.writeText(toClipboardText([headers, ...rows]));
  };

  const copyColumn = async () => {
    if (!selectedColumn) return;
    const colIndex = headers.findIndex((h) => String(h) === String(selectedColumn));
    const lines = [
      selectedColumn,
      ...rowData.map((row) => String(getFormattedValue(selectedColumn, row[selectedColumn], colIndex))),
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
  };

  const copyTable = async () => {
    const rows = rowData.map((row) => headers.map((h, idx) => getFormattedValue(h, row[String(h)], idx)));
    await navigator.clipboard.writeText(toClipboardText([headers, ...rows]));
  };

  if (!rowData.length) {
    return <p className="text-[12px] text-slate-400 tracking-refined">No table rows available.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            const q = e.target.value;
            setSearch(q);
            if (gridRef.current?.api) {
              gridRef.current.api.setGridOption('quickFilterText', q);
            }
          }}
          placeholder="Search table"
          className="text-[12px] border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all duration-200 ease-apple tracking-refined placeholder:text-slate-400"
        />
        <button onClick={copySelected} className="text-[11px] px-2.5 py-1.5 border rounded-xl border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 tracking-refined">Copy Selected</button>
        <button onClick={copyRow} className="text-[11px] px-2.5 py-1.5 border rounded-xl border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 tracking-refined">Copy Row</button>
        <button onClick={copyColumn} className="text-[11px] px-2.5 py-1.5 border rounded-xl border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 tracking-refined">Copy Column</button>
        <button onClick={copyTable} className="text-[11px] px-2.5 py-1.5 border rounded-xl border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 tracking-refined">Copy Table</button>
      </div>

      <div className="ag-theme-alpine rounded-xl border border-slate-200/80 overflow-hidden shadow-apple-sm" style={{ height: 420, width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, resizable: true, filter: true }}
          rowSelection="multiple"
          rowMultiSelectWithClick
          suppressRowClickSelection={false}
          enableRangeSelection
          ensureDomOrder
          animateRows
          getRowId={(params) => String(params.data.__rowId)}
          onCellClicked={(e) => setSelectedColumn(e.colDef.field)}
          onColumnHeaderClicked={(e) => setSelectedColumn(e.column.getColId())}
          suppressDragLeaveHidesColumns
          suppressFieldDotNotation
          domLayout="normal"
          suppressHorizontalScroll={false}
          tooltipShowDelay={0}
        />
      </div>
    </div>
  );
};

export default InteractiveDataTable;
