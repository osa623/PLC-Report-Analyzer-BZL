import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, FileText, CheckCircle, XCircle, Activity, 
  DollarSign, PieChart, BarChart2, ShieldCheck, 
  Layers, AlertCircle, Loader2, Download, Table2, AlignLeft,
  ChevronRight, X, AlertTriangle
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
  
  // Issues widget
  const [showIssuesWidget, setShowIssuesWidget] = useState(false);

  const gatherIssues = useCallback(() => {
    const issues = [];
    if (error) issues.push({ type: 'Global', message: error, id: 'global-err' });
    if (!backendConnected) issues.push({ type: 'Connection', message: 'API is disconnected. Start backends and retry.', id: 'conn-err' });
    
    reports.forEach(r => {
        if (r.status === 'failed') {
            issues.push({ type: 'Report Failed', report: r.fileName, message: 'Processing workflow failed.', id: `fail-${r.id || r.fileName}` });
        }
        if (r.id) {
            const acc = analyzerAccuracy[r.id]?.accuracy;
            if (acc) {
                if (acc.validation_errors_count > 0) {
                    issues.push({ type: 'Validation Errors', report: r.fileName, message: `${acc.validation_errors_count} validation errors detected.`, id: `val-${r.id}` });
                }
                if (acc.missing_values_count > 0) {
                    issues.push({ type: 'Missing Values', report: r.fileName, message: `${acc.missing_values_count} missing values found.`, id: `miss-${r.id}` });
                }
                if (acc.passed === false) {
                     issues.push({ type: 'Quality Gate', report: r.fileName, message: 'Quality gate threshold not passed.', id: `qg-${r.id}` });
                }
            }
        }
    });

    return issues;
  }, [error, backendConnected, reports, analyzerAccuracy]);

  const allIssues = gatherIssues();
  const hasIssues = allIssues.length > 0;

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
      { key: 'raw', name: 'Raw Data', count: Array.isArray(raw?.rows) ? raw.rows.length : Array.isArray(raw) ? raw.length : null },
      { key: 'cleaned', name: 'Cleaned', count: Array.isArray(cleaned?.rows) ? cleaned.rows.length : Array.isArray(cleaned) ? cleaned.length : null },
      { key: 'validated', name: 'Validated', count: Array.isArray(validated?.validated_rows) ? validated.validated_rows.length : Array.isArray(validated?.rows) ? validated.rows.length : Array.isArray(validated) ? validated.length : null },
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
    if (!payload) return <div className="bg-white border border-gray-200 rounded-lg p-3 text-[12px] text-gray-500">Loading extraction sections...</div>;
    const sections = Array.isArray(payload.sections) ? payload.sections : [];
    if (sections.length === 0) return <div className="bg-white border border-gray-200 rounded-lg p-3 text-[12px] text-gray-500">No extraction sections available yet.</div>;

    return (
      <div className="space-y-3">
        {sections.map((section) => {
          const SectionIcon = getSectionIcon(section.key);
          return (
            <div key={section.key} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <SectionIcon size={14} className="text-blue-600" />
                  <h4 className="text-[12px] font-semibold text-gray-800">
                    {section.label || EXTRACTION_LABEL_MAP[section.key] || section.key}
                  </h4>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {EXTRACTION_DOWNLOAD_FORMATS.map((fmt) => (
                    <a
                      key={`${section.key}-${fmt}`}
                      href={`${API_BASE}/reports/${reportId}/extractions/${section.key}/download?format=${fmt}`}
                      className="text-[10px] px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-50 text-gray-700 flex items-center gap-1 transition-all"
                    >
                      <Download size={10} /> {fmt.toUpperCase()}
                    </a>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {(section.blocks || []).map((block, idx) => (
                  <div key={`${section.key}-block-${idx}`} className="border border-gray-100 rounded p-2.5">
                    <div className="text-[9px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5 flex items-center gap-1.5">
                      {block.type === 'table' ? <Table2 size={10} /> : <AlignLeft size={10} />}
                      {block.type} {block.title ? `· ${block.title}` : ''}
                    </div>
                    {block.type === 'table' ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-[11px] border-collapse">
                          <thead>
                            <tr>
                              {(block.columns || []).map((col) => (
                                <th key={col} className="text-left border-b border-gray-200 px-1.5 py-1 font-semibold text-gray-700">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(block.rows || []).slice(0, 10).map((row, rowIndex) => (
                              <tr key={`${section.key}-${idx}-${rowIndex}`} className="hover:bg-gray-50/50">
                                {(block.columns || []).map((col) => (
                                  <td key={`${section.key}-${idx}-${rowIndex}-${col}`} className="border-b border-gray-100 px-1.5 py-1 text-gray-700 align-top">
                                    {row?.[col] === null || row?.[col] === undefined ? '' : typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {(block.rows || []).length > 10 && (
                          <div className="text-[10px] text-gray-500 mt-1.5">Showing 10 of {(block.rows || []).length} rows.</div>
                        )}
                      </div>
                    ) : (
                      <pre className="text-[11px] whitespace-pre-wrap text-gray-700 bg-gray-50 border border-gray-100 rounded p-2 max-h-40 overflow-auto">
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
    if (!payload) return <div className="bg-white border border-gray-200 rounded-lg p-3 text-[12px] text-gray-500">Loading analyzer view...</div>;

    return (
      <div className="space-y-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Analytics Output</div>
            <button onClick={() => fetchAnalyzerAccuracy(reportId)} className="text-[10px] px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-700 transition-all">
               Refresh Analysis
            </button>
          </div>
          <pre className="text-[11px] whitespace-pre-wrap text-gray-700 bg-gray-50 border border-gray-100 rounded p-3 max-h-60 overflow-auto">
            {JSON.stringify(payload.analytics || {}, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 pb-20 relative">
      <header className="bg-white border-b border-gray-200 px-8 py-4 shadow-sm sticky top-0 z-40">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-blue-600 text-white p-2 rounded-lg">
                    <Layers size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-bold leading-tight text-gray-900">PLC Report Analyzer</h1>
                  <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold mt-0.5">Engineering Dashboard • Multi-Backend Orchestrator</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono bg-gray-100 px-2 py-1 rounded border border-gray-200 text-gray-600">v2.1</span>
              <div className={`text-[11px] font-semibold px-2 py-1 rounded border
                ${backendConnected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                API {backendConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </div>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        {!batchId ? (
          <div className="max-w-2xl mx-auto">
            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
              ${isDragActive ? 'border-blue-500 bg-blue-50 shadow-sm scale-105' : 'border-gray-300 hover:border-blue-400 bg-white hover:shadow-sm'}`}>
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4">
                <div className={`p-5 rounded-full transition-colors duration-200
                  ${isDragActive ? 'bg-blue-200 text-blue-700' : 'bg-blue-50 text-blue-600'}`}>
                  <Upload size={32} />
                </div>
                <div>
                  <p className="text-[16px] font-medium text-gray-800">Drop PDF reports here</p>
                  <p className="text-[13px] text-gray-500 mt-1">or click to select multiple files for batch processing</p>
                </div>
              </div>
            </div>

            {uploading && (
              <div className="mt-4 bg-white p-3 rounded-lg border border-blue-100 shadow-sm flex items-center justify-center gap-3 animate-pulse">
                <Loader2 className="animate-spin text-blue-600" size={16} />
                <span className="text-blue-800 font-medium text-[13px]">Uploading batch to orchestrator...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-semibold text-gray-800">Batch Processing: <span className="font-mono text-[12px] bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded text-gray-600">{batchId.slice(0,8)}...</span></h2>
                  {batchStatus?.status === 'completed' && <CheckCircle size={16} className="text-green-500" />}
                </div>
                <p className="text-[13px] text-gray-500 mt-0.5">
                  Status: <span className={`uppercase font-semibold ${batchStatus?.status === 'completed' ? 'text-green-600' : 'text-blue-600'}`}>
                    {batchStatus?.status || 'Initiating...'}
                  </span> · {reports.length} Reports
                </p>
              </div>
              <button
                onClick={() => { setBatchId(null); setReports([]); setReportDetails({}); setExtractionViews({}); setAnalyzerViews({}); setAnalyzerAccuracy({}); setReportViewMode({}); }}
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all"
              >
                Upload New Batch
              </button>
            </div>

            <div className="space-y-4">
              {reports.map((report, idx) => {
                const details = reportDetails[report.id];
                const stageStatusMap = buildStageStatusMap(details);
                const qualityScoreRaw = analyzerAccuracy[report.id]?.accuracy?.overall_data_quality_score ?? details?.confidence?.overall_data_quality_score;
                const qualityScoreText = typeof qualityScoreRaw === 'number' ? `${(qualityScoreRaw * 100).toFixed(1)}%` : 'N/A';

                return (
                 <div key={report.id || idx} className="bg-white p-5 rounded-xl border border-gray-200 transition-all hover:shadow-md shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
                          <FileText size={18} className="text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-[15px] leading-tight">
                          {report.fileName}
                        </h3>
                        <p className="text-[11px] text-gray-400 font-mono">ID: {report.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5
                          ${report.status === 'completed' ? 'bg-green-100 text-green-700' :
                            report.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                          {report.status === 'processing' && <Loader2 size={10} className="animate-spin" />}
                          {report.status}
                        </div>
                    </div>
                  </div>

                  {report.id && details && (
                    <div className="mb-4 space-y-3">
                      {/* Compact Pipeline Tracker inline row */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 flex flex-col md:flex-row items-center gap-4 overflow-x-auto no-scrollbar">
                         <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold whitespace-nowrap">Pipeline Track</div>
                         <div className="flex items-center gap-1 flex-1 w-full md:w-auto overflow-x-auto min-w-0">
                           {normalizePipelineTracker(details).map((stage, i, arr) => {
                              const cls =
                                stage.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
                                stage.status === 'running' ? 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse' :
                                stage.status === 'failed' ? 'bg-red-100 text-red-700 border-red-200' :
                                stage.status === 'skipped' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                'bg-white text-gray-500 border-gray-200';
                              return (
                                <React.Fragment key={stage.stage}>
                                  <div className={`flex shrink-0 items-center gap-1.5 px-2 py-1 rounded border text-[9px] uppercase tracking-wider font-semibold ${cls}`}>
                                     {stage.stage}
                                  </div>
                                  {i < arr.length - 1 && <ChevronRight size={10} className="text-gray-300 shrink-0" />}
                                </React.Fragment>
                              );
                           })}
                         </div>
                      </div>

                      {/* Compact Data Views & Quality Row */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
                           <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Data Views & Quality</div>
                           <div className="w-[1px] h-3 bg-gray-300 hidden sm:block"></div>
                           {getDataViewStats(details).map((view) => (
                              <div key={view.key} className="flex items-center gap-1.5 text-[12px]">
                                 <span className="text-gray-500">{view.name}:</span>
                                 <span className="font-semibold text-gray-800">{typeof view.count === 'number' ? view.count : '-'}</span>
                              </div>
                           ))}
                           <div className="w-[1px] h-3 bg-gray-300 hidden sm:block"></div>
                           <div className="flex items-center gap-1.5 text-[12px]">
                                 <span className="text-gray-500">Quality Score:</span>
                                 <span className={`font-semibold ${typeof qualityScoreRaw === 'number' && qualityScoreRaw < 0.8 ? 'text-yellow-600' : 'text-green-600'}`}>
                                    {qualityScoreText}
                                 </span>
                           </div>
                      </div>
                    </div>
                  )}

                  {report.id && (
                    <div className="mb-4 bg-gray-50 border border-gray-200 rounded p-1 inline-flex gap-1">
                      {['overview', 'extraction', 'analyzer'].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => mode === 'extraction' ? openExtractionView(report.id) : mode === 'analyzer' ? openAnalyzerView(report.id) : setReportViewMode((prev) => ({ ...prev, [report.id]: 'overview' }))}
                          className={`text-[12px] px-3 py-1.5 rounded transition-all font-medium
                            ${(reportViewMode[report.id] || 'overview') === mode
                              ? 'bg-white border border-gray-300 text-gray-800 shadow-sm'
                              : 'text-gray-600 hover:text-gray-800'}`}
                        >
                          {mode === 'overview' ? 'Overview' : mode === 'extraction' ? 'Extractions' : 'Analyzer'}
                        </button>
                      ))}
                    </div>
                  )}

                  {(reportViewMode[report.id] || 'overview') === 'overview' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                      {Object.entries(SERVICES_MAP).map(([key, service]) => {
                        const serviceStatus = resolveServiceStatus(details, key, stageStatusMap);
                        const hasData = serviceStatus === 'completed';
                        const isProcessing = serviceStatus === 'running';
                        const isFailed = serviceStatus === 'failed';
                        const ServiceIcon = service.icon || Activity;

                        return (
                          <div key={key} title={service.name} className={`relative px-2 py-2 rounded-lg border flex items-center gap-2 transition-all h-10
                            ${hasData ? 'bg-green-50 border-green-200' :
                              isFailed ? 'bg-red-50 border-red-200' :
                              isProcessing ? 'bg-blue-50 border-blue-200 shadow-sm' :
                              'bg-transparent border-gray-200 opacity-70 hover:opacity-100'}`}>
                            
                            <div className={`${hasData ? 'text-green-600' : isFailed ? 'text-red-500' : isProcessing ? 'text-blue-600 animate-pulse' : 'text-gray-400'}`}>
                                <ServiceIcon size={14} className={isProcessing ? 'animate-spin' : ''} />
                            </div>
                            
                            <div className="text-[11px] font-medium text-gray-700 truncate tracking-tight flex-1">
                              {service.name}
                            </div>
                            
                            {hasData && <CheckCircle size={12} className="text-green-500 shrink-0" />}
                            {isFailed && <XCircle size={12} className="text-red-500 shrink-0" />}
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

                  {details?.pdf_path && (
                    <div className="mt-5 pt-4 border-t border-gray-100 flex justify-end">
                      <a
                        href={`${API_BASE}/reports/${report.id}/download`}
                        download
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-[13px] font-medium transition-all shadow-sm"
                      >
                        <FileText size={14} /> Download Analysis Report
                      </a>
                    </div>
                  )}
                 </div>
               );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── Issues pop-out button Widget ────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50">
         <button 
            onClick={() => setShowIssuesWidget(!showIssuesWidget)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-[13px] shadow-lg border transition-all duration-300
               ${hasIssues ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 shadow-red-500/20' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-gray-200/50'}
            `}
         >
            {hasIssues ? <AlertTriangle size={16} className="text-red-500" /> : <CheckCircle size={16} className="text-gray-400" />}
            <span>Issues & Warnings</span>
            {hasIssues && <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">{allIssues.length}</span>}
         </button>
      </div>

      {/* ── Issues Panel ────────────────────────────────────────────── */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white border-l border-gray-200 shadow-2xl z-[60] transform transition-transform duration-300 ease-in-out ${showIssuesWidget ? 'translate-x-0' : 'translate-x-full'}`}>
         <div className="h-16 border-b border-gray-100 flex items-center justify-between px-5 bg-gray-50">
            <h3 className="text-[14px] font-bold text-gray-800 flex items-center gap-2">
               <AlertTriangle size={16} className={hasIssues ? 'text-red-500' : 'text-gray-400'} /> System Log
            </h3>
            <button onClick={() => setShowIssuesWidget(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-md hover:bg-gray-200">
               <X size={18} />
            </button>
         </div>
         <div className="p-5 overflow-y-auto h-[calc(100vh-64px)] scrollbar-hide">
            {!hasIssues ? (
               <div className="text-center py-12">
                  <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                     <CheckCircle size={24} className="text-green-500" />
                  </div>
                  <p className="text-[14px] font-medium text-gray-800">All Systems Normal</p>
                  <p className="text-[12px] text-gray-500 mt-1">No errors or warnings found.</p>
               </div>
            ) : (
               <div className="space-y-4">
                  {allIssues.map((issue, idx) => (
                     <div key={issue.id || idx} className="bg-red-50 border border-red-100 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] uppercase font-bold tracking-widest text-red-700/80">{issue.type}</span>
                           {issue.report && <span className="text-[9px] text-gray-500 border border-gray-200 bg-white px-1.5 py-0.5 rounded uppercase tracking-wider truncate max-w-[120px] shadow-sm">{issue.report}</span>}
                        </div>
                        <p className="text-[13px] font-medium text-gray-800 leading-snug">{issue.message}</p>
                     </div>
                  ))}
               </div>
            )}
         </div>
      </div>
      
      {/* Overlay for panel */}
      {showIssuesWidget && (
         <div className="fixed inset-0 bg-gray-900/20 z-[55] backdrop-blur-[1px] transition-opacity" onClick={() => setShowIssuesWidget(false)}></div>
      )}

    </div>
  );
}

export default DashboardApp;
