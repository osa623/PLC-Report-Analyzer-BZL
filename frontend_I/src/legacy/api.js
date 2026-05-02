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
  return res.data;
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
