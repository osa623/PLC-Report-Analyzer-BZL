import axios from 'axios';

// Use environment variable or default to localhost
const API_BASE_URL = import.meta.env.VITE_ANNUAL_API_URL || '/annual-api/api';
const GATEWAY_BASE_URL = import.meta.env.VITE_GATEWAY_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const gatewayApi = axios.create({
  baseURL: GATEWAY_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const pdfService = {

  /**
   * Upload a PDF file for processing.
   * Returns { success, pdf_id, filename, size_mb }
   */
  uploadPDF: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return response.data;
  },

  /**
   * Run extraction on a previously uploaded PDF.
   * Returns { success, pdf_id, filename, data: { income_statement, balance_sheet, cash_flow, additional_sections } }
   */
  extractPDF: async (pdfId) => {
    const response = await api.post(`/extract/${pdfId}`, {}, {
      timeout: 600000, // 10 min — 3 sequential extraction calls for large PDFs
    });
    return response.data;
  },

  /**
   * Extract a SINGLE statement type from the uploaded PDF.
   * @param {string} pdfId
   * @param {string} statementKey - e.g. 'income_statement', 'balance_sheet', 'cash_flow',
   *   'comprehensive_income', 'changes_in_equity', 'auditors_report'
   * @returns {{ success, pdf_id, statement_key, display_name, data }}
   */
  extractStatement: async (pdfId, statementKey) => {
    const response = await api.post(`/extract/${pdfId}/${statementKey}`, {}, {
      timeout: 600000, // 10 min for single statement — large PDFs can be slow
    });
    return response.data;
  },

  extractFullReportAsync: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/extract/full-report?async=true', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return response.data;
  },

  getFullReportResult: async (jobId) => {
    const response = await api.get(`/extract/full-report/result/${jobId}`, {
      timeout: 60000,
    });
    return response.data;
  },

  createFullReportProgressStream: (jobId, onProgress) => {
    const eventSource = new EventSource(`${API_BASE_URL}/extract/full-report/progress/${jobId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress(data);
        if (data.step === -1) {
          eventSource.close();
        }
      } catch (e) {
        console.error('full-report SSE parse error:', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return eventSource;
  },

  generateAnalyticalReport: async (payload) => {
    const response = await gatewayApi.post('/intelligence/generate-report', payload, {
      responseType: payload?.format === 'json' ? 'json' : 'blob',
      timeout: 180000,
    });
    return response;
  },

  runFullIntelligence: async (files) => {
    const formData = new FormData();
    (files || []).forEach((file) => formData.append('pdf_files', file));

    const response = await gatewayApi.post('/intelligence/full-intelligence', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 360000,
    });

    return response.data;
  },

  /**
   * Connect to SSE progress stream for real-time extraction updates.
   * Opens an EventSource to the backend and calls onProgress(data) for each event.
   * Returns the EventSource instance (caller should close it when done).
   *
   * @param {string} pdfId
   * @param {(data: {step: number, total: number, message: string}) => void} onProgress
   * @returns {EventSource}
   */
  createProgressStream: (pdfId, onProgress) => {
    const baseUrl = API_BASE_URL;
    const eventSource = new EventSource(`${baseUrl}/extract/${pdfId}/progress`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress(data);
        if (data.step === -1) {
          eventSource.close();
        }
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return eventSource;
  },

  /**
   * Export extracted data in the given format.
   * Downloads the file directly.
   * @param {'json'|'xlsx'|'csv'|'pdf'|'docx'} format
   */
  exportData: async (pdfId, format) => {
    const response = await api.post(`/export/${pdfId}?format=${format}`, {}, {
      responseType: 'blob',
      timeout: 60000,
    });

    // Trigger browser download
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const ext = format === 'xlsx' ? 'xlsx' : format === 'docx' ? 'docx' : format;
    a.download = `extracted_data.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  /**
   * Run the full pipeline (extraction → analysis → reporting) for multiple PDFs.
   * @param {File[]} files - Array of PDF files to process (max 5)
   * @returns {{ report_id, workflow_state, message }}
   */
  runFullPipeline: async (files) => {
    const formData = new FormData();
    (files || []).forEach((file) => formData.append('report', file));
    const response = await gatewayApi.post('/intelligence/reports', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    });
    return response.data;
  },

  /**
   * Poll pipeline stages for a report.
   * @param {string} reportId
   * @returns {{ report_id, workflow_state, stages, extraction_substages }}
   */
  getPipelineStages: async (reportId) => {
    const response = await gatewayApi.get(`/intelligence/pipeline/${reportId}/stages`, {
      timeout: 30000,
    });
    const data = response.data;
    // Normalize response shape to { stages: [{stage, status, ...}], workflow_state }
    const normalize = (payload) => {
      if (!payload) return payload;
      const out = { ...payload };
      out.workflow_state = payload.workflow_state || payload.workflowState || payload.state || null;
      let stagesArr = [];
      if (Array.isArray(payload.stages)) {
        stagesArr = payload.stages.map((s) => {
          if (!s) return null;
          const stageName = s.stage || s.name || s.key || s.id || null;
          let status = s.status || s.state || s.result || s.phase || s.status_code || null;
          if (typeof status === 'string') {
            const st = status.toLowerCase();
            if (['done','finished','complete','completed','ok','success'].includes(st)) status = 'completed';
            else if (['fail','failed','error','errored'].includes(st)) status = 'failed';
            else if (['pending','waiting','queued','todo','not_started'].includes(st)) status = 'pending';
            else if (['running','in_progress','processing','active'].includes(st)) status = 'running';
          } else if (typeof status === 'boolean') status = status ? 'completed' : 'pending';
          const duration_ms = s.duration_ms ?? s.durationMs ?? s.duration ?? null;
          return { ...s, stage: stageName || s.stage, status: status || 'pending', duration_ms };
        }).filter(Boolean);
      } else if (payload.stages && typeof payload.stages === 'object') {
        stagesArr = Object.keys(payload.stages).map((k) => ({ stage: k, status: payload.stages[k] }));
      }
      out.stages = stagesArr;
      return out;
    };

    return normalize(data);
  },

  // Debug helper: log normalized pipeline stages in dev
  // Note: this decorates getPipelineStages only in dev builds
  ...(import.meta.env.DEV ? {
    _debug_wrap_getPipelineStages: (async function () {
      const orig = pdfService.getPipelineStages;
      pdfService.getPipelineStages = async function (reportId) {
        const res = await orig.call(this, reportId);
        try { console.debug('getPipelineStages normalized ->', res); } catch (_) {}
        return res;
      };
      return true;
    })()
  } : {}),

  /**
   * Get full report data.
   * @param {string} reportId
   * @returns {object} Full report payload
   */
  getReport: async (reportId) => {
    const response = await gatewayApi.get(`/intelligence/reports/${reportId}`, {
      timeout: 60000,
    });
    return response.data;
  },

  /**
   * Get per-document processing statuses for a pipeline report.
   * @param {string} reportId
   * @returns {{ report_id, documents, counts }}
   */
  getDocumentStatuses: async (reportId) => {
    const response = await gatewayApi.get(`/pipeline/${reportId}/documents`, {
      timeout: 15000,
    });
    return response.data;
  },

  /**
   * Get validated (canonical) data after analysis completes.
   * @param {string} reportId
   * @returns {{ report_id, validated }}
   */
  getValidatedData: async (reportId) => {
    const response = await gatewayApi.get(`/pipeline/${reportId}/validated`, {
      timeout: 30000,
    });
    return response.data;
  },

  /**
   * Get analytics data (ratios, patterns, risk, confidence).
   * @param {string} reportId
   * @returns {{ report_id, ratios, patterns, risk, sector_kpis, confidence, analysis_coverage }}
   */
  getAnalyticsData: async (reportId) => {
    const response = await gatewayApi.get(`/pipeline/${reportId}/analytics`, {
      timeout: 30000,
    });
    return response.data;
  },

  /**
   * Get validation errors and diagnostics.
   * @param {string} reportId
   * @returns {{ report_id, error_catalog, missing_values, ... }}
   */
  getErrorsData: async (reportId) => {
    const response = await gatewayApi.get(`/pipeline/${reportId}/errors`, {
      timeout: 15000,
    });
    return response.data;
  },

  /**
   * Get the download URL for a completed report.
   * @param {string} reportId
   * @returns {string}
   */
  getReportDownloadUrl: (reportId) => {
    const base = import.meta.env.VITE_GATEWAY_URL || '/api';
    return `${base}/reports/${reportId}/download`;
  },

  // ── Company Data APIs ──
  getCompanyExtracted: async (companyId) => {
    const response = await gatewayApi.get(`/company/${companyId}/extracted`, { timeout: 30000 });
    return response.data;
  },

  updateCompanyExtracted: async (companyId, financials) => {
    const response = await gatewayApi.put(`/company/${companyId}/extracted`, { financials }, { timeout: 30000 });
    return response.data;
  },

  reanalyseCompany: async (companyId) => {
    const response = await gatewayApi.post(`/company/${companyId}/reanalyse`, {}, { timeout: 180000 });
    return response.data;
  },

  getCompanyAnalysis: async (companyId) => {
    const response = await gatewayApi.get(`/company/${companyId}/analysis`, { timeout: 30000 });
    return response.data;
  },

  getCompanyHistory: async (companyId) => {
    const response = await gatewayApi.get(`/company/${companyId}/history`, { timeout: 30000 });
    return response.data;
  },

  exportCompanyReport: async (companyId, format = 'pdf') => {
    const response = await gatewayApi.get(`/company/${companyId}/export?format=${format}`, {
      responseType: 'blob',
      timeout: 120000,
    });
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyId}_report.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  listCompanies: async () => {
    const response = await gatewayApi.get('/companies', { timeout: 30000 });
    return response.data;
  },

  // ── Batch Management API ──
  fetchBatches: async () => {
    const response = await gatewayApi.get('/pipeline/batches', { timeout: 15000 });
    return response.data;
  },

  fetchBatchStatus: async (batchId) => {
    const response = await gatewayApi.get(`/pipeline/batches/${batchId}/status`, { timeout: 15000 });
    return response.data;
  },

  fetchBatchResults: async (batchId) => {
    const response = await gatewayApi.get(`/pipeline/batches/${batchId}/results`, { timeout: 30000 });
    return response.data;
  },

  /**
   * Health check
   */
  healthCheck: async () => {
    const response = await api.get('/health');
    return response.data;
  },
};

export default api;
