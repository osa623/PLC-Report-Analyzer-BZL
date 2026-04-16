import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import {
  checkHealth,
  uploadReport,
  fetchStages,
  fetchValidated,
  fetchAnalytics,
  fetchErrors,
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

  // ─── Context tab ───────────────────────────────────────────
  const [contextTab, setContextTab] = useState('Pipeline Overview');

  // ─── Polling ref ───────────────────────────────────────────
  const pollRef = useRef(null);
  const hydratedRef = useRef(false);
  const validatedLoadedRef = useRef(false);
  const errorsLoadedRef = useRef(false);
  const analyticsLoadedRef = useRef(false);

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
          let validationPayloadLoaded = validatedLoadedRef.current;
          let errorsPayloadLoaded = errorsLoadedRef.current;
          let analyticsPayloadLoaded = analyticsLoadedRef.current;

          const validationDone = stages.stages?.some(
            (s) => s.stage === 'VALIDATION' && s.status === 'completed'
          );
          if (validationDone) {
            try {
              const vd = await fetchValidated(id);
              setValidatedData(vd);
              validationPayloadLoaded = Boolean(vd?.validated);
              if (validationPayloadLoaded) {
                validatedLoadedRef.current = true;
              }
            } catch (_) {}

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
            (s) => s.stage === 'ANALYTICS' && s.status === 'completed'
          );
          if (analyticsDone) {
            try {
              const ad = await fetchAnalytics(id);
              setAnalyticsData(ad);
              analyticsPayloadLoaded = Boolean(ad && typeof ad === 'object');
              if (analyticsPayloadLoaded) {
                analyticsLoadedRef.current = true;
              }
            } catch (_) {}
          }

          const canStopCompleted =
            wf === 'COMPLETED' &&
            validationPayloadLoaded &&
            errorsPayloadLoaded &&
            analyticsPayloadLoaded;

          const canStopLowConfidence =
            wf === 'LOW_CONFIDENCE' &&
            validationPayloadLoaded &&
            errorsPayloadLoaded;

          if (wf === 'FAILED' || canStopCompleted || canStopLowConfidence) {
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
    []
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
    persistPipelineSession({ reportId, companyInfo, contextTab });
  }, [reportId, companyInfo, contextTab, clearPipelineSession, persistPipelineSession]);

  // ─── Upload handler ────────────────────────────────────────
  const handleUpload = async (file, company) => {
    setIsUploading(true);
    setUploadError(null);
    setStagesData(null);
    setValidatedData(null);
    setAnalyticsData(null);
    setErrorsData(null);

    try {
      const result = await uploadReport(file, company);
      const id = result.report_id;
      setReportId(id);
      setCompanyInfo(`${company.name} — ${company.sector}`);
      setContextTab('Pipeline Overview');
      persistPipelineSession({
        reportId: id,
        companyInfo: `${company.name} — ${company.sector}`,
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
  const qualityScore = validatedData?.validated?.overall_data_quality_score ?? null;
  const stages = stagesData?.stages || [];
  const workflowState = stagesData?.workflow_state || null;

  // ─── Render helpers ────────────────────────────────────────
  const renderPipelineOverview = () => (
    <div className="space-y-5 fade-in">
      <PipelineStepper stages={stages} />

      {/* Three-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr_0.8fr] gap-4 items-start">
        <ValidatedDataTable data={validatedData} />
        <AnalyticsCards analytics={analyticsData} />
        <ErrorsPanel errors={errorsData} />
      </div>

      {/* Bottom row: charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConfidenceChart validatedData={validatedData} />
        <QualitySummary validatedData={validatedData} errors={errorsData} />
      </div>

      <TrendCharts validatedData={validatedData} />

      {/* Download section */}
      {workflowState === 'COMPLETED' && reportId && (
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

      {/* Low confidence notice */}
      {workflowState === 'LOW_CONFIDENCE' && (
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-5 flex gap-3 items-center">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="text-[13px] font-semibold text-amber-800 tracking-[-0.01em]">
              Low Confidence — Analytics & Report Skipped
            </div>
            <div className="text-[12px] text-amber-700 mt-1 tracking-[-0.01em]">
              The overall data quality score is below the threshold. Review errors and validated data to diagnose issues.
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderValidatedDataTab = () => (
    <div className="space-y-5 fade-in">
      <ValidatedDataTable data={validatedData} />
      <TrendCharts validatedData={validatedData} />
    </div>
  );

  const renderAnalyticsTab = () => (
    <div className="space-y-5 fade-in">
      <AnalyticsCards analytics={analyticsData} />
      <TrendCharts validatedData={validatedData} />
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
    <div className="min-h-screen bg-slate-50">
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

      <main className="max-w-[1340px] mx-auto px-6 lg:px-8 py-6 pb-16">
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
                  <div className="text-2xl font-bold text-slate-900 tracking-[-0.025em]">65%</div>
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
    </div>
  );
}
