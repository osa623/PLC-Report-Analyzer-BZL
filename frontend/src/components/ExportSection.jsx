import React, { useState } from 'react';
import { pdfService } from '../services/api';
import {
  DocumentArrowDownIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const ExportSection = ({ companyId }) => {
  const [exportingFormat, setExportingFormat] = useState(null);
  const [error, setError] = useState(null);

  const handleExport = async (format) => {
    if (!companyId) return;
    setExportingFormat(format);
    setError(null);
    try {
      await pdfService.exportCompanyReport(companyId, format);
    } catch (err) {
      console.error(`Export to ${format.toUpperCase()} failed:`, err);
      setError(`Failed to download ${format.toUpperCase()} report.`);
    } finally {
      setExportingFormat(null);
    }
  };

  const formats = [
    { key: 'pdf', label: 'PDF Document', color: 'hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50' },
    { key: 'docx', label: 'Word (DOCX)', color: 'hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50' },
    { key: 'xlsx', label: 'Excel (XLSX)', color: 'hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/50' },
  ];

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-100 rounded-2xl p-6 shadow-sm">
      <h2 className="text-sm font-bold text-slate-800 mb-1 tracking-tight">Export Executive Reports</h2>
      <p className="text-xs text-slate-400 mb-4">Download the fully calculated analysis in standard professional formats</p>
      
      {error && (
        <div className="mb-4 text-xs text-rose-500 font-medium bg-rose-50 border border-rose-100 rounded-lg p-2.5">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {formats.map(({ key, label, color }) => {
          const isLoading = exportingFormat === key;

          return (
            <button
              key={key}
              onClick={() => handleExport(key)}
              disabled={exportingFormat !== null}
              className={`flex items-center justify-between gap-3 px-4 py-3 bg-white border border-slate-150 rounded-xl text-xs font-semibold text-slate-700 tracking-refined shadow-sm hover:shadow transition-all duration-200 select-none ${color} ${
                exportingFormat !== null ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <ArrowPathIcon className="w-4 h-4 text-indigo-500 animate-spin" />
                ) : (
                  <DocumentArrowDownIcon className="w-4 h-4" />
                )}
                <span>{label}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {key}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ExportSection;
