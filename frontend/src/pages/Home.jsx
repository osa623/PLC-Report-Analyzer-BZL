import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pdfService } from '../services/api';
import { useCredits } from '../utils/CreditContext';
import InsufficientCreditsModal from '../components/InsufficientCreditsModal';
import InteractiveDataTable from '../components/InteractiveDataTable';
import ReportBuilderPanel from '../components/ReportBuilderPanel';
import ReviewPanel from '../components/ReviewPanel';
import AnalysisHistory from '../components/AnalysisHistory';
import ExportSection from '../components/ExportSection';

// Dashboard Components
import BatchSelector from '../components/dashboard/BatchSelector';
import ExecutiveSummary from '../components/dashboard/ExecutiveSummary';
import FinancialHealthOverview from '../components/dashboard/FinancialHealthOverview';
import RatioAnalysisDashboard from '../components/dashboard/RatioAnalysisDashboard';
import TrendAnalysisCharts from '../components/dashboard/TrendAnalysisCharts';
import BalanceSheetVisualization from '../components/dashboard/BalanceSheetVisualization';
import ProfitabilityDashboard from '../components/dashboard/ProfitabilityDashboard';
import CashFlowDashboard from '../components/dashboard/CashFlowDashboard';
import RiskAnalysisDashboard from '../components/dashboard/RiskAnalysisDashboard';
import QualityGateDashboard from '../components/dashboard/QualityGateDashboard';
import DiagnosticsDashboard from '../components/dashboard/DiagnosticsDashboard';
import {
    ArrowUpTrayIcon,
    DocumentTextIcon,
    ArrowPathIcon,
    ArrowDownTrayIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    XMarkIcon,
    TableCellsIcon,
    BanknotesIcon,
    BuildingLibraryIcon,
    CurrencyDollarIcon,
    ChartBarSquareIcon,
    ScaleIcon,
    ShieldCheckIcon,
    DocumentArrowDownIcon,
    BoltIcon,
} from '@heroicons/react/24/outline';

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------
const EXTRACTION_SECTIONS = [
    {
        key: 'income_statement',
        title: 'Income Statement',
        shortTitle: 'Income',
        description: 'Revenue, expenses, and net profit/loss.',
        icon: BanknotesIcon,
        category: 'Financial Statements',
    },
    {
        key: 'balance_sheet',
        title: 'Financial Position',
        shortTitle: 'Balance Sheet',
        description: 'Assets, liabilities, and equity.',
        icon: BuildingLibraryIcon,
        category: 'Financial Statements',
    },
    {
        key: 'cash_flow',
        title: 'Cash Flow',
        shortTitle: 'Cash Flow',
        description: 'Operating, investing, and financing.',
        icon: CurrencyDollarIcon,
        category: 'Financial Statements',
    },
    {
        key: 'comprehensive_income',
        title: 'Comprehensive Income',
        shortTitle: 'OCI',
        description: 'Profit or loss plus OCI items.',
        icon: ChartBarSquareIcon,
        category: 'Financial Statements',
    },
    {
        key: 'changes_in_equity',
        title: 'Changes in Equity',
        shortTitle: 'Equity',
        description: 'Share capital, reserves, retained earnings.',
        icon: ScaleIcon,
        category: 'Financial Statements',
    },
    {
        key: 'auditors_report',
        title: "Auditor's Report",
        shortTitle: 'Audit',
        description: 'Audit opinion and key matters.',
        icon: ShieldCheckIcon,
        category: 'Financial Statements',
    },
    {
        key: 'future_outlook',
        title: 'Future Outlook',
        shortTitle: 'Outlook',
        description: 'Forward-looking statements and growth expectations.',
        icon: ChartBarSquareIcon,
        category: 'Extended Sections',
    },
    {
        key: 'corporate_governance',
        title: 'Corporate Governance',
        shortTitle: 'Governance',
        description: 'Board, governance framework, and compliance details.',
        icon: ShieldCheckIcon,
        category: 'Extended Sections',
    },
    {
        key: 'esg_report',
        title: 'ESG Report',
        shortTitle: 'ESG',
        description: 'Environmental, social, and governance disclosures.',
        icon: ScaleIcon,
        category: 'Extended Sections',
    },
    {
        key: 'shareholding',
        title: 'Shareholding Information',
        shortTitle: 'Shareholding',
        description: 'Ownership structure and major shareholders.',
        icon: BuildingLibraryIcon,
        category: 'Extended Sections',
    },
    {
        key: 'notes_financial_statements',
        title: 'Notes to Financial Statements',
        shortTitle: 'Notes',
        description: 'Supporting notes and accounting policy details.',
        icon: DocumentTextIcon,
        category: 'Extended Sections',
    },
    {
        key: 'subsidiaries',
        title: 'Subsidiaries',
        shortTitle: 'Subsidiaries',
        description: 'Subsidiary entities and group structure information.',
        icon: BuildingLibraryIcon,
        category: 'Extended Sections',
    },
    {
        key: 'company_overview',
        title: 'About the Company',
        shortTitle: 'Company',
        description: 'Company profile, business model, and overview.',
        icon: DocumentTextIcon,
        category: 'Extended Sections',
    },
];

const EXTRACTION_SESSION_KEY = 'plc.extraction.session.v1';

const sectionStateFromFullReport = (resultData = {}) => {
    const next = {};
    EXTRACTION_SECTIONS.forEach((sec) => {
        const data = resultData[sec.key] || null;
        next[sec.key] = {
            status: data ? 'done' : 'error',
            data,
            error: data ? null : 'Section not found in report',
        };
    });
    return next;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Inline progress shown inside each card while extracting */
const CardProgress = ({ sectionTitle }) => {
    const [step, setStep] = useState(0);
    const timerRef = useRef(null);

    const labels = [
        'Preparing...',
        'Uploading to System',
        'Analysing document',
        `Extracting ${sectionTitle}`,
        'Parsing results',
    ];

    useEffect(() => {
        setStep(1);
        const delays = [2200, 4500, 6000, 40000];
        let i = 0;
        const next = () => {
            i++;
            if (i < labels.length) {
                setStep(i + 1);
                if (i < delays.length) timerRef.current = setTimeout(next, delays[i]);
            }
        };
        timerRef.current = setTimeout(next, delays[0]);
        return () => clearTimeout(timerRef.current);
    }, []);

    const pct = Math.min((step / labels.length) * 100, 100);

    return (
        <div className="mt-3 space-y-2">
            <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-700 ease-apple"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="space-y-1">
                {labels.map((l, idx) => {
                    const s = idx + 1;
                    const done = step > s;
                    const active = step === s;
                    return (
                        <div key={idx} className="flex items-center gap-2">
                            {done ? (
                                <CheckCircleIcon className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            ) : active ? (
                                <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0">
                                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                                </span>
                            ) : (
                                <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0">
                                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                </span>
                            )}
                            <span className={`text-[11px] leading-none tracking-refined ${done ? 'text-green-600' : active ? 'text-indigo-600 font-medium' : 'text-slate-400'}`}>
                                {l}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/** Statement data table */
const StatementTable = ({ section }) => {
    const hasDirectTable = Array.isArray(section?.rows) && section.rows.length > 0;
    const hasDirectText =
        (Array.isArray(section?.paragraphs) && section.paragraphs.length > 0) ||
        (Array.isArray(section?.bullets) && section.bullets.length > 0);
    const hasSubsections = Array.isArray(section?.subsections) && section.subsections.length > 0;

    if (!hasDirectTable && !hasDirectText && !hasSubsections) {
        return (
            <div className="py-10 text-center text-slate-400">
                <TableCellsIcon className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                <p className="text-[12px] tracking-refined">No data found</p>
            </div>
        );
    }

    if (hasDirectTable) {
        return <InteractiveDataTable section={section} />;
    }

    if (hasDirectText) {
        return (
            <div className="space-y-3">
                {(section?.paragraphs || []).map((p, idx) => (
                    <p key={`p-${idx}`} className="text-[12px] text-slate-600 leading-relaxed tracking-refined">{p}</p>
                ))}
                {(section?.bullets || []).length > 0 && (
                    <ul className="list-disc pl-5 space-y-1">
                        {section.bullets.map((b, idx) => (
                            <li key={`b-${idx}`} className="text-[12px] text-slate-600 leading-relaxed tracking-refined">{b}</li>
                        ))}
                    </ul>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {section.subsections.map((subsection, idx) => {
                const isTable = subsection?.type === 'table';
                const mappedRows = (subsection?.rows || []).map((row) => ({
                    item: row.label || row.item || '',
                    values: Array.isArray(row.values) ? row.values : [],
                }));
                const tableShape = {
                    headers: subsection?.headers?.length ? subsection.headers : ['Item'],
                    rows: mappedRows,
                };

                return (
                    <div key={`${subsection?.title || 'sub'}-${idx}`} className="rounded-xl border border-slate-200/80 bg-white p-3">
                        <div className="mb-2">
                            <p className="text-[12px] font-semibold text-slate-700 tracking-refined">{subsection?.title || `Subsection ${idx + 1}`}</p>
                            <p className="text-[11px] text-slate-400 uppercase tracking-widest">{subsection?.type || 'content'}</p>
                        </div>
                        {isTable ? (
                            <InteractiveDataTable section={tableShape} />
                        ) : (
                            <div className="space-y-2">
                                {(subsection?.paragraphs || []).length === 0 ? (
                                    <p className="text-[11px] text-slate-400 tracking-refined">No paragraph content</p>
                                ) : (
                                    subsection.paragraphs.map((p, pIdx) => (
                                        <p key={pIdx} className="text-[12px] text-slate-600 leading-relaxed tracking-refined">{p}</p>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const Home = () => {
    const navigate = useNavigate();
    const { credits, useCredit } = useCredits();
    const [phase, setPhase] = useState('upload'); // upload | extraction
    const [file, setFile] = useState(null);
    const [pdfId, setPdfId] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [showCreditModal, setShowCreditModal] = useState(false);
    const fileInputRef = useRef(null);

    const [sectionStates, setSectionStates] = useState({});
    const [activeSection, setActiveSection] = useState(null);
    const [extractingAll, setExtractingAll] = useState(false);
    const [exporting, setExporting] = useState(null);
    const [fullReportProgress, setFullReportProgress] = useState(null);
    const [reportGenerating, setReportGenerating] = useState(false);
    const [analysisBundle, setAnalysisBundle] = useState(null);

    // Dashboard states
    const [batches, setBatches] = useState([]);
    const [selectedBatchId, setSelectedBatchId] = useState(null);
    const [batchResults, setBatchResults] = useState(null);
    const [loadingBatchResults, setLoadingBatchResults] = useState(false);
    const [viewMode, setViewMode] = useState('extraction'); // 'extraction' | 'dashboard'
    const [activeDashboardTab, setActiveDashboardTab] = useState('Overview');
    const [activeEntity, setActiveEntity] = useState('bank'); // 'bank' | 'group'

    const loadBatches = useCallback(async (autoSelectLatest = false) => {
        try {
            const res = await pdfService.fetchBatches();
            if (res?.batches && res.batches.length > 0) {
                const sorted = [...res.batches].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                setBatches(sorted);
                if (autoSelectLatest && sorted.length > 0) {
                    setSelectedBatchId(sorted[0].batch_id);
                    // Fetch results for the first one asynchronously
                    const firstId = sorted[0].batch_id;
                    setLoadingBatchResults(true);
                    try {
                        const resultsRes = await pdfService.fetchBatchResults(firstId);
                        setBatchResults(resultsRes);
                        const hasB = !!resultsRes?.bank_analysis;
                        const hasG = !!resultsRes?.group_analysis;
                        if (hasB) setActiveEntity('bank');
                        else if (hasG) setActiveEntity('group');
                    } catch (e) {
                        console.warn('Failed to load initial batch results:', e);
                    } finally {
                        setLoadingBatchResults(false);
                    }
                }
            }
        } catch (err) {
            console.warn('Failed to load batches:', err);
        }
    }, []);

    const handleSelectBatch = async (batchId) => {
        setSelectedBatchId(batchId);
        if (!batchId) {
            setBatchResults(null);
            return;
        }
        setLoadingBatchResults(true);
        setError(null);
        try {
            const res = await pdfService.fetchBatchResults(batchId);
            setBatchResults(res);
            setViewMode('dashboard'); // Auto switch to dashboard view on selection!
            
            const hasBank = !!res?.bank_analysis;
            const hasGroup = !!res?.group_analysis;
            if (hasBank) setActiveEntity('bank');
            else if (hasGroup) setActiveEntity('group');
        } catch (err) {
            setError(err?.response?.data?.error || err?.message || 'Failed to fetch batch results');
            setBatchResults(null);
        } finally {
            setLoadingBatchResults(false);
        }
    };

    useEffect(() => {
        loadBatches(true);
    }, [loadBatches]);

    const [reviewData, setReviewData] = useState(null);
    const [analysisHistory, setAnalysisHistory] = useState(null);
    const [activeCompanyId, setActiveCompanyId] = useState(null);
    const [showReview, setShowReview] = useState(false);

    const slugifyCompany = (name) => {
        if (!name) return 'unknown';
        return name.trim().toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'unknown';
    };

    useEffect(() => {
        const hasRes = EXTRACTION_SECTIONS.some(s => sectionStates[s.key]?.data);
        if (hasRes) {
            const firstSec = Object.values(sectionStates).find(s => s?.data);
            const companyName = firstSec?.data?.company_name || file?.name?.replace(/\.pdf$/i, '') || 'Unknown';
            const companyId = slugifyCompany(companyName);
            
            const loadMongoData = async () => {
                try {
                    const data = await pdfService.getCompanyExtracted(companyId);
                    setReviewData(data);
                    setActiveCompanyId(companyId);
                    setShowReview(true);
                    
                    try {
                        const history = await pdfService.getCompanyHistory(companyId);
                        setAnalysisHistory(history);
                    } catch (hErr) {
                        console.warn('Failed to load history:', hErr);
                    }
                } catch (err) {
                    console.warn('Failed to load extracted data from MongoDB:', err);
                }
            };
            
            loadMongoData();
        } else {
            setShowReview(false);
            setReviewData(null);
            setAnalysisHistory(null);
            setActiveCompanyId(null);
        }
    }, [sectionStates, file]);

    const persistSession = useCallback((patch = {}) => {
        try {
            const raw = localStorage.getItem(EXTRACTION_SESSION_KEY);
            const prev = raw ? JSON.parse(raw) : {};
            const next = {
                ...prev,
                ...patch,
                updated_at: new Date().toISOString(),
            };
            localStorage.setItem(EXTRACTION_SESSION_KEY, JSON.stringify(next));
        } catch (_) {
            // Ignore storage errors so extraction flow is never blocked.
        }
    }, []);

    const clearPersistedSession = useCallback(() => {
        try {
            localStorage.removeItem(EXTRACTION_SESSION_KEY);
        } catch (_) {
            // Ignore storage errors so reset flow is never blocked.
        }
    }, []);

    const waitForFullReportCompletion = useCallback(async (jobId) => {
        let attempts = 0;
        while (attempts < 600) {
            attempts += 1;
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const result = await pdfService.getFullReportResult(jobId);
            if (result?.status === 'completed' && result?.data) {
                return result;
            }
            if (result?.status === 'failed') {
                throw new Error(result?.error || 'Full-report extraction failed');
            }
        }
        throw new Error('Full-report extraction timed out');
    }, []);

    const resumeFullReportJob = useCallback(async (jobId) => {
        setExtractingAll(true);

        const stream = pdfService.createFullReportProgressStream(jobId, (event) => {
            const details = event?.details || {};
            const sectionName = details?.display_name || details?.section_key || null;
            const normalizedEvent = {
                ...event,
                message: sectionName && event?.message ? `${event.message} (${sectionName})` : event?.message,
            };
            setFullReportProgress(normalizedEvent);
            persistSession({ fullReportProgress: normalizedEvent });
            const sectionKey = event?.details?.section_key;
            const status = event?.details?.status;
            if (!sectionKey) return;

            setSectionStates((prev) => {
                const next = {
                    ...prev,
                    [sectionKey]: {
                        ...(prev[sectionKey] || {}),
                        status: status === 'done' ? 'done' : 'extracting',
                        data: prev[sectionKey]?.data || null,
                        error: null,
                    },
                };
                persistSession({ sectionStates: next });
                return next;
            });
        });

        try {
            const result = await waitForFullReportCompletion(jobId);
            const next = sectionStateFromFullReport(result.data);
            setSectionStates(next);
            setActiveSection('income_statement');
            setFullReportProgress({ step: -1, total: -1, message: 'Full-report extraction completed.' });
            persistSession({
                sectionStates: next,
                activeSection: 'income_statement',
                extractingAll: false,
                fullReportJobId: null,
                fullReportProgress: { step: -1, total: -1, message: 'Full-report extraction completed.' },
            });
        } finally {
            stream.close();
            setExtractingAll(false);
        }
    }, [persistSession, waitForFullReportCompletion]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(EXTRACTION_SESSION_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (!saved) return;

            if (saved.phase === 'extraction') {
                setPhase('extraction');
            }
            if (saved.fileMeta) {
                setFile(saved.fileMeta);
            }
            if (saved.pdfId) {
                setPdfId(saved.pdfId);
            }
            if (saved.sectionStates && typeof saved.sectionStates === 'object') {
                setSectionStates(saved.sectionStates);
            }
            if (saved.activeSection) {
                setActiveSection(saved.activeSection);
            }
            if (saved.fullReportProgress) {
                setFullReportProgress(saved.fullReportProgress);
            }
            if (saved.fullReportJobId) {
                setFullReportProgress((prev) => prev || { step: 0, total: 0, message: 'Resuming full-report extraction...' });
                void resumeFullReportJob(saved.fullReportJobId).catch((err) => {
                    setError(err?.message || 'Failed to resume full-report extraction');
                    setExtractingAll(false);
                    persistSession({ extractingAll: false, fullReportJobId: null });
                });
            }
        } catch (_) {
            // Ignore malformed persisted session payload.
        }
    }, [persistSession, resumeFullReportJob]);

    // -- Drag & Drop -------------------------------------------------------
    const onDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }, []);
    const onDragLeave = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }, []);
    const onDrop = useCallback((e) => {
        e.preventDefault(); e.stopPropagation(); setDragActive(false);
        const f = e.dataTransfer.files?.[0];
        f?.type === 'application/pdf' ? handleFileSelected(f) : setError('Please upload a PDF file.');
    }, []);
    const onFileInput = (e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); };

    // -- Upload -------------------------------------------------------------
    const handleFileSelected = async (selectedFile) => {
        // Check credits before allowing upload
        if (credits <= 0) {
            setShowCreditModal(true);
            return;
        }
        setFile(selectedFile); setError(null); setSectionStates({}); setActiveSection(null); setPdfId(null); setUploading(true);
        setAnalysisBundle(null);
        persistSession({
            phase: 'upload',
            fileMeta: { name: selectedFile.name, size: selectedFile.size, type: selectedFile.type },
            sectionStates: {},
            activeSection: null,
            pdfId: null,
            fullReportProgress: null,
            fullReportJobId: null,
            extractingAll: false,
        });
        try {
            const res = await pdfService.uploadPDF(selectedFile);
            setPdfId(res.pdf_id);
            // Deduct 1 credit on successful upload
            useCredit();
            setPhase('extraction');
            persistSession({
                phase: 'extraction',
                pdfId: res.pdf_id,
            });
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Upload failed');
            setFile(null);
            clearPersistedSession();
        } finally { setUploading(false); }
    };

    // -- Extract single -----------------------------------------------------
    const handleExtractSection = async (key) => {
        if (!pdfId) return;
        setSectionStates(p => {
            const next = { ...p, [key]: { status: 'extracting', data: null, error: null } };
            persistSession({ sectionStates: next });
            return next;
        });
        // Scroll to the card so user sees the progress
        setTimeout(() => {
            const el = document.getElementById(`card-${key}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
        try {
            const res = await pdfService.extractStatement(pdfId, key);
            setSectionStates(p => {
                const next = { ...p, [key]: { status: 'done', data: res.data, error: null } };
                persistSession({ sectionStates: next });
                return next;
            });
            if (res.data) setActiveSection(key);
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Extraction failed';
            setSectionStates(p => {
                const next = { ...p, [key]: { status: 'error', data: null, error: msg } };
                persistSession({ sectionStates: next });
                return next;
            });
        }
    };

    // -- Extract all --------------------------------------------------------
    const handleExtractAll = async () => {
        if (!file || extractingAll) return;
        if (!(file instanceof File)) {
            setError('Cannot restart extraction from restored session without the original file. Please upload the PDF again.');
            return;
        }

        setExtractingAll(true);
        setError(null);
        setFullReportProgress({ step: 0, total: 0, message: 'Queued full-report extraction...' });
        persistSession({ extractingAll: true, fullReportProgress: { step: 0, total: 0, message: 'Queued full-report extraction...' } });

        try {
            const start = await pdfService.extractFullReportAsync(file);
            const jobId = start?.job_id;
            if (!jobId) throw new Error('No extraction job id returned from backend');

            persistSession({ fullReportJobId: jobId, extractingAll: true });

            const stream = pdfService.createFullReportProgressStream(jobId, (event) => {
                const details = event?.details || {};
                const sectionName = details?.display_name || details?.section_key || null;
                const normalizedEvent = {
                    ...event,
                    message: sectionName && event?.message ? `${event.message} (${sectionName})` : event?.message,
                };
                setFullReportProgress(normalizedEvent);
                persistSession({ fullReportProgress: normalizedEvent });
                const sectionKey = event?.details?.section_key;
                const status = event?.details?.status;
                if (!sectionKey) return;

                setSectionStates((prev) => {
                    const next = {
                        ...prev,
                        [sectionKey]: {
                            ...(prev[sectionKey] || {}),
                            status: status === 'done' ? 'done' : 'extracting',
                            data: prev[sectionKey]?.data || null,
                            error: null,
                        },
                    };
                    persistSession({ sectionStates: next });
                    return next;
                });
            });

            const result = await waitForFullReportCompletion(jobId);
            const next = sectionStateFromFullReport(result.data);
            setSectionStates(next);
            setActiveSection('income_statement');
            persistSession({
                sectionStates: next,
                activeSection: 'income_statement',
                fullReportJobId: null,
                extractingAll: false,
                fullReportProgress: { step: -1, total: -1, message: 'Full-report extraction completed.' },
            });

            stream.close();
            setFullReportProgress({ step: -1, total: -1, message: 'Full-report extraction completed.' });
        } catch (err) {
            setError(err?.message || 'Failed to run full-report extraction');
            persistSession({ extractingAll: false, fullReportJobId: null });
        } finally {
            setExtractingAll(false);
        }
    };

    const handleGenerateReport = async (payload) => {
        setReportGenerating(true);
        setError(null);
        try {
            let analysisPayload = analysisBundle;
            if (!analysisPayload && file instanceof File) {
                const intelligence = await pdfService.runFullIntelligence([file]);
                analysisPayload = intelligence;
                setAnalysisBundle(intelligence);
            }

            const response = await pdfService.generateAnalyticalReport({
                ...payload,
                extraction_data: payload.extraction_data || analysisPayload?.extraction || {},
                analysis_data: payload.analysis_data || {
                    metrics: analysisPayload?.metrics || {},
                    analytics: analysisPayload?.analytics || {},
                    risk: analysisPayload?.risk || {},
                    strategy: analysisPayload?.strategy || {},
                    research: analysisPayload?.research || {},
                },
            });
            if (payload.format === 'json') {
                const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'financial_report.json';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                return;
            }

            const blob = new Blob([response.data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            const ext = payload.format === 'excel' ? 'xlsx' : payload.format;
            a.href = url;
            a.download = `financial_report.${ext}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError(err?.response?.data?.error || err?.message || 'Report generation failed');
        } finally {
            setReportGenerating(false);
        }
    };

    // -- Export --------------------------------------------------------------
    const handleExport = async (fmt) => {
        if (!pdfId) return;
        setExporting(fmt); setError(null);
        try { await pdfService.exportData(pdfId, fmt); }
        catch (err) { setError(err.response?.data?.error || err.message || `Export (${fmt}) failed`); }
        finally { setExporting(null); }
    };

    const handleSaveReview = useCallback(async (companyId, financials) => {
        try {
            await pdfService.updateCompanyExtracted(companyId, financials);
            setReviewData(prev => ({ ...prev, financials }));
        } catch (err) {
            console.error('Failed to save:', err);
            setError('Failed to save edited financials.');
        }
    }, []);

    const handleReanalyse = useCallback(async (companyId) => {
        try {
            const result = await pdfService.reanalyseCompany(companyId);
            const history = await pdfService.getCompanyHistory(companyId);
            setAnalysisHistory(history);
            
            // Reload latest analysis result to refresh the dashboard metrics
            const analysis = await pdfService.getCompanyAnalysis(companyId);
            if (analysis && analysis.latest_run) {
                setAnalysisBundle({
                    scores: analysis.latest_run.scores,
                    yearly_ratios: analysis.latest_run.ratios,
                    growth_metrics: analysis.latest_run.patterns,
                    validation_gates: analysis.latest_run.risk,
                    evaluated_equations_by_year: analysis.latest_run.evaluated_equations_by_year
                });
            }
            return result;
        } catch (err) {
            console.error('Re-analysis failed:', err);
            setError('Re-analysis execution failed.');
        }
    }, []);

    // -- Run Full Pipeline ---------------------------------------------------
    const handleRunFullPipeline = async () => {
        if (!file || uploading) return;
        const files = file instanceof File ? [file] : Array.isArray(file) ? file : [];
        if (files.length === 0) {
            setError('No file available. Please upload a PDF first.');
            return;
        }
        setUploading(true);
        setError(null);
        try {
            const companyName = files[0]?.name?.replace(/\.pdf$/i, '') || 'Unknown Company';
            const res = await pdfService.runFullPipeline(files, {
                symbol: 'UNKNOWN',
                name: companyName,
                sector: 'Diversified',
            });
            const reportId = res?.report_id;
            if (!reportId) throw new Error('No report_id returned from pipeline');
            useCredit();
            // Persist session so PipelineApp picks it up immediately
            const fileCount = files.length;
            const pipelineSession = {
                reportId,
                companyInfo: `${companyName} — Diversified • ${fileCount} file${fileCount > 1 ? 's' : ''}`,
                contextTab: 'Pipeline Overview',
                currencyTarget: 'LKR',
                updated_at: new Date().toISOString(),
            };
            localStorage.setItem('plc.pipeline.currentReport.v1', JSON.stringify(pipelineSession));
            // Navigate to the pipeline dashboard
            navigate('/pipeline');
        } catch (err) {
            setError(err?.response?.data?.error || err?.message || 'Failed to start pipeline');
        } finally {
            setUploading(false);
        }
    };

    // -- Reset ---------------------------------------------------------------
    const handleReset = () => {
        setFile(null); setPdfId(null); setSectionStates({}); setActiveSection(null);
        setError(null); setExporting(null); setExtractingAll(false); setPhase('upload');
        setAnalysisBundle(null);
        setFullReportProgress(null);
        clearPersistedSession();
    };

    // -- Derived values ------------------------------------------------------
    const rowCount = (s) => {
        if (!s) return 0;
        if (Array.isArray(s.rows)) return s.rows.length;
        if (Array.isArray(s.subsections)) {
            return s.subsections.reduce((acc, item) => acc + (Array.isArray(item.rows) ? item.rows.length : 0), 0);
        }
        return 0;
    };
    const totalRows = EXTRACTION_SECTIONS.reduce((n, s) => n + (sectionStates[s.key]?.data?.rows?.length || 0), 0);
    const doneCount = EXTRACTION_SECTIONS.filter(s => sectionStates[s.key]?.status === 'done').length;
    const anyBusy = EXTRACTION_SECTIONS.some(s => sectionStates[s.key]?.status === 'extracting');
    const hasResults = EXTRACTION_SECTIONS.some(s => sectionStates[s.key]?.data);
    const activeDef = EXTRACTION_SECTIONS.find(s => s.key === activeSection);
    const activeData = activeSection && sectionStates[activeSection]?.data;

    const exports = [
        { f: 'json', l: 'JSON' }, { f: 'xlsx', l: 'Excel' }, { f: 'csv', l: 'CSV' },
        { f: 'pdf', l: 'PDF' }, { f: 'docx', l: 'Word' },
    ];

    const renderDashboardContent = () => {
        if (loadingBatchResults) {
            return (
                <div className="py-20 text-center bg-white border border-slate-200/80 rounded-2xl shadow-sm">
                    <ArrowPathIcon className="w-8 h-8 mx-auto text-indigo-500 animate-spin mb-3" />
                    <p className="text-sm font-semibold text-slate-600">Loading analysis results...</p>
                </div>
            );
        }

        if (!batchResults) {
            return (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center shadow-sm">
                    <p className="text-sm text-slate-400">Select an active analysis session from the top right dropdown to load the dashboards.</p>
                </div>
            );
        }

        const hasBank = !!batchResults?.bank_analysis;
        const hasGroup = !!batchResults?.group_analysis;

        return (
            <div className="space-y-6 animate-fade-in">
                {/* Executive Summary */}
                <ExecutiveSummary data={batchResults} />

                {/* Dashboard Controls (Entity Toggle + Sub-Tabs) */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-3">
                    {/* Sub-Tabs */}
                    <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
                        {[
                            { id: 'Overview', label: 'Overview' },
                            { id: 'Ratio Analysis', label: 'Ratios' },
                            { id: 'Trend Charts', label: 'Trends' },
                            { id: 'Balance Sheet', label: 'Balance Sheet' },
                            { id: 'Profitability', label: 'Profitability' },
                            { id: 'Cash Flow', label: 'Cash Flow' },
                            { id: 'Risk & Warnings', label: 'Risk Analysis' },
                            { id: 'Quality Gates', label: 'Quality Gates' },
                            { id: 'Diagnostics', label: 'Diagnostics' }
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setActiveDashboardTab(t.id)}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 ${
                                    activeDashboardTab === t.id
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Entity Toggle (Bank vs Group) */}
                    {hasBank && hasGroup && (
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entity:</span>
                            <button
                                onClick={() => setActiveEntity('bank')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                    activeEntity === 'bank'
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                Bank
                            </button>
                            <button
                                onClick={() => setActiveEntity('group')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                    activeEntity === 'group'
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                Group
                            </button>
                        </div>
                    )}
                </div>

                {/* Sub-Tab Content Rendering */}
                <div className="mt-4">
                    {activeDashboardTab === 'Overview' && (
                        <FinancialHealthOverview data={batchResults} entity={activeEntity} />
                    )}
                    {activeDashboardTab === 'Ratio Analysis' && (
                        <RatioAnalysisDashboard data={batchResults} entity={activeEntity} />
                    )}
                    {activeDashboardTab === 'Trend Charts' && (
                        <TrendAnalysisCharts data={batchResults} entity={activeEntity} />
                    )}
                    {activeDashboardTab === 'Balance Sheet' && (
                        <BalanceSheetVisualization data={batchResults} entity={activeEntity} />
                    )}
                    {activeDashboardTab === 'Profitability' && (
                        <ProfitabilityDashboard data={batchResults} entity={activeEntity} />
                    )}
                    {activeDashboardTab === 'Cash Flow' && (
                        <CashFlowDashboard data={batchResults} entity={activeEntity} />
                    )}
                    {activeDashboardTab === 'Risk & Warnings' && (
                        <RiskAnalysisDashboard data={batchResults} entity={activeEntity} />
                    )}
                    {activeDashboardTab === 'Quality Gates' && (
                        <QualityGateDashboard data={batchResults} entity={activeEntity} />
                    )}
                    {activeDashboardTab === 'Diagnostics' && (
                        <DiagnosticsDashboard data={batchResults} />
                    )}
                </div>
            </div>
        );
    };

    // =======================================================================
    // Render
    // =======================================================================
    return (
        <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">

            {/* ---- Mode Switcher ---- */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6 gap-4">
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('extraction')}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 border ${
                            viewMode === 'extraction'
                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <DocumentTextIcon className="w-4 h-4" />
                        Extraction Hub
                    </button>
                    <button
                        onClick={() => setViewMode('dashboard')}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 border ${
                            viewMode === 'dashboard'
                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <BoltIcon className="w-4 h-4" />
                        Financial Analysis Dashboard
                    </button>
                </div>

                {/* Session Dropdown */}
                {batches.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">Session:</span>
                        <select
                            value={selectedBatchId || ''}
                            onChange={(e) => handleSelectBatch(e.target.value)}
                            className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 cursor-pointer"
                        >
                            <option value="" disabled>Select session...</option>
                            {batches.map((b) => (
                                <option key={b.batch_id} value={b.batch_id}>
                                    {b.company || b.filename || b.batch_id.slice(0, 8)} ({new Date(b.created_at).toLocaleDateString()})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* ---- Error --------------------------------------------------- */}
            {error && (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 shadow-apple-sm animate-slide-down">
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="flex-1 text-[13px] text-red-700 tracking-refined">{error}</p>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors duration-150"><XMarkIcon className="w-4 h-4" /></button>
                </div>
            )}

            {viewMode === 'extraction' ? (
                <>
                    {/* ---- Top bar ------------------------------------------------- */}
                    <div className="flex items-end justify-between mb-8">
                        <div>
                            <h1 className="text-[22px] font-semibold text-slate-900 leading-heading tracking-heading">
                                {phase === 'upload' ? 'Annual Report Extractor' : file?.name?.replace(/\.pdf$/i, '')}
                            </h1>
                            <p className="text-[13px] text-slate-500 mt-0.5 tracking-refined leading-rhythm">
                                {phase === 'upload' && 'Upload a PDF to extract structured financial data.'}
                                {phase === 'extraction' && doneCount > 0 && (
                                    <>{(file?.size / 1024 / 1024).toFixed(1)} MB &middot; {doneCount}/{EXTRACTION_SECTIONS.length} extracted &middot; {totalRows} rows</>
                                )}
                                {phase === 'extraction' && doneCount === 0 && (
                                    <>{(file?.size / 1024 / 1024).toFixed(1)} MB &middot; Select a statement to extract.</>
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {phase === 'upload' && (
                                <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 shadow-apple-sm">
                                    <span className={`w-2 h-2 rounded-full ${credits > 0 ? 'bg-green-500' : 'bg-red-400'}`} />
                                    <span className="text-[13px] text-slate-600 font-medium tracking-refined">{credits} credit{credits !== 1 ? 's' : ''}</span>
                                    {credits === 0 && (
                                        <button onClick={() => navigate('/pricing')} className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium ml-1 tracking-refined">Buy more</button>
                                    )}
                                </div>
                            )}
                            {phase === 'extraction' && (
                                <button onClick={handleReset} className="text-[13px] text-slate-400 hover:text-slate-600 transition-colors duration-200 tracking-refined">
                                    New file
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ================================================================
                        UPLOAD
                    ================================================================ */}
                    {phase === 'upload' && (
                        <div
                            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                            onClick={() => !uploading && fileInputRef.current?.click()}
                            className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 ease-apple text-center cursor-pointer
                                ${uploading ? 'pointer-events-none opacity-60' : ''}
                                ${dragActive ? 'border-indigo-400 bg-indigo-50/30 shadow-apple' : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-apple'}`}
                        >
                            <div className="py-20 px-6">
                                {uploading ? (
                                    <div className="space-y-3 animate-fade-in">
                                        <ArrowPathIcon className="w-8 h-8 mx-auto text-indigo-500 animate-spin" />
                                        <p className="text-sm text-slate-600 font-medium tracking-refined">Uploading {file?.name}...</p>
                                        <p className="text-[12px] text-slate-400 tracking-refined">{(file?.size / 1024 / 1024).toFixed(1)} MB</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center shadow-apple-sm">
                                            <ArrowUpTrayIcon className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 tracking-refined">
                                                {dragActive ? 'Drop your file' : 'Drop a PDF here or click to browse'}
                                            </p>
                                            <p className="text-[12px] text-slate-400 mt-1 tracking-refined">Annual reports up to 100 MB</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <input ref={fileInputRef} type="file" accept=".pdf" onChange={onFileInput} className="hidden" />
                        </div>
                    )}

                    {/* ================================================================
                        EXTRACTION
                    ================================================================ */}
                    {phase === 'extraction' && (
                        <div className="space-y-6">

                            {/* ---- Action row ---------------------------------------- */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-apple-sm">
                                    <DocumentTextIcon className="w-4 h-4 text-slate-400" />
                                    <span className="text-[13px] text-slate-600 font-medium truncate max-w-[220px] tracking-refined">{file?.name}</span>
                                    <span className="text-[11px] text-green-600 bg-green-50/80 border border-green-200/60 rounded-lg px-1.5 py-0.5 font-medium tracking-wide">
                                        Ready
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleRunFullPipeline}
                                        disabled={extractingAll || anyBusy || uploading}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-[13px] font-medium text-white
                                            hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 ease-apple shadow-apple-sm hover:shadow-apple tracking-refined"
                                    >
                                        <BoltIcon className="w-3.5 h-3.5" /> Full Pipeline
                                    </button>
                                    <button
                                        onClick={handleExtractAll}
                                        disabled={extractingAll || anyBusy}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-medium text-white
                                            hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 ease-apple shadow-apple-sm hover:shadow-apple tracking-refined"
                                    >
                                        {extractingAll
                                            ? <><ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> Extracting...</>
                                            : <><DocumentArrowDownIcon className="w-3.5 h-3.5" /> Extract All</>}
                                    </button>
                                </div>
                            </div>

                            {fullReportProgress && (
                                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-apple-sm animate-slide-down">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-[12px] font-medium text-slate-700 tracking-refined">{fullReportProgress.message || 'Processing full report extraction...'}</p>
                                        <span className="text-[11px] text-slate-400 tracking-refined">
                                            {fullReportProgress.total > 0 ? `${fullReportProgress.step}/${fullReportProgress.total}` : 'running'}
                                        </span>
                                    </div>
                                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 transition-all duration-300 ease-apple rounded-full"
                                            style={{ width: `${fullReportProgress.total > 0 ? Math.min((fullReportProgress.step / fullReportProgress.total) * 100, 100) : 10}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* ---- Cards by category --------------------------------- */}
                            {[...new Set(EXTRACTION_SECTIONS.map(s => s.category))].map(cat => (
                                <div key={cat}>
                                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">{cat}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {EXTRACTION_SECTIONS.filter(s => s.category === cat).map(sec => {
                                            const st = sectionStates[sec.key];
                                            const status = st?.status || 'idle';
                                            const isExtracting = status === 'extracting';
                                            const isDone = status === 'done';
                                            const isErr = status === 'error';
                                            const rows = rowCount(st?.data);
                                            const isActive = activeSection === sec.key;
                                            const Icon = sec.icon;

                                            const handleClick = () => {
                                                if (isExtracting) return;
                                                if (isDone && st.data) setActiveSection(p => p === sec.key ? null : sec.key);
                                                else handleExtractSection(sec.key);
                                            };

                                            return (
                                                <div
                                                    key={sec.key}
                                                    id={`card-${sec.key}`}
                                                    onClick={handleClick}
                                                    className={`rounded-2xl border p-4 transition-all duration-200 ease-apple select-none
                                                        ${isExtracting ? 'border-indigo-200/80 bg-indigo-50/20 cursor-wait shadow-apple-sm'
                                                            : isActive ? 'border-slate-900 bg-white shadow-apple cursor-pointer ring-1 ring-slate-900'
                                                                : isErr ? 'border-red-200/80 bg-red-50/20 cursor-pointer shadow-apple-sm'
                                                                    : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-apple cursor-pointer shadow-apple-sm'}`}
                                                >
                                                    {/* top row: icon + title + badge */}
                                                    <div className="flex items-start gap-3">
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200
                                                            ${isActive ? 'bg-slate-900 shadow-apple-sm' : 'bg-slate-50 border border-slate-100'}`}>
                                                            <Icon className={`w-4 h-4 transition-colors duration-200 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <h3 className="text-[13px] font-semibold text-slate-800 truncate tracking-refined">{sec.title}</h3>
                                                                {isExtracting && (
                                                                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-100/80 rounded-lg px-1.5 py-0.5">
                                                                        <ArrowPathIcon className="w-3 h-3 animate-spin" /> Working
                                                                    </span>
                                                                )}
                                                                {isDone && st.data && (
                                                                    <span className="shrink-0 text-[10px] font-medium text-green-700 bg-green-50/80 border border-green-200/60 rounded-lg px-1.5 py-0.5">
                                                                        {rows} rows
                                                                    </span>
                                                                )}
                                                                {isDone && !st.data && (
                                                                    <span className="shrink-0 text-[10px] text-slate-400 bg-slate-50 rounded-lg px-1.5 py-0.5 tracking-refined">
                                                                        Not found
                                                                    </span>
                                                                )}
                                                                {isErr && (
                                                                    <span className="shrink-0 text-[10px] text-red-600 bg-red-50/80 border border-red-200/60 rounded-lg px-1.5 py-0.5">
                                                                        Error
                                                                    </span>
                                                                )}
                                                                {status === 'idle' && (
                                                                    <span className="shrink-0 text-[10px] text-slate-400 tracking-refined">Click to extract</span>
                                                                )}
                                                            </div>
                                                            <p className="text-[12px] text-slate-500 mt-0.5 leading-snug tracking-refined">{sec.description}</p>
                                                            <div className="mt-2 flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (st?.data) setActiveSection(sec.key);
                                                                    }}
                                                                    disabled={!st?.data}
                                                                    className="text-[11px] px-2 py-1 rounded-lg border border-slate-200/80 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors duration-150 tracking-refined"
                                                                >
                                                                    Preview
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleExtractSection(sec.key);
                                                                    }}
                                                                    disabled={isExtracting}
                                                                    className="text-[11px] px-2 py-1 rounded-lg border border-slate-200/80 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors duration-150 tracking-refined"
                                                                >
                                                                    Re-extract
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Inline progress when extracting */}
                                                    {isExtracting && <CardProgress sectionTitle={sec.shortTitle} />}

                                                    {/* Error message */}
                                                    {isErr && st.error && (
                                                        <p className="mt-2 text-[11px] text-red-500 line-clamp-2 tracking-refined">{st.error}</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {/* ---- Data viewer --------------------------------------- */}
                            {activeSection && activeData && (
                                <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-apple-sm animate-scale-in">
                                    <div className="px-5 py-3 border-b border-slate-100/80 flex items-center justify-between">
                                        <div>
                                            <h2 className="text-[15px] font-semibold text-slate-800 tracking-refined">{activeDef?.title}</h2>
                                            {activeData.title && <p className="text-[11px] text-slate-500 mt-0.5 tracking-refined">{activeData.title}</p>}
                                            {activeData.notes && <p className="text-[11px] text-slate-400 italic tracking-refined">{activeData.notes}</p>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {activeData.page_numbers?.length > 0 && (
                                                <span className="text-[11px] text-slate-400 tracking-refined">pg {activeData.page_numbers.join(', ')}</span>
                                            )}
                                            <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg tracking-refined">
                                                {rowCount(activeData)} rows
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleExtractSection(activeSection); }}
                                                className="text-[11px] text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors duration-150 tracking-refined"
                                            >
                                                Re-extract
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4 max-h-[520px] overflow-auto">
                                        <StatementTable section={activeData} />
                                    </div>
                                </div>
                            )}

                            {/* ---- Export bar ----------------------------------------- */}
                            {hasResults && (
                                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-apple-sm">
                                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-widest mr-1">Export:</span>
                                    {exports.map(({ f, l }) => (
                                        <button
                                            key={f}
                                            onClick={() => handleExport(f)}
                                            disabled={!!exporting}
                                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1.5
                                                text-[12px] font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300
                                                disabled:opacity-40 transition-all duration-200 ease-apple tracking-refined"
                                        >
                                            {exporting === f
                                                ? <ArrowPathIcon className="w-3 h-3 animate-spin" />
                                                : <ArrowDownTrayIcon className="w-3 h-3" />}
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {hasResults && (
                                <ReportBuilderPanel
                                    extractionData={Object.fromEntries(Object.entries(sectionStates).map(([k, v]) => [k, v?.data || null]))}
                                    analysisData={analysisBundle || {}}
                                    onGenerate={handleGenerateReport}
                                    loading={reportGenerating}
                                />
                            )}

                            {showReview && reviewData && (
                                <div className="mt-8 space-y-6 animate-scale-in">
                                    <ReviewPanel
                                        companyId={activeCompanyId}
                                        financials={reviewData.financials}
                                        companyName={reviewData.name}
                                        onSave={handleSaveReview}
                                        onReanalyse={handleReanalyse}
                                    />
                                    {analysisHistory && (
                                        <AnalysisHistory companyId={activeCompanyId} history={analysisHistory} />
                                    )}
                                    <ExportSection companyId={activeCompanyId} />
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                renderDashboardContent()
            )}

            {/* Insufficient credits modal */}
            <InsufficientCreditsModal open={showCreditModal} onClose={() => setShowCreditModal(false)} />
        </div>
    );
};

export default Home;
