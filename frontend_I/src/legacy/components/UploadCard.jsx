import React, { useState } from 'react';
import { Upload, ChevronRight, Loader2 } from 'lucide-react';

export default function UploadCard({ onUpload, isUploading }) {
  const [file, setFile] = useState(null);
  const [symbol, setSymbol] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [sector, setSector] = useState('Diversified');

  const handleSubmit = () => {
    if (!file || isUploading) return;
    onUpload(file, { symbol: symbol || 'UNKNOWN', name: companyName || 'Unknown', sector });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="card fade-in" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="card-header">Upload Annual Report</div>
      <div className="card-body">
        {/* File drop zone */}
        <div
          className={`relative rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
            ${file ? 'border-green-300 bg-green-50/30' : 'border-slate-200 bg-slate-50/30 hover:border-slate-300 hover:bg-white'}`}
          style={{ padding: '32px 24px' }}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            id="file-upload-input"
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <div className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3 transition-colors duration-200
            ${file ? 'bg-green-100 border border-green-200/60' : 'bg-slate-100 border border-slate-200/60'}`}>
            <Upload size={20} className={file ? 'text-green-600' : 'text-slate-400'} />
          </div>
          <div className="text-[13px] font-semibold text-slate-800 tracking-[-0.01em]">
            {file ? file.name : 'Drop PDF here or click to select'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 tracking-[-0.01em]">
            {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Max 50MB • PDF only'}
          </div>
        </div>

        {/* Company metadata */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1.5 tracking-[-0.01em]">
              Company Symbol
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="e.g. JKH"
              id="company-symbol-input"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all duration-200 tracking-[-0.01em]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1.5 tracking-[-0.01em]">
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. John Keells Holdings"
              id="company-name-input"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all duration-200 tracking-[-0.01em]"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-[11px] font-medium text-slate-400 mb-1.5 tracking-[-0.01em]">
            Sector
          </label>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            id="sector-select"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] bg-white focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all duration-200 tracking-[-0.01em]"
          >
            {['Diversified', 'Banking', 'Insurance', 'Manufacturing', 'Telecommunications',
              'Plantations', 'Hotels', 'Healthcare', 'Energy', 'Real Estate', 'IT', 'Other'].map(
              (s) => (
                <option key={s} value={s}>{s}</option>
              )
            )}
          </select>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!file || isUploading}
          id="start-analysis-btn"
          className={`w-full mt-4 py-3 rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 transition-all duration-200 tracking-[-0.01em]
            ${!file || isUploading
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm hover:shadow-md cursor-pointer'}`}
        >
          {isUploading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Start Analysis
              <ChevronRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
