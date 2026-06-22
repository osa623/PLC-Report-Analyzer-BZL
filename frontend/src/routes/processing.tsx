import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { Pipeline } from "@/components/Pipeline";
import { processingFiles } from "@/lib/mock-data";
import { getCurrentFileNames, getCurrentReportId, getDocumentStatuses, getPipelineStages, type PipelineDocument } from "@/lib/api";
import { FileText, RefreshCw, AlertTriangle, CheckCircle2, Loader2, Table2, MapPinned, DownloadIcon, UploadIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useCompanyStore } from "@/lib/store/company-store";



export const Route = createFileRoute("/processing")({
  head: () => ({ meta: [{ title: "Processing - FDI" }, { name: "description", content: "Track extraction progress of uploaded documents." }] }),
  component: ProcessingPage,
});

const EXTRACTION_STAGES = ["Upload", "Parsing", "Structure", "Extraction"];
const STATEMENT_LABELS: Record<string, string> = {
  income_statement: "Income",
  balance_sheet: "Balance",
  cash_flow: "Cash Flow",
  equity: "Equity",
  comprehensive_income: "Comprehensive",
};

function documentName(doc: PipelineDocument) {
  return doc.pdf_name || doc.filename || doc.name || "Annual report";
}

function statusTone(status = "pending") {
  const value = status.toLowerCase();
  if (value === "completed") return "text-[color:var(--success)]";
  if (value === "failed") return "text-[color:var(--error)]";
  if (value === "running") return "text-[color:var(--warning)]";
  return "text-muted-foreground";
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
  if (status === "completed") return "Extraction completed successfully. Validated table data is ready to review.";
  if (status === "failed") return "Extraction failed for this annual report. Use manual mapping to correct statement pages.";
  if (status === "running") return `Backend is processing ${doc.stage || "extraction"}.`;
  return "Waiting for the backend pipeline to start.";
}

function fallbackDocuments() {
  const stored = getCurrentFileNames();
  if (stored.length) {
    return stored.map((name) => ({ pdf_name: name, status: "pending", stage: "UPLOAD" }));
  }
  return processingFiles.slice(0, 5).map((file) => ({
    pdf_name: file.name,
    status: file.eta === "Done" ? "completed" : "running",
    stage: "EXTRACTION",
  }));
}

function ProcessingPage() {
  const [reportId, setReportId] = useState("");
  const [documents, setDocuments] = useState<PipelineDocument[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const current = getCurrentReportId();
    setReportId(current);
    if (!current) {
      setDocuments(fallbackDocuments());
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
    const id = window.setInterval(load, 4000);
    return () => window.clearInterval(id);
  }, []);

  const counts = useMemo(() => ({
    completed: documents.filter((doc) => String(doc.status).toLowerCase() === "completed").length,
    failed: documents.filter((doc) => String(doc.status).toLowerCase() === "failed").length,
    total: documents.length,
  }), [documents]);

  /* Frontend Fix for the pipeline Mismatch with the backend */
  const derivedPipelineStatus = useMemo(() => {
  const allCompleted = documents.length > 0 &&
  documents.every(d => d.status?.toLowerCase() === "completed");
  const anyFiledOne = documents.some(d => d.status?.toLowerCase() === "running");
;
  if (anyFiledOne) return "RUNNING";
  if (allCompleted) return "COMPLETED";
  return pipelineStatus;
}, [documents, pipelineStatus]);

/* Fetching the company data */
const company = useCompanyStore((s) => s.company);

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] text-foreground text-nowrap px-2 block font-semibold tracking-tight">Processing Progress</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Track upload, parsing, structure detection and extraction for each annual report.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex cursor-pointer h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--hover)]"
          >
            <UploadIcon className="h-3.5 w-3.5" />
            Add Another Report to the Batch
          </button>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--hover)]"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="card-elevated p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Company Details</div>
            <div className="mt-1 truncate flex text-[15px] font-semibold tracking-tight">{company.companyName || "N/A"}    - <div className="font-thin"> {company.ticker || "N/A"}</div></div>
        </div>
        <Summary label="Full Pipeline Status" value={derivedPipelineStatus} />
        <Summary label="Progress of The Extraction Files" value={`${counts.completed}/${counts.total} complete${counts.failed ? `, ${counts.failed} failed` : ""}`} />
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-[color:var(--error)]/20 bg-[color:var(--error)]/8 px-4 py-3 text-[13px] text-[color:var(--error)]">
          {error}
        </div>
      )}

      <div className="mt-8 grid gap-3">
        {documents.map((doc, i) => {
          const name = documentName(doc);
          const rawStatus = String(doc.status || "pending");
          const failed = rawStatus.toLowerCase() === "failed";
          const allStatementsDone = doc.statement_statuses && 
            ["income_statement", "balance_sheet", "cash_flow", "equity", "comprehensive_income"].every(
              (key) => doc.statement_statuses![key]?.status?.toLowerCase() === "completed"
            );
          const completed = rawStatus.toLowerCase() === "completed" && allStatementsDone;
          const status = completed ? "completed" : (rawStatus.toLowerCase() === "completed" ? "running" : rawStatus);
          const finished = failed || completed;
          const progress = progressFromStatus({ ...doc, status });
          const statementStatuses = Object.entries(doc.statement_statuses || {});
          const messages = Array.isArray(doc.messages) && doc.messages.length
            ? doc.messages.slice(-8)
            : [{ stage: doc.stage || "Extraction", status, message: messageFor({ ...doc, status }) }];

          return (
            <motion.div
              key={`${name}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="card-elevated card-elevated-hover p-5 md:p-6"
            >
              <div className="grid items-center gap-5 md:grid-cols-[280px_1fr_230px]">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--surface)] ring-1 ring-border">
                    <FileText className="h-5 w-5 text-[var(--navy)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{company.ticker}{name.replace(/\.pdf$/i, "").replace(/^\d+/, "")}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">{messageFor(doc)}</div>
                  </div>
                </div>

                <div className="px-2">
                  <Pipeline stageIndex={progress.stageIndex} progress={progress.progress} stages={EXTRACTION_STAGES} />
                </div>

                <div className="flex flex-col items-end gap-2 text-right">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{doc.stage || "Extraction"}</div>
                    <div className={`mt-0.5 flex items-center justify-end gap-1.5 text-[15px] font-semibold tracking-tight ${statusTone(status)}`}>
                      {failed ? <AlertTriangle className="h-4 w-4" /> : completed ? <CheckCircle2 className="h-4 w-4" /> : null}
                      {status}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <a
                      href={`/mapping?pdf=${encodeURIComponent(name)}`}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[12px] font-medium ${
                        finished ? "bg-white hover:bg-[var(--hover)]" : "pointer-events-none bg-[var(--surface)] text-muted-foreground opacity-60"
                      }`}
                    >
                      <MapPinned className="h-3.5 w-3.5" /> Manual Mapping
                    </a>
                    <Link
                      to="/validation"
                      search={{ pdf: name }}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-[12px] font-medium hover:bg-[var(--hover)] ${
                        completed || failed ? "" : "pointer-events-none opacity-60"
                      }`}
                    >
                      <Table2 className="h-3.5 w-3.5" /> View Data
                    </Link>
                  </div>
                </div>
              </div>
              {statementStatuses.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {statementStatuses.map(([statement, payload]) => {
                    const itemStatus = String(payload?.status || "pending").toLowerCase();
                    return (
                      <span
                        key={statement}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          itemStatus === "completed"
                            ? "bg-[var(--success)]/10 text-[color:var(--success)]"
                            : itemStatus === "failed"
                              ? "bg-[var(--error)]/10 text-[color:var(--error)]"
                              : "bg-[var(--hover)] text-muted-foreground"
                        }`}
                      >
                        {STATEMENT_LABELS[statement] || statement.replace(/_/g, " ")}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="mt-5 rounded-xl border border-border bg-[var(--surface)] p-3">
                <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Backend Extraction Messages</div>
                <div className="space-y-1.5">
                  {messages.map((event, eventIndex) => (
                    <div key={`${name}-event-${eventIndex}`} className="grid gap-2 text-[12px] md:grid-cols-[110px_90px_1fr]">
                      <span className="font-medium text-muted-foreground">{event.stage || "Extraction"}</span>
                      <span className={event.level === "error" ? "text-[color:var(--error)]" : statusTone(String(event.status || status))}>
                        {event.status || status}
                      </span>
                      <span className="text-foreground">{event.message || "Waiting for backend update"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Page>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-elevated p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>

      {value.includes("complete") && value.includes("failed") ? (
        <div className="mt-1 flex items-center gap-3 text-[15px] font-semibold tracking-tight">
          {value.split(",").map((part, i) => {
            const text = part.trim();

            return text.includes("failed") ? (
              <span key={i} className="text-[color:var(--error)]">
                {text}
              </span>
            ) : (
              <span key={i} className="text-[color:var(--success)]">
                {text}
              </span>
            );
          })}
        </div>
      ) : value.includes("failed") ? (
        <div className="mt-1 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-[color:var(--error)]">
          <AlertTriangle className="h-4 w-4" />
          {value}
        </div>
      ) : value.includes("complete") ? (
        <div className="mt-1 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-[color:var(--success)]">
          <CheckCircle2 className="h-4 w-4" />
          {value}
        </div>
      ) : (
        <div className="mt-1 text-[15px] font-semibold tracking-tight">
          {value}
        </div>
      )}
    </div>
  );
}
