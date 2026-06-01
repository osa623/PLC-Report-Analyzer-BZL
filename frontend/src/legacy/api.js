import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

const http = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// ─── Health ──────────────────────────────────────────────────
export async function checkHealth() {
  const res = await http.get('/health');
  return res.data;
}

// ─── Upload ──────────────────────────────────────────────────
export async function uploadReport(fileOrFiles, company = {}) {
  const formData = new FormData();
  if (Array.isArray(fileOrFiles)) {
    fileOrFiles.forEach((file) => formData.append('report', file));
  } else {
    formData.append('report', fileOrFiles);
  }
  formData.append('symbol', company.symbol || 'UNKNOWN');
  formData.append('name', company.name || 'Unknown Company');
  formData.append('sector', company.sector || 'Diversified');

  const res = await http.post('/reports', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return res.data;
}

// ─── Pipeline Stages ─────────────────────────────────────────
export async function fetchStages(reportId) {
  const res = await http.get(`/pipeline/${reportId}/stages`);
  const payload = res.data;

  // Normalize various backend response shapes into a consistent frontend shape:
  // { stages: [ { stage, status, ... } ], workflow_state }
  function normalizeStages(data) {
    if (!data) return data;

    const out = { ...data };

    // Normalize workflow state naming
    out.workflow_state = data.workflow_state || data.workflowState || data.state || null;

    // Normalize stages
    let stagesArr = [];
    if (Array.isArray(data.stages)) {
      stagesArr = data.stages
        .map((s) => {
          if (!s) return null;
          // Accept objects with different keys: { stage, name, id } and status variants
          const stageName = s.stage || s.name || s.id || s.key || s.stage_name || s.stageId || null;
          let status = s.status || s.state || s.result || s.phase || s.status_code || null;
          if (typeof status === 'string') {
            const st = status.toLowerCase();
            if (['done', 'finished', 'complete', 'completed', 'ok', 'success'].includes(st)) status = 'completed';
            else if (['fail', 'failed', 'error', 'errored'].includes(st)) status = 'failed';
            else if (['pending', 'waiting', 'queued', 'todo', 'not_started'].includes(st)) status = 'pending';
            else if (['running', 'in_progress', 'processing', 'active'].includes(st)) status = 'running';
          } else if (typeof status === 'boolean') {
            status = status ? 'completed' : 'pending';
          } else if (typeof status === 'number') {
            status = status === 1 ? 'completed' : 'pending';
          }

          // Normalize duration fields
          const duration_ms = s.duration_ms ?? s.durationMs ?? s.duration ?? null;

          return {
            ...s,
            stage: stageName || s.stage || s.name,
            status: status || s.status || 'pending',
            duration_ms,
          };
        })
        .filter(Boolean);
    } else if (data.stages && typeof data.stages === 'object') {
      // e.g. { stages: { DOCUMENT_INGESTION: 'completed', ... } }
      stagesArr = Object.keys(data.stages).map((k) => ({ stage: k, status: data.stages[k] }));
    }

    out.stages = stagesArr;
    return out;
  }

  return normalizeStages(payload);
}

// Debug helper: log normalized stages in dev
if (import.meta.env.DEV) {
  const _origFetchStages = fetchStages;
  fetchStages = async function (reportId) {
    const res = await _origFetchStages(reportId);
    try {
      // eslint-disable-next-line no-console
      console.debug('fetchStages normalized ->', res);
    } catch (_) {}
    return res;
  };
}

// ─── Pipeline Data ───────────────────────────────────────────
export async function fetchRaw(reportId) {
  const res = await http.get(`/pipeline/${reportId}/raw`);
  return res.data;
}

export async function fetchCanonical(reportId) {
  const res = await http.get(`/pipeline/${reportId}/canonical`);
  return res.data;
}

export async function fetchValidated(reportId) {
  const res = await http.get(`/pipeline/${reportId}/validated`);
  return res.data;
}

export async function fetchAnalytics(reportId) {
  const res = await http.get(`/pipeline/${reportId}/analytics`);
  return res.data;
}

export async function fetchCurrencyConverted(reportId, target = 'USD') {
  const res = await http.get('/currency/convert', {
    params: { reportId, target },
  });
  return res.data;
}

export async function fetchFxLatest() {
  const res = await http.get('/fx/latest');
  return res.data;
}

export async function fetchErrors(reportId) {
  const res = await http.get(`/pipeline/${reportId}/errors`);
  return res.data;
}

export async function fetchDocumentStatuses(reportId) {
  const res = await http.get(`/pipeline/${reportId}/documents`);
  return res.data;
}

// ─── Report ──────────────────────────────────────────────────
export async function fetchReport(reportId) {
  const res = await http.get(`/reports/${reportId}`);
  return res.data;
}

export function downloadReportUrl(reportId) {
  return `${API_BASE}/reports/${reportId}/download`;
}

export default http;
