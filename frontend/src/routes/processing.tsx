import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { Pipeline } from "@/components/Pipeline";
import { processingFiles } from "@/lib/mock-data";
import { getCurrentFileNames, getCurrentReportId, getDocumentStatuses, getPipelineStages, type PipelineDocument } from "@/lib/api";
import {
  FileText,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Table2,
  MapPinned,
  Plus,
  Activity,
  Shield,
  Info,
  Clock,
  Lock,
  MessageSquare,
  Layers,
  ChevronRight,
  ChevronDown,
  Calendar,
  X,
  Check
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useCompanyStore } from "@/lib/store/company-store";

export const Route = createFileRoute("/processing")({
  head: () => ({
    meta: [
      { title: "Processing - FDI" },
      { name: "description", content: "Track extraction progress of uploaded documents." }
    ]
  }),
  component: ProcessingPage,
});

const EXTRACTION_STAGES = ["Upload", "Parsing", "Structure", "Extraction"];
const STATEMENT_LABELS: Record<string, string> = {
  income_statement: "Income Statement",
  balance_sheet: "Balance Sheet",
  cash_flow: "Cash Flow Statement",
  equity: "Statement of Equity",
  comprehensive_income: "Comprehensive Income",
};

function documentName(doc: PipelineDocument) {
  return doc.pdf_name || doc.filename || doc.name || "Annual report";
}

function statusTone(status = "pending") {
  const value = status.toLowerCase();
  if (value === "completed") return "text-green-600";
  if (value === "failed") return "text-red-500";
  if (value === "running" || value === "processing") return "text-orange-500";
  return "text-slate-400";
}

function progressFromStatus(doc: PipelineDocument) {
  const status = String(doc.status || "pending").toLowerCase();
  const stage = String(doc.stage || "UPLOAD").toUpperCase();

  if (status === "completed") return { stageIndex: 3, progress: 100 };
  if (status === "failed") return { stageIndex: 3, progress: 100 };
  if (stage.includes("EXTRACTION")) return { stageIndex: 3, progress: status === "running" ? 65 : 20 };
  if (stage.includes("STRUCTURE")) return { stageIndex: 2, progress: 50 };
  if (stage.includes("PARS")) return { stageIndex: 1, progress: 50 };
  return { stageIndex: 0, progress: status === "running" ? 75 : 100 };
}

function messageFor(doc: PipelineDocument) {
  const status = String(doc.status || "pending").toLowerCase();
  if (doc.error) return doc.error;
  if (doc.message) return doc.message;
  if (status === "completed") return "Extraction completed successfully";
  if (status === "failed") return "Extraction failed";
  if (status === "running") return `Backend is processing ${doc.stage || "extraction"}`;
  return "Waiting for pipeline";
}

function fallbackDocuments() {
  const stored = getCurrentFileNames();
  if (stored.length) {
    return stored.map((name) => ({ pdf_name: name, status: "pending", stage: "UPLOAD" }));
  }
  return [
    { pdf_name: "Annual_Report_2021.pdf", status: "completed", stage: "EXTRACTION" },
    { pdf_name: "Annual_Report_2025.pdf", status: "running", stage: "UPLOAD" },
    { pdf_name: "Annual_Report_2023.pdf", status: "running", stage: "EXTRACTION" },
    { pdf_name: "Annual_Report_2019.pdf", status: "failed", stage: "EXTRACTION" }
  ];
}

function ProcessingPage() {
  const [reportId, setReportId] = useState("");
  const [documents, setDocuments] = useState<PipelineDocument[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // UI States
  const [filter, setFilter] = useState<"All" | "Running" | "Completed" | "Failed">("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  const [activeTabs, setActiveTabs] = useState<Record<string, "messages" | "categories" | "info">>({});

  const load = async () => {
    const current = getCurrentReportId();
    setReportId(current);
    if (!current) {
      const fallback = fallbackDocuments();
      setDocuments(fallback);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [stages, docs] = await Promise.all([getPipelineStages(current), getDocumentStatuses(current)]);
      setPipelineStatus(stages.pipeline_status || stages.workflow_state || "PROCESSING");
      setDocuments(docs.documents?.length ? docs.documents : fallbackDocuments());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load pipeline status");
      setDocuments(fallbackDocuments());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, 5000);
    return () => window.clearInterval(id);
  }, []);

  // Default expand the first document if none are set
  useEffect(() => {
    if (documents.length > 0 && Object.keys(expandedDocs).length === 0) {
      const firstDocName = documentName(documents[0]);
      setExpandedDocs({ [firstDocName]: true });
    }
  }, [documents]);

  const counts = useMemo(() => {
    let completed = 0;
    let failed = 0;
    let running = 0;

    documents.forEach((doc) => {
      const rawStatus = String(doc.status || "pending").toLowerCase();
      if (rawStatus === "completed") completed++;
      else if (rawStatus === "failed") failed++;
      else running++;
    });

    return { completed, failed, running, total: documents.length };
  }, [documents]);

  const derivedPipelineStatus = useMemo(() => {
    const allCompleted = documents.length > 0 &&
      documents.every(d => d.status?.toLowerCase() === "completed");
    const anyRunning = documents.some(d => d.status?.toLowerCase() === "running" || d.status?.toLowerCase() === "pending");

    if (anyRunning) return "RUNNING";
    if (allCompleted) return "COMPLETED";
    return pipelineStatus;
  }, [documents, pipelineStatus]);

  // Filtering documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const rawStatus = String(doc.status || "pending").toLowerCase();
      const failed = rawStatus === "failed";
      const completed = rawStatus === "completed";
      const running = !failed && !completed;

      if (filter === "All") return true;
      if (filter === "Running") return running;
      if (filter === "Completed") return completed;
      if (filter === "Failed") return failed;
      return true;
    });
  }, [documents, filter]);

  // Sorting documents
  const sortedDocuments = useMemo(() => {
    const list = [...filteredDocuments];
    if (sortBy === "name") {
      list.sort((a, b) => documentName(a).localeCompare(documentName(b)));
    } else if (sortBy === "oldest") {
      list.reverse();
    }
    return list;
  }, [filteredDocuments, sortBy]);

  const toggleExpanded = (docName: string) => {
    setExpandedDocs((prev) => ({ ...prev, [docName]: !prev[docName] }));
  };

  const setTab = (docName: string, tab: "messages" | "categories" | "info") => {
    setActiveTabs((prev) => ({ ...prev, [docName]: tab }));
  };

  const company = useCompanyStore((s) => s.company);
  const completionPercent = counts.total > 0 ? (counts.completed / counts.total) * 100 : 0;

  return (
    <Page>
      {/* ── Page Header Section ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-[#0B1F3A]">
            Processing Progress
          </h1>
          <p className="mt-1.5 text-[14px] text-gray-500">
            Monitor the status of your annual reports as they move through our AI-powered extraction pipeline.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B1F3A] px-5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Another Report to the Batch
          </Link>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {/* ── Top Stats Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Card 1: Company Details */}
        <div className="bg-white border border-gray-100 rounded-3xl p-5 flex items-center gap-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Company
            </span>
            <span className="text-[15px] font-extrabold text-slate-800 truncate block mt-0.5">
              {company.companyName || "HAYLEYS PLC"} <span className="font-normal text-slate-400 text-xs ml-1">({company.ticker || "HAYL.N0000"})</span>
            </span>
          </div>
        </div>

        {/* Card 2: Pipeline Status */}
        <div className="bg-white border border-gray-100 rounded-3xl p-5 flex items-center gap-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Pipeline Status
            </span>
            <span className={`text-[15px] font-extrabold uppercase block mt-0.5 ${
              derivedPipelineStatus === "COMPLETED" ? "text-green-600" :
              derivedPipelineStatus === "RUNNING" ? "text-blue-600" : "text-red-500"
            }`}>
              {derivedPipelineStatus}
            </span>
          </div>
        </div>

        {/* Card 3: Overall Progress */}
        <div className="bg-white border border-gray-100 rounded-3xl p-5 flex items-center gap-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Overall Progress
            </span>
            <span className="text-[15px] font-extrabold text-slate-800 block mt-0.5">
              {counts.completed}/{counts.total} completed
            </span>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar: Filter and Sort ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {(["All", "Running", "Completed", "Failed"] as const).map((t) => {
            const active = filter === t;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  active
                    ? "bg-[#0B1F3A] border-[#0B1F3A] text-white shadow-sm"
                    : "bg-white border-gray-200 text-slate-650 hover:bg-slate-50"
                }`}
              >
                {t === "All" ? "All Reports" : t}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs font-semibold text-slate-700 bg-white border border-gray-200 rounded-xl px-3 py-2 outline-none cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Alphabetical</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50/50 px-4 py-3 text-xs font-semibold text-red-600">
          {error}
        </div>
      )}

      {/* ── Documents Card List ── */}
      <div className="grid gap-4 mb-10">
        {sortedDocuments.map((doc, idx) => {
          const name = documentName(doc);
          const rawStatus = String(doc.status || "pending").toLowerCase();
          const failed = rawStatus === "failed";
          const allStatementsDone = doc.statement_statuses &&
            ["income_statement", "balance_sheet", "cash_flow", "equity", "comprehensive_income"].every(
              (key) => doc.statement_statuses![key]?.status?.toLowerCase() === "completed"
            );
          const completed = rawStatus === "completed" || (rawStatus === "completed" && allStatementsDone);
          const running = !failed && !completed;

          const progress = progressFromStatus(doc);
          const expanded = !!expandedDocs[name];
          const activeTab = activeTabs[name] || "messages";

          const messages = Array.isArray(doc.messages) && doc.messages.length
            ? doc.messages
            : [{ stage: doc.stage || "Extraction", status: doc.status || "running", message: messageFor(doc), timestamp: "" }];

          // Detect missing statements for failed ones
          const missingStatements = doc.statement_statuses
            ? Object.entries(doc.statement_statuses)
                .filter(([_, payload]) => String(payload?.status).toLowerCase() !== "completed")
                .map(([key]) => STATEMENT_LABELS[key] || key.replace(/_/g, " "))
            : ["Income Statement", "Balance Sheet", "Cash Flow Statement", "Equity", "Comprehensive Income"];

          return (
            <motion.div
              key={`${name}-${idx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={`bg-white border rounded-3xl p-5 md:p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] transition-all ${
                expanded ? "border-slate-200" : "border-gray-100"
              }`}
            >
              {/* Document Main Row */}
              <div className="grid items-center gap-6 md:grid-cols-[280px_1fr_230px]">
                {/* Left col: Title, message, date */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100">
                      <FileText className="h-6 w-6 text-[#0B1F3A]" />
                    </div>
                    {/* Floating status badge */}
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white bg-white">
                      {failed ? (
                        <div className="bg-red-500 rounded-full text-white flex items-center justify-center h-full w-full">
                          <X className="h-2.5 w-2.5" strokeWidth={3} />
                        </div>
                      ) : completed ? (
                        <div className="bg-green-500 rounded-full text-white flex items-center justify-center h-full w-full">
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="bg-orange-500 rounded-full text-white flex items-center justify-center h-full w-full">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 truncate">
                      {company.ticker ? `${company.ticker}-${name.replace(/\.pdf$/i, "").replace(/^\d+/, "").replace(/^[_\W]+/, "")}` : name}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-400 truncate">
                      {messageFor(doc)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[10.5px] text-slate-400">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>May 20, 2024 10:45 AM</span>
                    </div>
                  </div>
                </div>

                {/* Center col: Pipeline Flow */}
                <div className="px-2">
                  <Pipeline
                    stageIndex={progress.stageIndex}
                    progress={progress.progress}
                    stages={EXTRACTION_STAGES}
                    status={doc.status || "running"}
                  />
                </div>

                {/* Right col: Actions and status badge */}
                <div className="flex flex-col items-start md:items-end gap-2.5 text-left md:text-right">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    completed
                      ? "bg-green-50 text-green-700"
                      : failed
                        ? "bg-red-50 text-red-700"
                        : "bg-orange-50 text-orange-700"
                  }`}>
                    {completed ? "Completed" : failed ? "Failed" : "Running"}
                  </span>
                  <div className="flex gap-2 w-full md:w-auto justify-start md:justify-end">
                    <Link
                      to="/validation"
                      search={{ pdf: name }}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors ${
                        completed || failed ? "" : "pointer-events-none opacity-60"
                      }`}
                    >
                      <Table2 className="h-3.5 w-3.5" /> View Data
                    </Link>
                    <a
                      href={`/mapping?pdf=${encodeURIComponent(name)}`}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors`}
                    >
                      <MapPinned className="h-3.5 w-3.5" /> Manual Mapping
                    </a>
                  </div>
                </div>
              </div>

              {/* Expended Drawer Panel */}
              {expanded ? (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <div className="flex flex-col md:flex-row gap-5">
                    {/* Tabs layout - Left Column */}
                    <div className="flex flex-row md:flex-col gap-1 md:w-48 shrink-0">
                      <button
                        onClick={() => setTab(name, "messages")}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${
                          activeTab === "messages"
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Backend Messages
                      </button>
                      <button
                        onClick={() => setTab(name, "categories")}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${
                          activeTab === "categories"
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        Extracted Categories
                      </button>
                      <button
                        onClick={() => setTab(name, "info")}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${
                          activeTab === "info"
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <Info className="h-3.5 w-3.5" />
                        Report Info
                      </button>
                    </div>

                    {/* Tab contents - Right Column */}
                    <div className="flex-1 bg-slate-50/50 rounded-2xl border border-slate-100 p-4 max-h-[300px] overflow-y-auto">
                      {activeTab === "messages" && (
                        <div>
                          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Backend Extraction Messages
                          </div>
                          <div className="space-y-2">
                            {messages.map((event, eventIndex) => (
                              <div
                                key={`${name}-event-${eventIndex}`}
                                className="grid gap-2 text-[12px] md:grid-cols-[120px_100px_1fr] border-b border-slate-100/50 pb-2 last:border-0 last:pb-0"
                              >
                                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                                  {event.stage || "Extraction"}
                                </span>
                                <span className={`font-semibold uppercase text-[10px] ${statusTone(event.status || doc.status)}`}>
                                  {event.status || doc.status}
                                </span>
                                <span className="text-slate-600">
                                  {event.message || "Pipeline processing"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeTab === "categories" && (
                        <div>
                          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Statement Detection Status
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {["income_statement", "balance_sheet", "cash_flow", "equity", "comprehensive_income"].map((category) => {
                              const payload = doc.statement_statuses?.[category];
                              const status = String(payload?.status || "pending").toLowerCase();
                              const pages = payload?.pages || [];
                              const hasData = payload?.has_data !== false;

                              return (
                                <div
                                  key={category}
                                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white shadow-sm"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className={`h-2.5 w-2.5 rounded-full ${
                                      status === "completed" && hasData ? "bg-green-500" :
                                      status === "failed" || !hasData ? "bg-red-500" :
                                      "bg-slate-300"
                                    }`} />
                                    <span className="text-xs font-semibold text-slate-700">
                                      {STATEMENT_LABELS[category] || category.replace(/_/g, " ")}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-gray-400">
                                    {status === "completed" ? `Pages: ${pages.join(", ") || "N/A"}` : status}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {activeTab === "info" && (
                        <div>
                          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Document Metadata
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div>
                              <p className="text-gray-400 font-medium">File Name</p>
                              <p className="font-semibold text-slate-700 break-all mt-0.5">{name}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 font-medium">Pipeline Stage</p>
                              <p className="font-semibold text-slate-700 uppercase mt-0.5">{doc.stage || "EXTRACTION"}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 font-medium">Status</p>
                              <p className={`font-semibold uppercase mt-0.5 ${statusTone(doc.status)}`}>
                                {doc.status || "processing"}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400 font-medium">Report ID</p>
                              <p className="font-mono text-slate-500 mt-0.5 truncate">{reportId || "N/A"}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Collapse Toggle Arrow Bar */}
                  <div
                    onClick={() => toggleExpanded(name)}
                    className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-end text-xs text-slate-400 hover:text-slate-650 cursor-pointer transition-colors"
                  >
                    <span className="mr-1">Collapse Details</span>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              ) : (
                /* Collapsed Messages Bar */
                <div
                  onClick={() => toggleExpanded(name)}
                  className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
                    <MessageSquare className="h-4 w-4 text-slate-400" />
                    <span>Backend Messages</span>
                    {messages.length > 0 && (
                      <span className="hidden sm:inline-flex items-center gap-2 font-normal text-slate-400 pl-3 border-l border-slate-200">
                        <span className="uppercase text-[9px] font-bold text-slate-500">
                          {messages[messages.length - 1].stage || "Extraction"}
                        </span>
                        <span className={`text-[10px] ${statusTone(messages[messages.length - 1].status || doc.status)} font-semibold`}>
                          {messages[messages.length - 1].status || doc.status}
                        </span>
                        <span>{messages[messages.length - 1].message}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 group-hover:text-slate-650 transition-colors">
                    <span>2m 34s ago</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              )}

              {/* Detected Issues Banner for failed reports */}
              {failed && (
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs">
                  <span className="font-semibold text-red-650 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    Detected Issues:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {missingStatements.map((lbl) => (
                      <span
                        key={lbl}
                        className="px-2.5 py-0.5 rounded-full bg-red-50 text-[11px] font-semibold text-red-650 border border-red-100"
                      >
                        {lbl}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── Security Trust Footer ── */}
      <div className="bg-slate-50/50 border border-gray-150 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Secure, Private & Compliant</h4>
            <p className="text-[11px] text-gray-400">Your data is encrypted and processed securely. We never share your data.</p>
          </div>
        </div>
        <a
          href="#"
          className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline shrink-0"
        >
          Learn more about our security
          <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </Page>
  );
}
