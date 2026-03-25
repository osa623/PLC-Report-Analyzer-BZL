import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, FileText, CheckCircle, XCircle, Activity, 
  DollarSign, PieChart, BarChart2, ShieldCheck, 
  Layers, AlertCircle, Loader2 
} from 'lucide-react';

const API_BASE = '/api';

const PIPELINE_STAGE_SEQUENCE = [
    'UPLOAD',
    'PARSING',
    'STRUCTURE',
    'EXTRACTION',
    'AGGREGATION',
    'VALIDATION',
    'ANALYTICS',
    'REPORT',
];

const SERVICE_STAGE_MAP = {
    parsed_document: 'PARSING',
    structure: 'STRUCTURE',
    income_statement: 'EXTRACTION',
    balance_sheet: 'EXTRACTION',
    cashflow_statement: 'EXTRACTION',
    segments: 'EXTRACTION',
    governance: 'EXTRACTION',
    risk: 'EXTRACTION',
    esg: 'EXTRACTION',
    oci_statement: 'EXTRACTION',
    equity_statement: 'EXTRACTION',
    validation: 'VALIDATION',
    strategy: 'ANALYTICS',
    kpi: 'ANALYTICS',
    patterns: 'ANALYTICS',
    financial_ratios: 'ANALYTICS',
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
  esg: { name: "ESG", icon: FileText }, // Replaced Microscope
  strategy: { name: "Strategy", icon: Activity }, // Replaced BrainCircuit
  kpi: { name: "KPIs", icon: BarChart2 }, // Replaced TrendingUp
  patterns: { name: "Patterns", icon: Activity }, // Replaced BrainCircuit
  generated_report: { name: "Report Gen", icon: CheckCircle }, // Replaced FileCheck
  financial_ratios: { name: "Ratios", icon: PieChart }, // Replaced Scale
  oci_statement: { name: "OCI", icon: FileText },
  equity_statement: { name: "Equity", icon: BarChart2 },
  validation: { name: "Validation", icon: ShieldCheck },
};

function DashboardApp() {
  const [batchId, setBatchId] = useState(null);
  const [reports, setReports] = useState([]);
  const [batchStatus, setBatchStatus] = useState(null);
  const [reportDetails, setReportDetails] = useState({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
    const [backendConnected, setBackendConnected] = useState(true);

    const normalizePipelineTracker = (details) => {
        const tracker = details?.pipeline_tracker;
        if (Array.isArray(tracker) && tracker.length > 0) {
            return tracker;
        }

        const wfState = details?.workflow_state;
        const fallbackIndex = {
            UPLOADED: 0,
            PARSING: 1,
            STRUCTURE_DETECTED: 2,
            EXTRACTING: 3,
            AGGREGATING: 4,
            VALIDATING: 5,
            LOW_CONFIDENCE: 5,
            ANALYZING: 6,
            GENERATING_REPORT: 7,
            COMPLETED: 7,
            FAILED: -1,
        };

        const current = fallbackIndex[wfState] ?? 0;

        return PIPELINE_STAGE_SEQUENCE.map((stage, idx) => {
            let status = 'pending';
            if (wfState === 'FAILED' && idx >= Math.max(0, current)) status = 'failed';
            else if (current > idx) status = 'completed';
            else if (current === idx) status = 'running';
            if (wfState === 'LOW_CONFIDENCE' && (stage === 'ANALYTICS' || stage === 'REPORT')) {
                status = 'skipped';
            }
            return { stage, status };
        });
    };

    const getDataViewStats = (details) => {
        const raw = details?.data_views?.raw_data;
        const cleaned = details?.data_views?.cleaned_data;
        const validated = details?.data_views?.validated_data;

        return [
            {
                key: 'raw',
                name: 'RAW DATA',
                count: Array.isArray(raw?.rows) ? raw.rows.length : Array.isArray(raw) ? raw.length : null,
            },
            {
                key: 'cleaned',
                name: 'CLEANED DATA',
                count: Array.isArray(cleaned?.rows) ? cleaned.rows.length : Array.isArray(cleaned) ? cleaned.length : null,
            },
            {
                key: 'validated',
                name: 'VALIDATED DATA',
                count: Array.isArray(validated?.validated_rows)
                    ? validated.validated_rows.length
                    : Array.isArray(validated?.rows)
                    ? validated.rows.length
                    : Array.isArray(validated)
                    ? validated.length
                    : null,
            },
        ];
    };

    const buildStageStatusMap = (details) => {
        return normalizePipelineTracker(details).reduce((acc, stage) => {
            acc[stage.stage] = stage.status;
            return acc;
        }, {});
    };

    const resolveServiceStatus = (details, key, stageStatusMap) => {
        if (!details) return 'pending';

        const hasRaw = !!details?.data_views?.raw_data;
        const hasValidated = !!details?.data_views?.validated_data;
        const hasNarrative = {
            governance: !!details?.narratives?.governance,
            risk: !!details?.narratives?.risk,
            esg: !!details?.narratives?.esg,
            strategy: !!details?.narratives?.strategy,
        };
        const hasAnalytics = {
            kpi: !!details?.analytics?.sector_kpis,
            patterns: !!details?.analytics?.patterns,
            financial_ratios: !!details?.analytics?.ratios,
        };

        if (key === 'generated_report' && details?.pdf_path) return 'completed';
        if (key === 'validation' && hasValidated) return 'completed';
        if (['income_statement', 'balance_sheet', 'cashflow_statement', 'segments', 'oci_statement', 'equity_statement'].includes(key) && hasRaw) {
            return 'completed';
        }
        if (hasNarrative[key]) return 'completed';
        if (hasAnalytics[key]) return 'completed';

        const stage = SERVICE_STAGE_MAP[key];
        if (stage && stageStatusMap[stage]) {
            return stageStatusMap[stage];
        }

        if (details.workflow_state === 'COMPLETED') return 'completed';
        if (details.workflow_state === 'FAILED') return 'failed';
        return 'pending';
    };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    setUploading(true);
    setError(null);
    
    const formData = new FormData();
    // The backend expects key "reports" for multiple files
    acceptedFiles.forEach(file => {
      formData.append('reports', file);
    });

    // Valid dummy metadata
    formData.append('symbol', 'BATCH');
    formData.append('name', 'Batch Upload');
    formData.append('sector', 'Diversified');

    try {
      const res = await axios.post(`${API_BASE}/reports/batch`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const { batchId, reports } = res.data;
      setBatchId(batchId);
      
      const initialReports = reports.map(r => ({
        id: r.report.id,
        fileName: r.originalName,
        status: 'pending'
      }));
      setReports(initialReports);
      
    } catch (err) {
      console.error(err);
      setError("Upload failed. Please check connection and try again.");
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    useEffect(() => {
        const checkHealth = async () => {
            try {
                await axios.get(`${API_BASE}/health`);
                setBackendConnected(true);
            } catch (_) {
                setBackendConnected(false);
            }
        };

        checkHealth();
        const interval = setInterval(checkHealth, 10000);
        return () => clearInterval(interval);
    }, []);

  // Poll for batch status
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
                    // Update main status from batch endpoint
                    const index = updated.findIndex(u => u.fileName === r.fileName);
                    if (index !== -1) {
                         updated[index].status = r.status;
                         if (r.reportId && !updated[index].id) updated[index].id = r.reportId;
                    }
                });
                return updated;
             });
          }
        }
      } catch (err) {
        console.error("Batch poll warning", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [batchId]);

  // Poll for detailed status of each report
  useEffect(() => {
    if (reports.length === 0) return;

    const interval = setInterval(async () => {
        reports.forEach(async (report) => {
            if (!report.id) return;
            try {
                const res = await axios.get(`${API_BASE}/reports/${report.id}`);
                setReportDetails(prev => ({
                    ...prev,
                    [report.id]: res.data
                }));
            } catch (e) {
                // Squelch errors for now
            }
        });
    }, 3000);

    return () => clearInterval(interval);
  }, [reports]);

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 pb-20">
      <header className="bg-white border-b border-gray-200 px-8 py-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-blue-600 text-white p-2 rounded-lg">
                    <Layers size={24} />
                </div>
                <div>
                    <h1 className="text-xl font-bold leading-tight">PLC Report Analyzer</h1>
                    <p className="text-xs text-gray-500">Engineering Dashboard • Multi-Backend Orchestrator</p>
                </div>
            </div>
            <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                v2.1 Backends: 18
            </div>
            <div className={`text-xs font-semibold px-2 py-1 rounded border ${backendConnected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                API {backendConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        {!batchId ? (
            <div className="max-w-2xl mx-auto">
                <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all duration-200
                    ${isDragActive ? 'border-blue-500 bg-blue-50 scale-105' : 'border-gray-300 hover:border-blue-400 bg-white hover:shadow-lg'}`}>
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center gap-6">
                        <div className={`p-6 rounded-full ${isDragActive ? 'bg-blue-200 text-blue-700' : 'bg-blue-50 text-blue-600'}`}>
                            <Upload size={48} />
                        </div>
                        <div>
                            <p className="text-xl font-medium text-gray-800">Drop PDF reports here</p>
                            <p className="text-sm text-gray-500 mt-2">or click to select multiple files for batch processing</p>
                        </div>
                    </div>
                </div>
                
                {uploading && (
                    <div className="mt-8 bg-white p-4 rounded-lg shadow-sm border border-blue-100 flex items-center justify-center gap-3 animate-pulse">
                        <Loader2 className="animate-spin text-blue-600" size={24}/> 
                        <span className="text-blue-800 font-medium">Uploading batch to orchestrator...</span>
                    </div>
                )}
                
                {error && (
                    <div className="mt-6 bg-red-50 text-red-700 p-4 rounded-lg border border-red-100 flex items-center justify-center gap-2">
                        <AlertCircle size={20}/> {error}
                    </div>
                )}
            </div>
        ) : (
            <div className="space-y-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold text-gray-800">Batch Processing: <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{batchId.slice(0,8)}...</span></h2>
                            {batchStatus?.status === 'completed' && <CheckCircle size={20} className="text-green-500"/>}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Status: <span className={`uppercase font-bold ${batchStatus?.status === 'completed' ? 'text-green-600' : 'text-blue-600'}`}>
                                {batchStatus?.status || 'Initiating...'}
                            </span>
                             • {reports.length} Reports
                        </p>
                    </div>
                    <button 
                        onClick={() => { setBatchId(null); setReports([]); setReportDetails({}); }} 
                        className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        Upload New Batch
                    </button>
                </div>

                <div className="grid gap-6">
                    {reports.map((report, idx) => (
                        <div key={report.id || idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                                        <FileText size={20} className="text-blue-500"/> {report.fileName}
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-1 font-mono">ID: {report.id}</p>
                                </div>
                                <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5
                                    ${report.status === 'completed' ? 'bg-green-100 text-green-700' : 
                                      report.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                                    {report.status === 'processing' && <Loader2 size={12} className="animate-spin"/>}
                                    {report.status}
                                </div>
                            </div>
                            
                            <hr className="border-gray-100 mb-6"/>

                            {report.id && reportDetails[report.id] && (
                                <div className="mb-6 space-y-4">
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                        <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">Pipeline Tracker</div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                                            {normalizePipelineTracker(reportDetails[report.id]).map((stage) => {
                                                const statusClass =
                                                    stage.status === 'completed'
                                                        ? 'bg-green-100 text-green-700 border-green-200'
                                                        : stage.status === 'running'
                                                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                                                        : stage.status === 'failed'
                                                        ? 'bg-red-100 text-red-700 border-red-200'
                                                        : stage.status === 'skipped'
                                                        ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                                        : 'bg-white text-gray-500 border-gray-200';

                                                return (
                                                    <div
                                                        key={stage.stage}
                                                        className={`text-[10px] uppercase tracking-wide px-2 py-2 rounded border text-center font-semibold ${statusClass}`}
                                                    >
                                                        <div>{stage.stage}</div>
                                                        <div className="text-[9px] mt-1 normal-case">{stage.status}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                        <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">Data Views & Confidence</div>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                            {getDataViewStats(reportDetails[report.id]).map((view) => (
                                                <div key={view.key} className="bg-white border border-gray-200 rounded p-3">
                                                    <div className="text-[10px] text-gray-500 uppercase">{view.name}</div>
                                                    <div className="text-lg font-semibold text-gray-800 mt-1">
                                                        {typeof view.count === 'number' ? view.count : 'N/A'}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400">rows</div>
                                                </div>
                                            ))}
                                            <div className="bg-white border border-gray-200 rounded p-3">
                                                <div className="text-[10px] text-gray-500 uppercase">QUALITY SCORE</div>
                                                <div className="text-lg font-semibold text-gray-800 mt-1">
                                                    {typeof reportDetails[report.id]?.confidence?.overall_data_quality_score === 'number'
                                                        ? `${(reportDetails[report.id].confidence.overall_data_quality_score * 100).toFixed(1)}%`
                                                        : 'N/A'}
                                                </div>
                                                <div className="text-[10px] text-gray-400">overall_data_quality_score</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {Object.entries(SERVICES_MAP).map(([key, service]) => {
                                    const details = reportDetails[report.id];
                                    const stageStatusMap = buildStageStatusMap(details);
                                    const serviceStatus = resolveServiceStatus(details, key, stageStatusMap);
                                    const hasData = serviceStatus === 'completed';
                                    const isProcessing = serviceStatus === 'running';
                                    const isFailed = serviceStatus === 'failed';
                                    const ServiceIcon = service.icon || Activity;
                                    
                                    return (
                                        <div key={key} className={`group relative p-3 rounded-lg border flex flex-col items-center justify-center gap-2 text-center transition-all h-24
                                            ${hasData ? 'bg-green-50 border-green-200' :
                                              isFailed ? 'bg-red-50 border-red-200' :
                                              isProcessing ? 'bg-blue-50 border-blue-200 shadow-md ring-2 ring-blue-100' : 
                                              'bg-gray-50 border-gray-100 opacity-70'}`}>
                                            
                                            <div className={`p-2 rounded-full ${hasData ? 'bg-green-100 text-green-600' : isFailed ? 'bg-red-100 text-red-600' : isProcessing ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-gray-200 text-gray-400'}`}>
                                                <ServiceIcon size={20} className={isProcessing ? 'animate-spin' : ''} />
                                            </div>
                                            
                                            <div className="text-xs font-medium text-gray-600 group-hover:text-gray-900 leading-tight">
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
                            
                            {/* Download Section */}
                            {reportDetails[report.id]?.pdf_path && (
                                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                                    <a 
                                        href={`${API_BASE}/reports/${report.id}/download`} 
                                        download
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                                    >
                                        <FileText size={16} /> Download Analysis Report
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
