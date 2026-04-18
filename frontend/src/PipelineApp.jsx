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

      const poll = async () => {
        try {
          const stages = await fetchStages(id);
          setStagesData(stages);

          const wf = stages.workflow_state;

          // Fetch validated data when validation is complete or beyond
          const validationDone = stages.stages?.some(
            (s) => s.stage === 'VALIDATION' && s.status === 'completed'
          );
          if (validationDone) {
            try {
              const vd = await fetchValidated(id);
              setValidatedData(vd);
            } catch (_) {}

            try {
              const ed = await fetchErrors(id);
              setErrorsData(ed);
            } catch (_) {}
          }

          // Fetch analytics when analytics done
          const analyticsDone = stages.stages?.some(
            (s) => s.stage === 'ANALYTICS' && s.status === 'completed'
          );
          if (analyticsDone) {
            try {
              const ad = await fetchAnalytics(id);
              setAnalyticsData(ad);
            } catch (_) {}
          }

          // Stop polling when pipeline reaches terminal state
          if (['COMPLETED', 'FAILED', 'LOW_CONFIDENCE'].includes(wf)) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } catch (err) {
          console.warn('Poll error:', err.message);
        }
      };

      // Immediate first poll
      poll();
      pollRef.current = setInterval(poll, 3000);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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
      startPolling(id);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Upload failed. Check if backend is running.';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="fade-in">
      <PipelineStepper stages={stages} />

      {/* Responsive grid: table + metrics + errors */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <ValidatedDataTable data={validatedData} />
        <AnalyticsCards analytics={analyticsData} />
        <ErrorsPanel errors={errorsData} />
      </div>

      {/* Bottom row: charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ConfidenceChart validatedData={validatedData} />
        <QualitySummary validatedData={validatedData} errors={errorsData} />
      </div>

      {/* Trend charts */}
      <TrendCharts validatedData={validatedData} analytics={analyticsData} />

      {/* Download section */}
      {workflowState === 'COMPLETED' && reportId && (
        <div className="card" style={{ padding: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <a
            href={downloadReportUrl(reportId)}
            download
            id="download-report-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#2d3a8c',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background 0.2s',
            }}
          >
            Download Analysis Report (PDF)
          </a>
        </div>
      )}

      {/* Low confidence notice */}
      {workflowState === 'LOW_CONFIDENCE' && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 10,
            padding: 20,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, color: '#92400e', fontSize: 14 }}>
              Low Confidence — Analytics & Report Skipped
            </div>
            <div style={{ fontSize: 13, color: '#a16207', marginTop: 4 }}>
              The overall data quality score is below the threshold. Review errors and validated data to diagnose issues.
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderValidatedDataTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="fade-in">
      <ValidatedDataTable data={validatedData} />
      <TrendCharts validatedData={validatedData} analytics={analyticsData} />
    </div>
  );

  const renderAnalyticsTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="fade-in">
      <AnalyticsCards analytics={analyticsData} />
      <TrendCharts validatedData={validatedData} analytics={analyticsData} />
    </div>
  );

  const renderErrorsTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="fade-in">
      <ErrorsPanel errors={errorsData} />
      <ConfidenceChart validatedData={validatedData} />
    </div>
  );

  const renderQualityTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="fade-in">
      <QualitySummary validatedData={validatedData} errors={errorsData} />
      <ConfidenceChart validatedData={validatedData} />
    </div>
  );

  const renderContextContent = () => {
    if (!reportId) return null;

    switch (contextTab) {
      case 'Pipeline Overview':
        return renderPipelineOverview();
      case 'Validated Data':
        return renderValidatedDataTab();
      case 'Analytics':
        return renderAnalyticsTab();
      case 'Errors & Warnings':
        return renderErrorsTab();
      case 'Data Quality Summary':
        return renderQualityTab();
      default:
        return renderPipelineOverview();
    }
  };

  // ─── Main layout ───────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
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

      <main style={{ maxWidth: 1340, margin: '0 auto', padding: '24px 28px 60px' }}>
        {/* Dashboard tab */}
        {globalTab === 'Dashboard' && (
          <>
            {!reportId ? (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 32, marginTop: 40 }}>
                  <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                    Financial Report Analysis
                  </h1>
                  <p style={{ color: '#64748b', fontSize: 15, marginTop: 8 }}>
                    Upload an annual report PDF to begin pipeline analysis with validation and quality scoring.
                  </p>
                </div>
                <UploadCard onUpload={handleUpload} isUploading={isUploading} />
                {uploadError && (
                  <div
                    style={{
                      maxWidth: 560,
                      margin: '16px auto 0',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 8,
                      padding: '12px 16px',
                      color: '#991b1b',
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {uploadError}
                  </div>
                )}
              </div>
            ) : (
              renderContextContent()
            )}
          </>
        )}

        {/* Reports tab — placeholder with upload option */}
        {globalTab === 'Reports' && (
          <div className="fade-in">
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>
              Reports
            </h2>
            {reportId ? (
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Current Report: {reportId.slice(0, 12)}...</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{companyInfo}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>State: {workflowState || 'UPLOADED'}</div>
                  </div>
                  <button
                    onClick={() => {
                      setReportId(null);
                      setStagesData(null);
                      setValidatedData(null);
                      setAnalyticsData(null);
                      setErrorsData(null);
                      setCompanyInfo(null);
                      if (pollRef.current) clearInterval(pollRef.current);
                    }}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      padding: '8px 16px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
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
          <div className="fade-in" style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#475569' }}>Comparative Analysis</h2>
            <p style={{ fontSize: 14 }}>
              Upload multiple reports to enable cross-report comparison. Available after batch processing.
            </p>
          </div>
        )}

        {/* Settings tab */}
        {globalTab === 'Settings' && (
          <div className="fade-in">
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>Settings</h2>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    Analytics Quality Threshold
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>65%</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    Reports below this will skip analytics and report generation
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    API Status
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: connected ? '#22c55e' : '#ef4444',
                    }}
                  >
                    {connected ? '● Connected' : '● Disconnected'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
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
