// src/App.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, FileText, CheckCircle, XCircle, ChevronRight, Activity, DollarSign, PieChart, BarChart2, ShieldCheck } from 'lucide-react';

// API Endpoints
const API_BASE = '/api'; // Proxies to :3000

const SERVICES = [
  { id: 'income_statement', name: 'Income Statement', icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100' },
  { id: 'balance_sheet', name: 'Balance Sheet', icon: PieChart, color: 'text-blue-600', bg: 'bg-blue-100' },
  { id: 'cashflow_statement', name: 'Cash Flow', icon: Activity, color: 'text-purple-600', bg: 'bg-purple-100' },
  { id: 'oci_statement', name: 'OCI Statement', icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  { id: 'equity_statement', name: 'Equity Changes', icon: BarChart2, color: 'text-orange-600', bg: 'bg-orange-100' },
  { id: 'validation', name: 'Data Validation', icon: ShieldCheck, color: 'text-red-600', bg: 'bg-red-100' },
];

function App() {
  const [file, setFile] = useState(null);
  const [reportId, setReportId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, completed, error
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState('income_statement');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const uploadFile = async () => {
    if (!file) return;

    setStatus('uploading');
    const formData = new FormData();
    formData.append('report', file);

    try {
      const res = await axios.post(`${API_BASE}/reports`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setReportId(res.data.reportId);
      setStatus('processing');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  // Polling for status
  useEffect(() => {
    let interval;
    if (reportId && (status === 'processing' || status === 'completed')) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_BASE}/reports/${reportId}`);
          setReportData(res.data);
          
          // Check if all core extractions have a status (simplified logic)
          const allDone = Object.values(res.data.extractions || {}).every(e => e.status === 'completed' || e.status === 'failed' || e.status === 'partial');
          
          if (allDone && status !== 'completed') {
             // Keep polling for a bit or allow manual refresh? 
             // For now, just keep updating data.
          }
        } catch (err) {
          console.error(err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [reportId, status]);

  const renderStatusIcon = (status) => {
    if (status === 'completed') return <CheckCircle size={20} className="text-green-500" />;
    if (status === 'failed') return <XCircle size={20} className="text-red-500" />;
    if (status === 'partial') return <Activity size={20} className="text-yellow-500" />;
    return <div className="loader border-gray-400 h-4 w-4" />; 
  };

  const getExtractorData = (key) => {
    if (!reportData || !reportData.extractions) return null;
    return reportData.extractions[key];
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-inter">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
                <FileText size={24} />
            </div>
            <h1 className="text-xl font-bold text-gray-800">PLC Report Analyzer <span className="text-sm font-normal text-gray-500 ml-2">Engineering Dashboard</span></h1>
        </div>
        <div className="font-mono text-xs text-gray-400">
            v2.0.0-beta
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-12 gap-6">
        
        {/* Left Sidebar: Upload & Status */}
        <div className="col-span-3 space-y-6">
            
            {/* Upload Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">Upload New Report</h2>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:border-blue-400 transition-colors cursor-pointer relative bg-gray-50/50">
                    <input 
                        type="file" 
                        accept=".pdf"
                        onChange={handleFileChange} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload size={32} className="text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600 font-medium">{file ? file.name : "Select PDF Document"}</span>
                    <span className="text-xs text-gray-400 mt-1">Max 50MB</span>
                </div>
                <button 
                    onClick={uploadFile}
                    disabled={!file || status === 'uploading'}
                    className={`w-full mt-4 py-2.5 rounded-lg font-medium text-white transition-all shadow-sm flex items-center justify-center gap-2
                        ${!file || status === 'uploading' ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'}
                    `}
                >
                    {status === 'uploading' ? (
                        <>Processing... <div className="loader h-4 w-4 border-white/50 border-t-white"></div></>
                    ) : (
                        <>Start Analysis <ChevronRight size={16} /></>
                    )}
                </button>
            </div>

            {/* Extractor Status List */}
            {reportData && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/30">
                        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Extraction Pipeline</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {SERVICES.map((svc) => {
                            const data = getExtractorData(svc.id);
                            const svcStatus = data ? data.status : 'pending';
                            const Icon = svc.icon;
                            
                            return (
                                <div 
                                    key={svc.id}
                                    onClick={() => setActiveTab(svc.id)}
                                    className={`px-5 py-3 flex items-center justify-between cursor-pointer transition-colors hover:bg-gray-50
                                        ${activeTab === svc.id ? 'bg-blue-50/60 border-l-4 border-blue-500 pl-[1.15rem]' : ''}
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-md ${svc.bg} ${svc.color}`}>
                                            <Icon size={16} />
                                        </div>
                                        <div>
                                            <div className={`text-sm font-medium ${activeTab === svc.id ? 'text-blue-900' : 'text-gray-700'}`}>{svc.name}</div>
                                            {data && data.metadata && (
                                                <div className="text-[10px] text-gray-400">
                                                    {(data.metadata.confidence_score * 100).toFixed(0)}% Confidence • {data.normalized_rows?.length || 0} Rows
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        {renderStatusIcon(svcStatus)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>

        {/* Main Content: Data View */}
        <div className="col-span-9">
            {reportData ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[600px] flex flex-col">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-800">
                            {SERVICES.find(s => s.id === activeTab)?.name} Detail
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200">
                                Report ID: {reportId.slice(0, 8)}...
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-auto p-0">
                        <ExtractorView data={getExtractorData(activeTab)} type={activeTab} />
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-full flex flex-col items-center justify-center text-gray-400 p-10">
                    <div className="bg-gray-50 p-6 rounded-full mb-4">
                        <PieChart size={48} className="text-gray-300" />
                    </div>
                    <p className="text-lg font-medium text-gray-500">No Data Loaded</p>
                    <p className="text-sm">Upload a PDF report to visualize the extraction flow.</p>
                </div>
            )}
        </div>

      </main>
    </div>
  );
}

// Sub-component for rendering data tables
function ExtractorView({ data, type }) {
    if (!data) return <div className="p-10 text-center text-gray-400">Waiting for extraction...</div>;
    if (data.status === 'failed') {
        return (
            <div className="p-10 flex flex-col items-center justify-center text-red-500">
                <XCircle size={48} className="mb-4" />
                <h3 className="text-lg font-semibold">Extraction Failed</h3>
                <p className="text-sm text-gray-600 mt-2">Error Code: {data.error_code || 'Unknown'}</p>
                {data.metadata?.validation_errors?.length > 0 && (
                     <div className="mt-4 bg-red-50 p-4 rounded-lg text-left text-xs text-red-700 max-w-lg w-full">
                        <ul className="list-disc pl-4 space-y-1">
                            {data.metadata.validation_errors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                     </div>
                )}
            </div>
        );
    }

    if (!data.normalized_rows || data.normalized_rows.length === 0) {
        return <div className="p-10 text-center text-gray-400">No rows extracted. Check if the section exists in the report.</div>;
    }

    // Group by section for cleaner view
    const sections = {};
    data.normalized_rows.forEach(row => {
        const sec = row.section || 'Uncategorized';
        if (!sections[sec]) sections[sec] = [];
        sections[sec].push(row);
    });

    return (
        <div className="p-6 space-y-8">
            {/* Metadata Summary */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-xs text-gray-500 uppercase">Confidence</div>
                    <div className="text-lg font-semibold text-gray-800">{(data.metadata?.confidence_score * 100).toFixed(1)}%</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-xs text-gray-500 uppercase">Detected Scale</div>
                    <div className="text-lg font-semibold text-gray-800">{data.normalized_rows[0]?.scale_multiplier === 1000 ? "Rs '000" : (data.normalized_rows[0]?.scale_multiplier || 'Unknown')}</div>
                </div>
                 <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-xs text-gray-500 uppercase">Currency</div>
                    <div className="text-lg font-semibold text-gray-800">LKR</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-xs text-gray-500 uppercase">Rows</div>
                    <div className="text-lg font-semibold text-gray-800">{data.normalized_rows.length}</div>
                </div>
            </div>

            {Object.entries(sections).map(([secName, rows]) => (
                <div key={secName} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 font-medium text-sm text-gray-700 uppercase tracking-wide flex justify-between">
                        <span>{secName}</span>
                    </div>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 w-1/2">Label</th>
                                <th className="px-4 py-3 text-right">Raw Value</th>
                                <th className="px-4 py-3 text-right">Normalized (Rs '000)</th>
                                <th className="px-4 py-3 text-center">Year</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50 group">
                                    <td className="px-4 py-2 text-gray-800">
                                        <div style={{ paddingLeft: `${(row.depth || 0) * 12}px` }} className="flex items-center">
                                            {row.depth > 0 && <span className="text-gray-300 mr-2">↳</span>}
                                            {row.label}
                                        </div>
                                    </td>
                                    <td className={`px-4 py-2 text-right font-mono ${row.is_negative ? 'text-red-500' : 'text-gray-600'}`}>
                                        {row.is_negative ? `(${Math.abs(row.value).toLocaleString()})` : row.value?.toLocaleString() || '-'}
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono font-medium text-gray-800 bg-gray-50/30">
                                         {row.normalised_value ? row.normalised_value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-'}
                                    </td>
                                    <td className="px-4 py-2 text-center text-gray-500 text-xs">
                                        {row.year}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
    );
}

export default App;