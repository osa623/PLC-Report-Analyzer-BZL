import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, FileText, CheckCircle, XCircle, Activity, 
  DollarSign, PieChart, BarChart2, ShieldCheck, 
    Layers, AlertCircle, Loader2, Download, Table2, AlignLeft
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

function getUploadErrorMessage(err) {
    if (err?.response) {
        const status = err.response.status;
        const backendMessage = err.response?.data?.error || err.response?.data?.message;
        if (status === 413) return 'Upload failed: file is too large. Maximum allowed size is 50MB per file.';
        if (status === 400 && backendMessage) return `Upload failed: ${backendMessage}`;
        return `Upload failed (${status}): ${backendMessage || 'Unexpected backend error.'}`;
    }
    if (err?.request) return 'Upload failed: cannot reach API. Make sure Node backend is running on port 3000 and frontend proxy/API URL is correct.';
    return `Upload failed: ${err?.message || 'Unknown error'}`;
}

const PIPELINE_STAGE_SEQUENCE = ['UPLOAD','PARSING','STRUCTURE','EXTRACTION','AGGREGATION','VALIDATION','ANALYTICS','REPORT'];

const SERVICE_STAGE_MAP = {
    parsed_document: 'PARSING', structure: 'STRUCTURE',
    income_statement: 'EXTRACTION', balance_sheet: 'EXTRACTION', cashflow_statement: 'EXTRACTION',
    segments: 'EXTRACTION', governance: 'EXTRACTION', risk: 'EXTRACTION', esg: 'EXTRACTION',
    oci_statement: 'EXTRACTION', equity_statement: 'EXTRACTION', validation: 'VALIDATION',
    strategy: 'ANALYTICS', kpi: 'ANALYTICS', patterns: 'ANALYTICS', financial_ratios: 'ANALYTICS',
    generated_report: 'REPORT',
};

const SERVICES_MAP = {
  parsed_document: { name: "Parsing", icon: FileText },
  structure: { name: "Structure", icon: Layers },
  income_statement: { name: "Income Stmt", icon: DollarSign },
  balance_sheet: { name: "Balance Sheet", icon: PieChart },
  cashflow_statement: { name: "Cash Flow", icon: Activity },
  segments: { name: "Segments", icon: PieChart },
  governance: { name: "Governance", icon: ShieldCheck },
  risk: { name: "Risk", icon: AlertCircle },
  esg: { name: "ESG", icon: FileText },
  strategy: { name: "Strategy", icon: Activity },
  kpi: { name: "KPIs", icon: BarChart2 },
  patterns: { name: "Patterns", icon: Activity },
  generated_report: { name: "Report Gen", icon: CheckCircle },
  financial_ratios: { name: "Ratios", icon: PieChart },
  oci_statement: { name: "OCI", icon: FileText },
  equity_statement: { name: "Equity", icon: BarChart2 },
  validation: { name: "Validation", icon: ShieldCheck },
};

const EXTRACTION_DOWNLOAD_FORMATS = ['md', 'xlsx', 'docx', 'pdf', 'json', 'csv'];

const EXTRACTION_LABEL_MAP = {
    income_statement: 'Income Statement', balance_sheet: 'Balance Sheet',
    cashflow_statement: 'Cash Flow Statement', segments: 'Segments',
    oci_statement: 'OCI Statement', equity_statement: 'Equity Statement',
    governance: 'Governance', risk: 'Risk', esg: 'ESG', strategy: 'Strategy',
};

function DashboardApp() {
  const navigate = useNavigate();
  const [batchId, setBatchId] = useState(null);
  const [reports, setReports] = useState([]);
  const [batchStatus, setBatchStatus] = useState(null);
  const [reportDetails, setReportDetails] = useState({});
  const [reportViewMode, setReportViewMode] = useState({});
  const [extractionViews, setExtractionViews] = useState({});
  const [analyzerViews, setAnalyzerViews] = useState({});
  const [analyzerAccuracy, setAnalyzerAccuracy] = useState({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [backendConnected, setBackendConnected] = useState(true);

  const getSectionIcon = (sectionKey) => {
    const mapped = SERVICES_MAP[sectionKey];
    return mapped?.icon || FileText;
  };

  const fetchExtractionView = useCallback(async (reportId) => {
    if (!reportId || extractionViews[reportId]) return;
    try {
      const res = await axios.get(`${API_BASE}/reports/${reportId}/extractions`);
      setExtractionViews((prev) => ({ ...prev, [reportId]: res.data }));
    } catch (_) {}
  }, [extractionViews]);

  const fetchAnalyzerView = useCallback(async (reportId) => {
    if (!reportId || analyzerViews[reportId]) return;
    try {
      const res = await axios.get(`${API_BASE}/reports/${reportId}/analyzer`);
      setAnalyzerViews((prev) => ({ ...prev, [reportId]: res.data }));
    } catch (_) {}
  }, [analyzerViews]);

  const fetchAnalyzerAccuracy = useCallback(async (reportId) => {
    if (!reportId) return;
    try {
      const res = await axios.get(`${API_BASE}/reports/${reportId}/analyzer/accuracy`);
      setAnalyzerAccuracy((prev) => ({ ...prev, [reportId]: res.data }));
    } catch (_) {}
  }, []);

  const openExtractionView = useCallback((reportId) => {
    if (!reportId) return;
    setReportViewMode((prev) => ({ ...prev, [reportId]: 'extraction' }));
    fetchExtractionView(reportId);
  }, [fetchExtractionView]);

  const openAnalyzerView = useCallback((reportId) => {
    if (!reportId) return;
    setReportViewMode((prev) => ({ ...prev, [reportId]: 'analyzer' }));
    fetchAnalyzerView(reportId);
    fetchAnalyzerAccuracy(reportId);
  }, [fetchAnalyzerView, fetchAnalyzerAccuracy]);

  const normalizePipelineTracker = (details) => {
    const tracker = details?.pipeline_tracker;
    if (Array.isArray(tracker) && tracker.length > 0) return tracker;
    const wfState = details?.workflow_state;
    const fallbackIndex = {
      UPLOADED: 0, PARSING: 1, STRUCTURE_DETECTED: 2, EXTRACTING: 3, AGGREGATING: 4,
      VALIDATING: 5, LOW_CONFIDENCE: 5, ANALYZING: 6, GENERATING_REPORT: 7, COMPLETED: 7, FAILED: -1,
    };
    const current = fallbackIndex[wfState] ?? 0;
    return PIPELINE_STAGE_SEQUENCE.map((stage, idx) => {
      let status = 'pending';
      if (wfState === 'FAILED' && idx >= Math.max(0, current)) status = 'failed';
      else if (current > idx) status = 'completed';
      else if (current === idx) status = 'running';
      if (wfState === 'LOW_CONFIDENCE' && (stage === 'ANALYTICS' || stage === 'REPORT')) status = 'skipped';
      return { stage, status };
    });
  };

  const getDataViewStats = (details) => {
    const raw = details?.data_views?.raw_data;
    const cleaned = details?.data_views?.cleaned_data;
    const validated = details?.data_views?.validated_data;
    return [
      { key: 'raw', name: 'RAW DATA', count: Array.isArray(raw?.rows) ? raw.rows.length : Array.isArray(raw) ? raw.length : null },
      { key: 'cleaned', name: 'CLEANED DATA', count: Array.isArray(cleaned?.rows) ? cleaned.rows.length : Array.isArray(cleaned) ? cleaned.length : null },
      { key: 'validated', name: 'VALIDATED DATA', count: Array.isArray(validated?.validated_rows) ? validated.validated_rows.length : Array.isArray(validated?.rows) ? validated.rows.length : Array.isArray(validated) ? validated.length : null },
    ];
  };

  const buildStageStatusMap = (details) => {
    return normalizePipelineTracker(details).reduce((acc, stage) => { acc[stage.stage] = stage.status; return acc; }, {});
  };

  const resolveServiceStatus = (details, key, stageStatusMap) => {
    if (!details) return 'pending';
    const hasRaw = !!details?.data_views?.raw_data;
    const hasValidated = !!details?.data_views?.validated_data;
    const hasNarrative = { governance: !!details?.narratives?.governance, risk: !!details?.narratives?.risk, esg: !!details?.narratives?.esg, strategy: !!details?.narratives?.strategy };
    const hasAnalytics = { kpi: !!details?.analytics?.sector_kpis, patterns: !!details?.analytics?.patterns, financial_ratios: !!details?.analytics?.ratios };
    if (key === 'generated_report' && details?.pdf_path) return 'completed';
    if (key === 'validation' && hasValidated) return 'completed';
    if (['income_statement','balance_sheet','cashflow_statement','segments','oci_statement','equity_statement'].includes(key) && hasRaw) return 'completed';
    if (hasNarrative[key]) return 'completed';
    if (hasAnalytics[key]) return 'completed';
    const stage = SERVICE_STAGE_MAP[key];
    if (stage && stageStatusMap[stage]) return stageStatusMap[stage];
    if (details.workflow_state === 'COMPLETED') return 'completed';
    if (details.workflow_state === 'FAILED') return 'failed';
    return 'pending';
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    if (!backendConnected) { setError('API is disconnected. Start backends and retry upload.'); return; }
    setUploading(true);
    setError(null);
    const formData = new FormData();
    acceptedFiles.forEach(file => formData.append('reports', file));
    formData.append('symbol', 'BATCH');
    formData.append('name', 'Batch Upload');
    formData.append('sector', 'Diversified');
    try {
      const res = await axios.post(`${API_BASE}/reports/batch`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { batchId, reports } = res.data;
      setBatchId(batchId);
      setReports(reports.map(r => ({ id: r.report.id, fileName: r.originalName, status: 'pending' })));
    } catch (err) {
      console.error(err);
      setError(getUploadErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }, [backendConnected]);

  const onDropRejected = useCallback((fileRejections) => {
    const first = fileRejections?.[0];
    if (!first) { setError('Upload rejected. Please select PDF files up to 50MB each.'); return; }
    const oversized = first.errors?.some((e) => e.code === 'file-too-large');
    const badType = first.errors?.some((e) => e.code === 'file-invalid-type');
    if (oversized) { setError('Upload rejected: one or more files exceed 50MB.'); return; }
    if (badType) { setError('Upload rejected: only PDF files are allowed.'); return; }
    setError('Upload rejected. Please check file type and size.');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, onDropRejected,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_UPLOAD_SIZE,
  });

  useEffect(() => {
    const checkHealth = async () => {
      try { await axios.get(`${API_BASE}/health`); setBackendConnected(true); } catch (_) { setBackendConnected(false); }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!batchId) return;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/reports/batch/${batchId}`);
        if (res.data) {
          setBatchStatus(res.data);
          if (res.data.reports && Array.isArray(res.data.reports)) {
            setReports(prev => {
              const updated = [...prev];
              res.data.reports.forEach(r => {
                const index = updated.findIndex(u => u.fileName === r.fileName);
                if (index !== -1) { updated[index].status = r.status; if (r.reportId && !updated[index].id) updated[index].id = r.reportId; }
              });
              return updated;
            });
          }
        }
      } catch (err) { console.error("Batch poll warning", err); }
    }, 2000);
    return () => clearInterval(interval);
  }, [batchId]);

  useEffect(() => {
    if (reports.length === 0) return;
    const interval = setInterval(async () => {
      reports.forEach(async (report) => {
        if (!report.id) return;
        try {
          const res = await axios.get(`${API_BASE}/reports/${report.id}`);
          setReportDetails(prev => ({ ...prev, [report.id]: res.data }));
        } catch (e) {}
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [reports]);

  const renderExtractionPanel = (reportId) => {
    const payload = extractionViews[reportId];
    if (!payload) return <div className="bg-white border border-slate-200/80 rounded-2xl p-4 text-[13px] text-slate-400 tracking-[-0.01em]">Loading extraction sections...</div>;
    const sections = Array.isArray(payload.sections) ? payload.sections : [];
    if (sections.length === 0) return <div className="bg-white border border-slate-200/80 rounded-2xl p-4 text-[13px] text-slate-400 tracking-[-0.01em]">No extraction sections available yet.</div>;

    return (
      <div className="space-y-4">
        {sections.map((section) => {
          const SectionIcon = getSectionIcon(section.key);
          return (
            <div key={section.key} className="bg-white border border-slate-200/80 rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <SectionIcon size={16} className="text-slate-500" />
                  <h4 className="text-[13px] font-semibold text-slate-800 tracking-[-0.01em]">
                    {section.label || EXTRACTION_LABEL_MAP[section.key] || section.key}
                  </h4>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {EXTRACTION_DOWNLOAD_FORMATS.map((fmt) => (
                    <a
                      key={`${section.key}-${fmt}`}
                      href={`${API_BASE}/reports/${reportId}/extractions/${section.key}/download?format=${fmt}`}
                      className="text-[11px] px-2 py-1 rounded-lg border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 text-slate-600 flex items-center gap-1 transition-all duration-150 tracking-[-0.01em]"
                    >
                      <Download size={11} /> {fmt.toUpperCase()}
                    </a>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {(section.blocks || []).map((block, idx) => (
                  <div key={`${section.key}-block-${idx}`} className="border border-slate-100 rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2 flex items-center gap-2">
                      {block.type === 'table' ? <Table2 size={12} /> : <AlignLeft size={12} />}
                      {block.type} {block.title ? `· ${block.title}` : ''}
                    </div>
                    {block.type === 'table' ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-[12px] border-collapse">
                          <thead>
                            <tr>
                              {(block.columns || []).map((col) => (
                                <th key={col} className="text-left border-b border-slate-200 px-2 py-1.5 font-semibold text-slate-500 text-[11px] uppercase tracking-wide">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(block.rows || []).slice(0, 20).map((row, rowIndex) => (
                              <tr key={`${section.key}-${idx}-${rowIndex}`} className="hover:bg-slate-50/50">
                                {(block.columns || []).map((col) => (
                                  <td key={`${section.key}-${idx}-${rowIndex}-${col}`} className="border-b border-slate-100 px-2 py-1.5 text-slate-700 align-top tracking-[-0.01em]">
                                    {row?.[col] === null || row?.[col] === undefined ? '' : typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {(block.rows || []).length > 20 && (
                          <div className="text-[11px] text-slate-400 mt-2 tracking-[-0.01em]">Showing 20 of {(block.rows || []).length} rows.</div>
                        )}
                      </div>
                    ) : (
                      <pre className="text-[12px] whitespace-pre-wrap text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3 max-h-64 overflow-auto tracking-[-0.01em]">
                        {block.text || ''}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderAnalyzerPanel = (reportId) => {
    const payload = analyzerViews[reportId];
    const latestAccuracy = analyzerAccuracy[reportId]?.accuracy || payload?.accuracy || {};
    if (!payload) return <div className="bg-white border border-slate-200/80 rounded-2xl p-4 text-[13px] text-slate-400 tracking-[-0.01em]">Loading analyzer view...</div>;

    const accuracy = latestAccuracy;
    const score = typeof accuracy?.overall_data_quality_score === 'number'
      ? accuracy.overall_data_quality_score
      : typeof accuracy?.score === 'number'
        ? accuracy.score
        : typeof accuracy?.raw_score === 'number'
          ? accuracy.raw_score
          : null;
    const threshold = accuracy.quality_threshold;
    const passed = accuracy.passed;

    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">Analyzer Accuracy</div>
            <button onClick={() => fetchAnalyzerAccuracy(reportId)} className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 text-slate-600 transition-all duration-150 tracking-[-0.01em]">
              Recheck Accuracy
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Quality Score', value: typeof score === 'number' ? `${(score * 100).toFixed(1)}%` : 'N/A' },
              { label: 'Threshold', value: typeof threshold === 'number' ? `${(threshold * 100).toFixed(1)}%` : 'N/A' },
              { label: 'Validation Errors', value: accuracy.validation_errors_count ?? 0 },
              { label: 'Missing Values', value: accuracy.missing_values_count ?? 0 },
            ].map((item) => (
              <div key={item.label} className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest">{item.label}</div>
                <div className="text-lg font-semibold text-slate-800 mt-1 tracking-[-0.025em]">{item.value}</div>
              </div>
            ))}
          </div>
          <div className={`mt-3 text-[11px] font-semibold inline-flex px-2.5 py-1 rounded-lg border tracking-[-0.01em]
            ${passed === true ? 'bg-green-50/80 text-green-700 border-green-200/60' : passed === false ? 'bg-red-50/80 text-red-700 border-red-200/60' : 'bg-slate-50 text-slate-500 border-slate-200/80'}`}>
            Accuracy Gate: {passed === true ? 'PASSED' : passed === false ? 'NOT PASSED' : 'PENDING'}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5">
          <div className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Analytics Output</div>
          <pre className="text-[12px] whitespace-pre-wrap text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3 max-h-80 overflow-auto tracking-[-0.01em]">
            {JSON.stringify(payload.analytics || {}, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* ── Upper Navbar ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 h-14 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-6 lg:px-8 transition-all duration-300">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
              <Layers size={14} color="#fff" />
            </div>
            <div>
              <h1 className="text-[14px] font-semibold text-slate-900 leading-tight tracking-[-0.01em]">Engineering Dashboard</h1>
              <p className="text-[10px] text-slate-400 tracking-wide">Multi-Backend Orchestrator</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/home')} className="text-[12px] font-medium text-slate-400 hover:text-slate-700 transition-colors duration-200 tracking-[-0.01em]">Extraction Hub</button>
          <button onClick={() => navigate('/pipeline')} className="text-[12px] font-medium text-slate-400 hover:text-slate-700 transition-colors duration-200 tracking-[-0.01em]">Pipeline</button>
          <span className="text-[11px] font-mono bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-lg text-slate-500 tracking-[-0.01em]">v2.1</span>
          <div className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors duration-200
            ${backendConnected ? 'bg-green-50/80 text-green-700 border-green-200/60' : 'bg-red-50/80 text-red-700 border-red-200/60'}`}>
            {backendConnected ? '● Connected' : '● Disconnected'}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {!batchId ? (
          <div className="max-w-2xl mx-auto">
            <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
              ${isDragActive ? 'border-slate-400 bg-slate-50 shadow-md' : 'border-slate-200 hover:border-slate-300 bg-white hover:shadow-md'}`}>
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-5">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-200
                  ${isDragActive ? 'bg-slate-200 border border-slate-300' : 'bg-slate-50 border border-slate-200/60'}`}>
                  <Upload size={28} className={isDragActive ? 'text-slate-700' : 'text-slate-400'} />
                </div>
                <div>
                  <p className="text-[15px] font-medium text-slate-700 tracking-[-0.01em]">Drop PDF reports here</p>
                  <p className="text-[13px] text-slate-400 mt-1.5 tracking-[-0.01em]">or click to select multiple files for batch processing</p>
                </div>
              </div>
            </div>

            {uploading && (
              <div className="mt-6 bg-white p-4 rounded-2xl border border-slate-200/80 flex items-center justify-center gap-3 animate-pulse shadow-sm">
                <Loader2 className="animate-spin text-slate-600" size={20} />
                <span className="text-slate-700 font-medium text-[13px] tracking-[-0.01em]">Uploading batch to orchestrator...</span>
              </div>
            )}

            {error && (
              <div className="mt-5 bg-red-50/80 text-red-700 p-4 rounded-2xl border border-red-200/60 flex items-center justify-center gap-2 text-[13px] tracking-[-0.01em]">
                <AlertCircle size={18} /> {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-slate-800 tracking-[-0.025em]">Batch Processing: <span className="font-mono text-[12px] bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-lg">{batchId.slice(0,8)}...</span></h2>
                  {batchStatus?.status === 'completed' && <CheckCircle size={18} className="text-green-500" />}
                </div>
                <p className="text-[13px] text-slate-500 mt-1 tracking-[-0.01em]">
                  Status: <span className={`uppercase font-bold ${batchStatus?.status === 'completed' ? 'text-green-600' : 'text-slate-800'}`}>
                    {batchStatus?.status || 'Initiating...'}
                  </span> · {reports.length} Reports
                </p>
              </div>
              <button
                onClick={() => { setBatchId(null); setReports([]); setReportDetails({}); setExtractionViews({}); setAnalyzerViews({}); setAnalyzerAccuracy({}); setReportViewMode({}); }}
                className="bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:border-slate-300 px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 tracking-[-0.01em]"
              >
                Upload New Batch
              </button>
            </div>

            <div className="space-y-5">
              {reports.map((report, idx) => (
                <div key={report.id || idx} className="bg-white p-6 rounded-2xl border border-slate-200/80 transition-all duration-300 hover:shadow-md shadow-sm">
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <h3 className="font-semibold text-slate-900 text-[16px] flex items-center gap-2 tracking-[-0.025em]">
                        <FileText size={18} className="text-slate-400" /> {report.fileName}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1 font-mono tracking-wide">ID: {report.id}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5
                      ${report.status === 'completed' ? 'bg-green-50/80 text-green-700 border border-green-200/60' :
                        report.status === 'failed' ? 'bg-red-50/80 text-red-700 border border-red-200/60' : 'bg-slate-50 text-slate-600 border border-slate-200/80'}`}>
                      {report.status === 'processing' && <Loader2 size={12} className="animate-spin" />}
                      {report.status}
                    </div>
                  </div>

                  <hr className="border-slate-100 mb-5" />

                  {report.id && reportDetails[report.id] && (
                    <div className="mb-5 space-y-4">
                      <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4">
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Pipeline Tracker</div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                          {normalizePipelineTracker(reportDetails[report.id]).map((stage) => {
                            const cls =
                              stage.status === 'completed' ? 'bg-green-50/80 text-green-700 border-green-200/60' :
                              stage.status === 'running' ? 'bg-slate-900 text-white border-slate-900' :
                              stage.status === 'failed' ? 'bg-red-50/80 text-red-700 border-red-200/60' :
                              stage.status === 'skipped' ? 'bg-amber-50/80 text-amber-700 border-amber-200/60' :
                              'bg-white text-slate-400 border-slate-200/80';
                            return (
                              <div key={stage.stage} className={`text-[10px] uppercase tracking-wide px-2 py-2 rounded-xl border text-center font-semibold transition-all duration-200 ${cls}`}>
                                <div>{stage.stage}</div>
                                <div className="text-[9px] mt-0.5 normal-case opacity-80">{stage.status}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4">
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Data Views & Confidence</div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          {getDataViewStats(reportDetails[report.id]).map((view) => (
                            <div key={view.key} className="bg-white border border-slate-200/80 rounded-xl p-3">
                              <div className="text-[10px] text-slate-400 uppercase tracking-widest">{view.name}</div>
                              <div className="text-lg font-semibold text-slate-800 mt-1 tracking-[-0.025em]">{typeof view.count === 'number' ? view.count : 'N/A'}</div>
                              <div className="text-[10px] text-slate-400">rows</div>
                            </div>
                          ))}
                          <div className="bg-white border border-slate-200/80 rounded-xl p-3">
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest">QUALITY SCORE</div>
                            <div className="text-lg font-semibold text-slate-800 mt-1 tracking-[-0.025em]">
                              {typeof analyzerAccuracy[report.id]?.accuracy?.overall_data_quality_score === 'number'
                                ? `${(analyzerAccuracy[report.id].accuracy.overall_data_quality_score * 100).toFixed(1)}%`
                                : typeof reportDetails[report.id]?.confidence?.overall_data_quality_score === 'number'
                                ? `${(reportDetails[report.id].confidence.overall_data_quality_score * 100).toFixed(1)}%`
                                : typeof reportDetails[report.id]?.confidence?.score === 'number'
                                ? `${(reportDetails[report.id].confidence.score * 100).toFixed(1)}%`
                                : typeof reportDetails[report.id]?.confidence?.raw_score === 'number'
                                ? `${(reportDetails[report.id].confidence.raw_score * 100).toFixed(1)}%`
                                : 'N/A'}
                            </div>
                            <div className="text-[10px] text-slate-400">overall quality</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {report.id && (
                    <div className="mb-5 border border-slate-200/80 rounded-xl bg-slate-50/50 p-1.5 inline-flex gap-1">
                      {['overview', 'extraction', 'analyzer'].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => mode === 'extraction' ? openExtractionView(report.id) : mode === 'analyzer' ? openAnalyzerView(report.id) : setReportViewMode((prev) => ({ ...prev, [report.id]: 'overview' }))}
                          className={`text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all duration-200 tracking-[-0.01em]
                            ${(reportViewMode[report.id] || 'overview') === mode
                              ? 'bg-white border border-slate-200/80 text-slate-800 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          {mode === 'overview' ? 'Overview' : mode === 'extraction' ? 'Extractions' : 'Analyzer'}
                        </button>
                      ))}
                    </div>
                  )}

                  {(reportViewMode[report.id] || 'overview') === 'overview' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {Object.entries(SERVICES_MAP).map(([key, service]) => {
                        const details = reportDetails[report.id];
                        const stageStatusMap = buildStageStatusMap(details);
                        const serviceStatus = resolveServiceStatus(details, key, stageStatusMap);
                        const hasData = serviceStatus === 'completed';
                        const isProcessing = serviceStatus === 'running';
                        const isFailed = serviceStatus === 'failed';
                        const ServiceIcon = service.icon || Activity;

                        return (
                          <div key={key} className={`group relative p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center transition-all duration-200 h-24
                            ${hasData ? 'bg-green-50/50 border-green-200/60' :
                              isFailed ? 'bg-red-50/50 border-red-200/60' :
                              isProcessing ? 'bg-slate-50 border-slate-900 shadow-sm ring-1 ring-slate-900/20' :
                              'bg-slate-50/30 border-slate-200/60 opacity-60'}`}>

                            <div className={`p-2 rounded-xl transition-colors duration-200
                              ${hasData ? 'bg-green-100/80 text-green-600' :
                                isFailed ? 'bg-red-100/80 text-red-600' :
                                isProcessing ? 'bg-slate-100 text-slate-700 animate-pulse' :
                                'bg-slate-100 text-slate-400'}`}>
                              <ServiceIcon size={18} className={isProcessing ? 'animate-spin' : ''} />
                            </div>

                            <div className="text-[11px] font-medium text-slate-600 group-hover:text-slate-900 leading-tight tracking-[-0.01em]">
                              {service.name}
                            </div>

                            {hasData && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle size={12} className="text-green-500" />
                              </div>
                            )}
                            {isFailed && (
                              <div className="absolute top-2 right-2">
                                <XCircle size={12} className="text-red-500" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(reportViewMode[report.id] || 'overview') === 'extraction' && (
                    <div className="mt-2">{renderExtractionPanel(report.id)}</div>
                  )}

                  {(reportViewMode[report.id] || 'overview') === 'analyzer' && (
                    <div className="mt-2">{renderAnalyzerPanel(report.id)}</div>
                  )}

                  {reportDetails[report.id]?.pdf_path && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                      <a
                        href={`${API_BASE}/reports/${report.id}/download`}
                        download
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 shadow-sm hover:shadow-md tracking-[-0.01em]"
                      >
                        <FileText size={14} /> Download Analysis Report
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default DashboardApp;
