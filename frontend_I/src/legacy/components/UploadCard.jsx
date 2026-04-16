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
          style={{
            border: '2px dashed #cbd5e1',
            borderRadius: 12,
            padding: '32px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            position: 'relative',
            background: file ? '#f0fdf4' : '#fafbfc',
            transition: 'all 0.2s',
          }}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            id="file-upload-input"
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              cursor: 'pointer',
              width: '100%',
              height: '100%',
            }}
          />
          <Upload size={32} color={file ? '#22c55e' : '#94a3b8'} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
            {file ? file.name : 'Drop PDF here or click to select'}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Max 50MB • PDF only'}
          </div>
        </div>

        {/* Company metadata */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
              Company Symbol
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="e.g. JKH"
              id="company-symbol-input"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. John Keells Holdings"
              id="company-name-input"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
            Sector
          </label>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            id="sector-select"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: 13,
              outline: 'none',
              background: '#fff',
            }}
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
          style={{
            width: '100%',
            marginTop: 16,
            padding: '12px',
            borderRadius: 8,
            border: 'none',
            background: !file || isUploading ? '#cbd5e1' : '#2d3a8c',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: !file || isUploading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s',
          }}
        >
          {isUploading ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
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
