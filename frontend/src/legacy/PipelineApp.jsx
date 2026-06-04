import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Navbar from './components/Navbar';
import ContextBar from './components/ContextBar';
import PipelineStepper from './components/PipelineStepper';
import ValidatedDataTable from './components/ValidatedDataTable';
import AnalyticsCards from './components/AnalyticsCards';
import ErrorsPanel from './components/ErrorsPanel';
import ConfidenceChart from './components/ConfidenceChart';
import QualitySummary from './components/QualitySummary';
import UploadCard from './components/UploadCard';
import TrendCharts from './components/TrendCharts';
import PipelineWorkflowMap from '../components/PipelineWorkflowMap';
import { AlertTriangle, X } from 'lucide-react';
import {
  checkHealth,
  uploadReport,
  fetchStages,
  fetchValidated,
  fetchAnalytics,
  fetchCurrencyConverted,
  fetchErrors,
  fetchDocumentStatuses,
  downloadReportUrl,
} from './api';

const PIPELINE_SESSION_KEY = 'plc.pipeline.currentReport.v1';

export default function PipelineApp() {
  // ─── Global state ──────────────────────────────────────────
  const [globalTab, setGlobalTab] = useState('Dashboard');
  const [connected, setConnected] = useState(true);

  // ─── Report state ──────────────────────────────────────────
  const [reportId, setReportId] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // ─── Pipeline data ─────────────────────────────────────────
  const [stagesData, setStagesData] = useState(null);
  const [validatedData, setValidatedData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [errorsData, setErrorsData] = useState(null);
  const [documentStatuses, setDocumentStatuses] = useState(null);
  const [currencyTarget, setCurrencyTarget] = useState('LKR');
  const [fxRate, setFxRate] = useState(null);
  const [isConvertingCurrency, setIsConvertingCurrency] = useState(false);

  // ─── Context tab ───────────────────────────────────────────
  const [contextTab, setContextTab] = useState('Pipeline Overview');

  // Widget state
  const [showIssuesWidget, setShowIssuesWidget] = useState(false);

  // ─── Polling ref ───────────────────────────────────────────
  const pollRef = useRef(null);
  const hydratedRef = useRef(false);
  const validatedLoadedRef = useRef(false);
  const errorsLoadedRef = useRef(false);
  const analyticsLoadedRef = useRef(false);
  const baseValidatedRef = useRef(null);
  const baseAnalyticsRef = useRef(null);
  const conversionRequestRef = useRef(0);

  const applyCurrencyView = useCallback(async (id, target) => {
    if (!id) return;
    if (target === 'LKR') {
      if (baseValidatedRef.current) setValidatedData(baseValidatedRef.current);
      if (baseAnalyticsRef.current) setAnalyticsData(baseAnalyticsRef.current);
      return;
    }

    const requestId = Date.now();
    conversionRequestRef.current = requestId;

    try {
      setIsConvertingCurrency(true);
      const converted = await fetchCurrencyConverted(id, target);
      if (conversionRequestRef.current !== requestId) return;

      if (typeof converted?.fx_rate_lkr_per_usd === 'number') {
        setFxRate(converted.fx_rate_lkr_per_usd);
      }

      if (converted?.converted?.validated) {
        setValidatedData({ report_id: id, validated: converted.converted.validated });
      }

      if (converted?.converted?.analytics) {
        const a = converted.converted.analytics;
        setAnalyticsData({
          report_id: id,
          ratios: a.ratios || {},
          patterns: a.patterns || [],
          risk: a.risk || {},
          sector_kpis: a.sector_kpis || {},
          confidence: a.confidence || {},
          analysis_coverage: a.analysis_coverage || {},
          sections: a.sections || {},
          transparency: a.transparency || {},
        });
      }
    } catch (err) {
      console.warn('Currency conversion error:', err?.message || err);
    } finally {
      if (conversionRequestRef.current === requestId) {
        setIsConvertingCurrency(false);
      }
    }
  }, []);

  const persistPipelineSession = useCallback((patch = {}) => {
    try {
      const raw = localStorage.getItem(PIPELINE_SESSION_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      const next = { ...prev, ...patch, updated_at: new Date().toISOString() };
      localStorage.setItem(PIPELINE_SESSION_KEY, JSON.stringify(next));
    } catch (_) {
      // Keep app functional even when local storage is unavailable.
    }
  }, []);

  const clearPipelineSession = useCallback(() => {
    try {
      localStorage.removeItem(PIPELINE_SESSION_KEY);
    } catch (_) {
      // Keep app functional even when local storage is unavailable.
    }
  }, []);

  // ─── Health check ──────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        await checkHealth();
        setConnected(true);
      } catch (_) {
        setConnected(false);
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  // ─── Pipeline polling ──────────────────────────────────────
  const startPolling = useCallback(
    (id) => {
      if (pollRef.current) clearInterval(pollRef.current);

      validatedLoadedRef.current = false;
      errorsLoadedRef.current = false;
      analyticsLoadedRef.current = false;

      const poll = async () => {
        try {
          const stages = await fetchStages(id);
          setStagesData(stages);

          const wf = stages.workflow_state;
          const wfStr = String(wf || '');
          const wfIsComplete = wfStr === 'COMPLETED' || wfStr === 'LOW_CONFIDENCE';
          const wfIsFailed = wfStr === 'FAILED' || wfStr.includes('FAILED') || wfStr === 'EXTRACTION_INCOMPLETE' || wfStr === 'EXTRACTION_FAILED';
          let validationPayloadLoaded = validatedLoadedRef.current;
          let errorsPayloadLoaded = errorsLoadedRef.current;
          let analyticsPayloadLoaded = analyticsLoadedRef.current;

          try {
            const docs = await fetchDocumentStatuses(id);
            setDocumentStatuses(docs);
          } catch (_) {}

          const validationDone = stages.stages?.some(
            (s) => (s.stage === 'VALIDATION' || s.stage === 'ACCOUNTING_VALIDATION') && s.status === 'completed'
          ) || wfIsComplete;
          let shouldRefreshCurrency = false;
          if (validationDone && !validatedLoadedRef.current) {
            try {
              const vd = await fetchValidated(id);
              baseValidatedRef.current = vd;
              if (currencyTarget === 'LKR') {
                setValidatedData(vd);
              }
              validationPayloadLoaded = Boolean(vd?.validated);
              if (validationPayloadLoaded) {
                validatedLoadedRef.current = true;
                shouldRefreshCurrency = true;
              }
            } catch (_) {}

          }

          if ((validationDone || wfIsFailed) && !errorsLoadedRef.current) {
            try {
              const ed = await fetchErrors(id);
              setErrorsData(ed);
              errorsPayloadLoaded = Boolean(ed && typeof ed === 'object');
              if (errorsPayloadLoaded) {
                errorsLoadedRef.current = true;
              }
            } catch (_) {}
          }

          const analyticsDone = stages.stages?.some(
            (s) => (s.stage === 'ANALYTICS' || s.stage === 'FINANCIAL_ANALYSIS') && s.status === 'completed'
          ) || wfIsComplete;
          if (analyticsDone && !analyticsLoadedRef.current) {
            try {
              const ad = await fetchAnalytics(id);
              baseAnalyticsRef.current = ad;
              if (currencyTarget === 'LKR') {
                setAnalyticsData(ad);
              }
              analyticsPayloadLoaded = Boolean(ad && typeof ad === 'object');
              if (analyticsPayloadLoaded) {
                analyticsLoadedRef.current = true;
                shouldRefreshCurrency = true;
              }
            } catch (_) {}
          }

          if (currencyTarget !== 'LKR' && shouldRefreshCurrency) {
            await applyCurrencyView(id, currencyTarget);
          }

          const canStopCompleted =
            wf === 'COMPLETED' &&
            validationPayloadLoaded &&
            errorsPayloadLoaded &&
            analyticsPayloadLoaded;

          const canStopLowConfidence =
            wf === 'LOW_CONFIDENCE' &&
            validationPayloadLoaded &&
            errorsPayloadLoaded &&
            analyticsPayloadLoaded;

          if (wfIsFailed || canStopCompleted || canStopLowConfidence) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } catch (err) {
          console.warn('Poll error:', err.message);
        }
      };

      poll();
      pollRef.current = setInterval(poll, 3000);
    },
    [applyCurrencyView, currencyTarget]
  );

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PIPELINE_SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved?.reportId) return;

      setReportId(saved.reportId);
      setCompanyInfo(saved.companyInfo || null);
      setContextTab(saved.contextTab || 'Pipeline Overview');
      setCurrencyTarget(saved.currencyTarget || 'LKR');
      startPolling(saved.reportId);
    } catch (_) {
      // Ignore malformed persisted data.
    } finally {
      hydratedRef.current = true;
    }
  }, [startPolling]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }
    if (!reportId) {
      clearPipelineSession();
      return;
    }
    persistPipelineSession({ reportId, companyInfo, contextTab, currencyTarget });
  }, [reportId, companyInfo, contextTab, currencyTarget, clearPipelineSession, persistPipelineSession]);

  useEffect(() => {
    if (!reportId) {
      return;
    }
    if (currencyTarget === 'LKR') {
      if (baseValidatedRef.current) setValidatedData(baseValidatedRef.current);
      if (baseAnalyticsRef.current) setAnalyticsData(baseAnalyticsRef.current);
      return;
    }
    void applyCurrencyView(reportId, currencyTarget);
  }, [reportId, currencyTarget, applyCurrencyView]);

  // ─── Upload handler ────────────────────────────────────────
  const handleUpload = async (files, company) => {
    setIsUploading(true);
    setUploadError(null);
    setStagesData(null);
    setValidatedData(null);
    setAnalyticsData(null);
    setErrorsData(null);
    setDocumentStatuses(null);
    baseValidatedRef.current = null;
    baseAnalyticsRef.current = null;

    try {
      const result = await uploadReport(files, company);
      const id = result.report_id;
      const fileCount = Array.isArray(files) ? files.length : 1;
      setReportId(id);
      setCompanyInfo(`${company.name} — ${company.sector} • ${fileCount} file${fileCount > 1 ? 's' : ''}`);
      setContextTab('Pipeline Overview');
      persistPipelineSession({
        reportId: id,
        companyInfo: `${company.name} — ${company.sector} • ${fileCount} file${fileCount > 1 ? 's' : ''}`,
        contextTab: 'Pipeline Overview',
      });
      startPolling(id);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Upload failed. Check if backend is running.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Derived values ────────────────────────────────────────
  const qualityScore = useMemo(() => {
    if (typeof analyticsData?.confidence?.overall_data_quality_score === 'number') {
      return analyticsData.confidence.overall_data_quality_score;
    }
    if (typeof analyticsData?.confidence?.score === 'number') {
      return analyticsData.confidence.score;
    }
    if (typeof analyticsData?.confidence?.raw_score === 'number') {
      return analyticsData.confidence.raw_score;
    }
    return validatedData?.validated?.overall_data_quality_score ?? null;
  }, [analyticsData, validatedData]);
  const stages = stagesData?.stages || [];
  const workflowState = stagesData?.workflow_state || null;

  // Check if we have active issues to show a red icon
  const hasIssues = errorsData && (
    (errorsData.error_catalog && errorsData.error_catalog.length > 0) ||
    (errorsData.missing_values && errorsData.missing_values.length > 0) ||
    (errorsData.extraction_failure && errorsData.extraction_failure.document_errors?.length > 0)
  );

  // ─── Render helpers ────────────────────────────────────────
  const renderPipelineOverview = () => (
    <div className="space-y-5 fade-in">
      <PipelineStepper stages={stages} />

      {Array.isArray(documentStatuses?.documents) && documentStatuses.documents.length > 0 && (
        <PipelineWorkflowMap
          stagesData={stagesData}
          documentStatuses={documentStatuses}
          workflowState={workflowState}
        />
      )}

      {/* Responsive overview grid — Compacted to 2 columns by moving Errors out */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <ValidatedDataTable data={validatedData} analytics={analyticsData} currency={currencyTarget} />
        <div style={{ maxHeight: 'auto'}} className="pr-1">
          <AnalyticsCards analytics={analyticsData} currency={currencyTarget} />
        </div>
      </div>

      {/* Bottom row: charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConfidenceChart validatedData={validatedData} />
        <QualitySummary validatedData={validatedData} errors={errorsData} />
      </div>

      <TrendCharts validatedData={validatedData} analytics={analyticsData} currency={currencyTarget} />

      {isConvertingCurrency && currencyTarget === 'USD' && (
        <div className="card p-4 border border-slate-200/80 bg-white/90">
          <div className="text-[12px] font-semibold text-slate-600 mb-2 tracking-[-0.01em]">Converting values to USD...</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div className="h-3 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
      )}

      {/* Download section */}
      {(workflowState === 'COMPLETED' || workflowState === 'LOW_CONFIDENCE') && reportId && (
        <div className="card p-4 flex justify-end">
          <a
            href={downloadReportUrl(reportId)}
            download
            id="download-report-btn"
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[13px] font-medium hover:bg-slate-800 transition-all duration-200 shadow-sm hover:shadow-md tracking-[-0.01em]"
          >
            Download Analysis Report (PDF)
          </a>
        </div>
      )}

      <div className="text-[11px] text-slate-500 tracking-[-0.01em]">
        Currency view: <span className="font-semibold text-slate-700">{currencyTarget}</span>
        {currencyTarget === 'USD' && typeof fxRate === 'number' && (
          <span> (FX 1 USD = {fxRate} LKR)</span>
        )}
      </div>

      {/* Low confidence notice */}
      {workflowState === 'LOW_CONFIDENCE' && (
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-5 flex gap-3 items-center">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="text-[13px] font-semibold text-amber-800 tracking-[-0.01em]">
              Low Confidence — Analysis Completed With Limited Data Coverage
            </div>
            <div className="text-[12px] text-amber-700 mt-1 tracking-[-0.01em]">
              Pipeline execution completed. Review extraction diagnostics, validated data, and analytics to improve data coverage.
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderValidatedDataTab = () => (
    <div className="space-y-5 fade-in">
      <ValidatedDataTable data={validatedData} analytics={analyticsData} currency={currencyTarget} />
      <TrendCharts validatedData={validatedData} analytics={analyticsData} currency={currencyTarget} />
    </div>
  );

  const renderAnalyticsTab = () => (
    <div className="space-y-5 fade-in">
      <AnalyticsCards analytics={analyticsData} currency={currencyTarget} />
      <TrendCharts validatedData={validatedData} analytics={analyticsData} currency={currencyTarget} />
    </div>
  );

  const renderErrorsTab = () => (
    <div className="space-y-5 fade-in">
      <ErrorsPanel errors={errorsData} />
      <ConfidenceChart validatedData={validatedData} />
    </div>
  );

  const renderQualityTab = () => (
    <div className="space-y-5 fade-in">
      <QualitySummary validatedData={validatedData} errors={errorsData} />
      <ConfidenceChart validatedData={validatedData} />
    </div>
  );

  const renderContextContent = () => {
    if (!reportId) return null;
    switch (contextTab) {
      case 'Pipeline Overview': return renderPipelineOverview();
      case 'Validated Data': return renderValidatedDataTab();
      case 'Analytics': return renderAnalyticsTab();
      case 'Errors & Warnings': return renderErrorsTab();
      case 'Data Quality Summary': return renderQualityTab();
      default: return renderPipelineOverview();
    }
  };

  // ─── Main layout ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 relative overflow-x-hidden">
      <Navbar activeTab={globalTab} onTabChange={setGlobalTab} connected={connected} />

      {reportId && (
        <ContextBar
          reportId={reportId}
          company={companyInfo}
          qualityScore={qualityScore}
          activeContextTab={contextTab}
          onContextTabChange={setContextTab}
        />
      )}

      <main className="max-w-[1340px] mx-auto px-6 lg:px-8 py-6 pb-24">
        {/* Dashboard tab */}
        {globalTab === 'Dashboard' && (
          <>
            {!reportId ? (
              <div>
                <div className="text-center mb-8 mt-10">
                  <h1 className="text-[24px] font-bold text-slate-900 tracking-[-0.025em] leading-tight">
                    Financial Report Analysis
                  </h1>
                  <p className="text-[14px] text-slate-500 mt-2 tracking-[-0.01em]">
                    Upload an annual report PDF to begin pipeline analysis with validation and quality scoring.
                  </p>
                </div>
                <UploadCard onUpload={handleUpload} isUploading={isUploading} />
                {uploadError && (
                  <div className="max-w-[560px] mx-auto mt-4 bg-red-50/80 border border-red-200/60 rounded-xl px-4 py-3 text-red-700 text-[13px] font-medium tracking-[-0.01em]">
                    {uploadError}
                  </div>
                )}
              </div>
            ) : (
              renderContextContent()
            )}
          </>
        )}

        {/* Reports tab */}
        {globalTab === 'Reports' && (
          <div className="fade-in">
            <h2 className="text-[18px] font-semibold text-slate-900 mb-4 tracking-[-0.025em]">
              Reports
            </h2>
            {reportId ? (
              <div className="card p-5">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-[13px] font-semibold text-slate-800 tracking-[-0.01em]">Current Report: {reportId.slice(0, 12)}...</div>
                    <div className="text-[12px] text-slate-500 mt-0.5 tracking-[-0.01em]">{companyInfo}</div>
                    <div className="text-[12px] text-slate-500 mt-0.5 tracking-[-0.01em]">State: {workflowState || 'UPLOADED'}</div>
                  </div>
                  <button
                    onClick={() => {
                      setReportId(null);
                      setStagesData(null);
                      setValidatedData(null);
                      setAnalyticsData(null);
                      baseValidatedRef.current = null;
                      baseAnalyticsRef.current = null;
                      setErrorsData(null);
                      setCompanyInfo(null);
                      setContextTab('Pipeline Overview');
                      clearPipelineSession();
                      if (pollRef.current) clearInterval(pollRef.current);
                    }}
                    className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-[13px] font-medium hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 tracking-[-0.01em]"
                  >
                    Upload New Report
                  </button>
                </div>
              </div>
            ) : (
              <UploadCard onUpload={handleUpload} isUploading={isUploading} />
            )}
          </div>
        )}

        {/* Comparisons tab */}
        {globalTab === 'Comparisons' && (
          <div className="fade-in text-center py-16">
            <div className="text-4xl mb-4">📊</div>
            <h2 className="text-[18px] font-semibold text-slate-600 tracking-[-0.025em]">Comparative Analysis</h2>
            <p className="text-[13px] text-slate-400 mt-2 tracking-[-0.01em]">
              Upload multiple reports to enable cross-report comparison. Available after batch processing.
            </p>
          </div>
        )}

        {/* Settings tab */}
        {globalTab === 'Settings' && (
          <div className="fade-in">
            <h2 className="text-[18px] font-semibold text-slate-900 mb-4 tracking-[-0.025em]">Settings</h2>
            <div className="card p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    Analytics Quality Threshold
                  </div>
                  <div className="text-2xl font-bold text-slate-900 tracking-[-0.025em]">85%</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 tracking-[-0.01em]">
                    Reports below this will skip analytics and report generation
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                    API Status
                  </div>
                  <div className={`text-[14px] font-bold ${connected ? 'text-green-600' : 'text-red-500'}`}>
                    {connected ? '● Connected' : '● Disconnected'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 tracking-[-0.01em]">
                    Backend orchestrator on port 3000
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {reportId && (
        <div className="fixed bottom-6 right-[190px] z-50">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Currency</span>
            <button
              type="button"
              onClick={() => setCurrencyTarget('LKR')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${currencyTarget === 'LKR' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              disabled={isConvertingCurrency}
            >
              LKR
            </button>
            <button
              type="button"
              onClick={() => setCurrencyTarget('USD')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${currencyTarget === 'USD' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              disabled={isConvertingCurrency}
            >
              USD
            </button>
          </div>
        </div>
      )}

      {/* ── Issues pop-out button Widget ────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50">
         <button 
            onClick={() => setShowIssuesWidget(!showIssuesWidget)}
            className={`flex items-center gap-2 px-4 py-3 rounded-full font-semibold text-[13px] shadow-lg border transition-all duration-300
               ${hasIssues ? 'bg-red-50/90 hover:bg-red-100 text-red-700 border-red-200/80 shadow-red-500/10' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-slate-200/20'}
            `}
         >
            <AlertTriangle size={16} className={hasIssues ? 'text-red-500' : 'text-slate-400'} />
            <span>Issues & Warnings</span>
         </button>
      </div>

      {/* ── Issues Panel ────────────────────────────────────────────── */}
      <div className={`fixed top-0 right-0 h-full w-[440px] max-w-[90vw] bg-slate-50 border-l border-slate-200 shadow-[0_0_40px_rgba(0,0,0,0.1)] z-[60] transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${showIssuesWidget ? 'translate-x-0' : 'translate-x-full'}`}>
         <div className="h-16 border-b border-slate-200/80 flex items-center justify-between px-6 bg-white shrink-0 shadow-sm">
            <h3 className="text-[14px] font-bold text-slate-800 flex items-center gap-2 tracking-[-0.01em]">
               <AlertTriangle size={18} className={hasIssues ? 'text-red-500' : 'text-slate-400'} />
               System Log & Diagnostics
            </h3>
            <button onClick={() => setShowIssuesWidget(false)} className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100">
               <X size={20} />
            </button>
         </div>
         <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 no-scrollbar relative">
            <ErrorsPanel errors={errorsData} />
         </div>
      </div>
      
      {/* Overlay backdrop */}
      {showIssuesWidget && (
         <div className="fixed inset-0 bg-slate-900/10 z-[55] backdrop-blur-[2px] transition-opacity duration-300" onClick={() => setShowIssuesWidget(false)}></div>
      )}
    </div>
  );
}
