import React from 'react';
import { getStatusBg } from '../../utils/formatters';
import { CalendarIcon, DocumentTextIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

const BatchSelector = ({ batches = [], selectedBatchId, onSelectBatch }) => {
  const selectedBatch = batches.find((b) => b.batch_id === selectedBatchId);

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex-grow">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Selected Analysis Session</span>
        {selectedBatch ? (
          <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm font-bold text-slate-800 tracking-tight">
              {selectedBatch.company || 'Unknown Company'}
            </span>
            <div className="flex flex-wrap gap-2 items-center text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <DocumentTextIcon className="w-3.5 h-3.5" />
                {selectedBatch.filename || 'Source PDF'}
              </span>
              <span className="flex items-center gap-1 border-l border-slate-200 pl-2">
                <CalendarIcon className="w-3.5 h-3.5" />
                {formatTime(selectedBatch.created_at)}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize ${getStatusBg(selectedBatch.status)}`}>
                {selectedBatch.status}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-400 mt-1 block">No session selected</span>
        )}
      </div>

      {/* Select Box */}
      <div className="relative min-w-[200px]">
        <select
          value={selectedBatchId || ''}
          onChange={(e) => onSelectBatch(e.target.value)}
          className="w-full text-xs font-semibold pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 cursor-pointer appearance-none"
        >
          <option value="" disabled>Select analysis batch...</option>
          {batches.map((b) => (
            <option key={b.batch_id} value={b.batch_id}>
              {b.company || b.filename || b.batch_id} ({new Date(b.created_at).toLocaleDateString()})
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
          <ChevronDownIcon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
};

export default BatchSelector;
