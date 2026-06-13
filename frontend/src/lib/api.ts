export type PipelineStageStatus = "pending" | "running" | "completed" | "failed" | "skipped" | string;

export type PipelineDocument = {
  pdf_name?: string;
  name?: string;
  filename?: string;
  status?: PipelineStageStatus;
  stage?: string;
  message?: string;
  error?: string;
  messages?: Array<{ timestamp?: string; stage?: string; status?: string; message?: string; level?: string }>;
  toc_lines?: string[];
  toc_pages?: number[];
  statement_refs?: Record<string, number>;
  statement_pages?: Record<string, number[]>;
  statement_statuses?: Record<string, { status?: string; pages?: number[]; has_data?: boolean }>;
  statement_images?: Record<string, Array<{ url: string; page?: number; filename?: string }>>;
  manual_page_mapping?: Record<string, number[]>;
};

export type PipelineStagesResponse = {
  report_id: string;
  pipeline_status?: string;
  workflow_state?: string;
  stages?: Array<{ stage?: string; status?: PipelineStageStatus; diagnostics?: Record<string, unknown> }>;
  extraction_substages?: Record<string, { status?: PipelineStageStatus; diagnostics?: Record<string, unknown> }>;
  pipeline_monitor?: {
    documents?: Record<string, PipelineDocument> | PipelineDocument[];
    extractionFailure?: unknown;
  };
};

export type DocumentsResponse = {
  report_id: string;
  documents: PipelineDocument[];
  counts?: Record<string, number>;
};

export type ValidatedRow = {
  row_id?: string;
  canonical_label?: string;
  original_label?: string;
  value?: number | string | null;
  year?: string | number | null;
  statement_type?: string;
  confidence_score?: number;
  page_number?: number | null;
  report_name?: string;
  report_year?: string | number | null;
  source_path?: string;
};

export type DocumentExtractedData = {
  report_id: string;
  pdf_name: string;
  report_year?: string | null;
  statement_pages?: Record<string, number[]>;
  statement_statuses?: Record<string, { status?: string; pages?: number[]; has_data?: boolean }>;
  rows: ValidatedRow[];
  by_statement?: Record<string, ValidatedRow[]>;
  by_year?: Record<string, ValidatedRow[]>;
  raw_result?: Record<string, unknown>;
};

export type ManualPdf = {
  id: string;
  name: string;
  company?: string;
  category?: string;
  year?: string;
};

export type ManualStatement = {
  type: string;
  title: string;
  confidence?: number;
  pages?: string;
  images?: Array<{ url: string; page?: number; filename?: string }>;
  evidence?: string[];
};

const REPORT_ID_KEY = "fdi.currentReportId";
const FILE_NAMES_KEY = "fdi.currentFileNames";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === "string" ? payload : payload?.error || payload?.detail || "Request failed";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return payload as T;
}

export function saveCurrentReport(reportId: string, files: File[] = []) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REPORT_ID_KEY, reportId);
  window.localStorage.setItem(FILE_NAMES_KEY, JSON.stringify(files.map((file) => file.name)));
}

export function getCurrentReportId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(REPORT_ID_KEY) || "";
}

export function getCurrentFileNames() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FILE_NAMES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function uploadReports(files: File[], metadata: { symbol?: string; name?: string; sector?: string } = {}) {
  const form = new FormData();
  files.forEach((file) => form.append("report", file));
  form.append("symbol", metadata.symbol || "UNKNOWN");
  form.append("name", metadata.name || "Unknown Company");
  form.append("sector", metadata.sector || "Diversified");

  const data = await request<{ report_id: string; pipeline_status?: string; workflow_state?: string }>("/api/reports", {
    method: "POST",
    body: form,
  });
  saveCurrentReport(data.report_id, files);
  return data;
}

export function getPipelineStages(reportId: string) {
  return request<PipelineStagesResponse>(`/api/pipeline/${reportId}/stages`);
}

export function getDocumentStatuses(reportId: string) {
  return request<DocumentsResponse>(`/api/pipeline/${reportId}/documents`);
}

export function getValidatedData(reportId: string) {
  return request<{ report_id: string; pipeline_status?: string; validated?: { validated_rows?: ValidatedRow[]; overall_data_quality_score?: number } }>(
    `/api/pipeline/${reportId}/validated`,
  );
}

export function getDocumentExtractedData(reportId: string, pdfName: string) {
  return request<DocumentExtractedData>(`/api/pipeline/${reportId}/documents/${encodeURIComponent(pdfName)}/data`);
}

export function getAnalytics(reportId: string) {
  return request<Record<string, unknown>>(`/api/pipeline/${reportId}/analytics`);
}

export function getFullReport(reportId: string) {
  return request<Record<string, any>>(`/api/reports/${reportId}`);
}

export function getPipelineErrors(reportId: string) {
  return request<Record<string, unknown>>(`/api/pipeline/${reportId}/errors`);
}

export function listManualPdfs() {
  return request<ManualPdf[]>("/annual-api/api/pdfs");
}

export function detectManualStatements(pdfId: string) {
  return request<{ pdf?: ManualPdf; statements?: ManualStatement[]; extraction_success?: boolean; error?: string }>(
    `/annual-api/api/pdfs/${pdfId}/extract`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
  );
}

export function extractManualPages(pdfId: string, selectedPages: Record<string, number[]>) {
  return request<Record<string, unknown>>(`/annual-api/api/pdfs/${pdfId}/extract-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selectedPages }),
  });
}

export function retryDocumentExtraction(reportId: string, pdfName: string, selectedPages: Record<string, number[]>) {
  return request<Record<string, unknown>>(
    `/api/pipeline/${reportId}/documents/${encodeURIComponent(pdfName)}/retry-extraction`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedPages }),
    },
  );
}
