import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { statementSections } from "@/lib/mock-data";
import { getCurrentReportId, getDocumentStatuses, getValidatedData, type PipelineDocument, type ValidatedRow } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, CheckCircle2, Eye, RotateCcw, X, AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/validation")({
  head: () => ({ meta: [{ title: "Extraction Validation - FDI" }, { name: "description", content: "Review and validate extracted financial statements." }] }),
  component: ValidationPage,
});

function docName(doc: PipelineDocument) {
  return doc.pdf_name || doc.filename || doc.name || "Annual report";
}

function statusClass(status = "pending") {
  const value = status.toLowerCase();
  if (value === "completed") return "text-[color:var(--success)] bg-[var(--success)]/10";
  if (value === "failed") return "text-[color:var(--error)] bg-[var(--error)]/10";
  if (value === "running") return "text-[color:var(--warning)] bg-[var(--warning)]/10";
  return "text-muted-foreground bg-[var(--hover)]";
}

function ValidationPage() {
  const [view, setView] = useState<string | null>(null);
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [documents, setDocuments] = useState<PipelineDocument[]>([]);
  const [quality, setQuality] = useState<number | null>(null);
  const [reportId, setReportId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const current = getCurrentReportId();
    setReportId(current);
    if (!current) return;
    setLoading(true);
    setError("");
    try {
      const [validatedResult, docsResult] = await Promise.allSettled([getValidatedData(current), getDocumentStatuses(current)]);
      if (validatedResult.status === "fulfilled") {
        setRows(validatedResult.value.validated?.validated_rows || []);
        setQuality(typeof validatedResult.value.validated?.overall_data_quality_score === "number" ? validatedResult.value.validated.overall_data_quality_score : null);
      } else {
        setRows([]);
        setQuality(null);
      }
      if (docsResult.status === "fulfilled") {
        setDocuments(docsResult.value.documents || []);
      }
      if (validatedResult.status === "rejected" && docsResult.status === "rejected") {
        throw validatedResult.reason;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load validation data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sections = useMemo(() => {
    if (!rows.length) {
      return statementSections.map((section) => ({
        key: section.key,
        label: section.label,
        rows: [] as ValidatedRow[],
        confidence: section.confidence,
        pages: section.pages,
      }));
    }

    const grouped = rows.reduce<Record<string, ValidatedRow[]>>((acc, row) => {
      const key = row.statement_type || "unknown";
      acc[key] ||= [];
      acc[key].push(row);
      return acc;
    }, {});

    return Object.entries(grouped).map(([key, sectionRows]) => {
      const avg = sectionRows.reduce((sum, row) => sum + Number(row.confidence_score || 0), 0) / Math.max(1, sectionRows.length);
      return {
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
        rows: sectionRows,
        confidence: Math.round(avg * (avg <= 1 ? 100 : 1)),
        pages: sectionRows.map((row) => row.page_number).filter(Boolean).join(", ") || "backend validated",
      };
    });
  }, [rows]);

  const activeRows = view ? sections.find((section) => section.label === view)?.rows || [] : [];
  const failedDocs = documents.filter((doc) => String(doc.status).toLowerCase() === "failed");
  const completeDocs = documents.filter((doc) => String(doc.status).toLowerCase() === "completed");
  const readyForAnalysis = documents.length > 0 && failedDocs.length === 0 && completeDocs.length === documents.length && rows.length > 0;

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight">Extraction Validation</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">Review all annual report extraction results before opening the dashboard.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-[13px] font-medium hover:bg-[var(--hover)]"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Refresh
        </button>
      </div>

      {error && <div className="mt-5 rounded-xl border border-[color:var(--error)]/20 bg-[color:var(--error)]/8 px-4 py-3 text-[13px] text-[color:var(--error)]">{error}</div>}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated mt-8 overflow-hidden">
        <div className="grid items-center gap-6 p-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--surface)] ring-1 ring-border">
              <FileText className="h-5 w-5 text-[var(--navy)]" />
            </div>
            <div>
              <div className="text-[14px] font-medium">{reportId || "No active report"}</div>
              <div className="text-[11.5px] text-muted-foreground">{documents.length || 0} annual reports · {rows.length} validated rows</div>
            </div>
          </div>
          <Stat label="Documents" value={`${completeDocs.length} / ${documents.length || 0}`} />
          <Stat label="Avg. Confidence" value={quality == null ? "Pending" : `${Math.round(quality * 100)}%`} accent />
          <Stat label="Status" value={readyForAnalysis ? "Ready for Analysis" : failedDocs.length ? "Manual Check Needed" : "Processing"} />
        </div>
      </motion.div>

      <div className="mt-6 grid gap-3">
        {documents.map((doc, index) => {
          const failed = String(doc.status).toLowerCase() === "failed";
          const name = docName(doc);
          return (
            <motion.div
              key={`${name}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * index }}
              className="card-elevated grid items-center gap-4 p-5 md:grid-cols-[1.4fr_160px_auto]"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--gold)]/12 text-[var(--navy)]">
                  {failed ? <AlertTriangle className="h-5 w-5 text-[color:var(--error)]" /> : <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div>
                  <div className="text-[14px] font-medium">{name}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">{doc.stage || "Extraction"} · {doc.message || doc.error || "Backend document status"}</div>
                </div>
              </div>
              <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass(String(doc.status || "pending"))}`}>
                {String(doc.status || "pending")}
              </span>
              <div className="flex items-center justify-end gap-2">
                {failed && (
                  <a href={`/mapping?pdf=${encodeURIComponent(name)}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-[12.5px] font-medium hover:bg-[var(--hover)]">
                    <RotateCcw className="h-3.5 w-3.5" /> Manual Mapping
                  </a>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4">
        {sections.map((section, i) => (
          <motion.div
            key={section.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="card-elevated card-elevated-hover grid items-center gap-4 p-5 md:grid-cols-[1.4fr_180px_120px_auto]"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--gold)]/12 text-[var(--navy)]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[14px] font-medium">{section.label}</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">{section.rows.length ? `${section.rows.length} rows · pages ${section.pages}` : "Waiting for backend rows"}</div>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Confidence</div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--hover)]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-soft)]" style={{ width: `${section.confidence}%` }} />
                </div>
                <span className="text-[12px] font-medium tabular-nums">{section.confidence}%</span>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--success)]/10 px-2.5 py-1 text-[11px] font-medium text-[color:var(--success)]">
              Validated
            </span>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setView(section.label)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-[12.5px] font-medium hover:bg-[var(--hover)]">
                <Eye className="h-3.5 w-3.5" /> View Table
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-10 flex justify-end">
        <Link
          to="/dashboard"
          className={`inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-b from-[var(--navy-2)] to-[var(--navy)] px-7 text-[14px] font-medium text-white shadow-[0_12px_32px_-12px_rgba(11,31,58,0.6)] transition-transform hover:-translate-y-0.5 ${
            readyForAnalysis ? "" : "pointer-events-none opacity-60"
          }`}
        >
          Analyze Financial Data
        </Link>
      </div>

      <AnimatePresence>
        {view && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setView(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="card-elevated relative max-h-[80vh] w-full max-w-4xl overflow-auto p-6"
            >
              <button onClick={() => setView(null)} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--hover)]"><X className="h-4 w-4" /></button>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Extracted Data Table</div>
              <h3 className="mt-1 text-[20px] font-semibold tracking-tight">{view}</h3>
              <div className="mt-5 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-[13px]">
                  <thead className="bg-[var(--surface)] text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">Year</th>
                      <th className="px-4 py-2.5">Line Item</th>
                      <th className="px-4 py-2.5 text-right">Value</th>
                      <th className="px-4 py-2.5 text-right">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeRows.length ? activeRows : rows.slice(0, 20)).map((row, index) => (
                      <tr key={row.row_id || index} className="border-t border-border">
                        <td className="px-4 py-2.5 tabular-nums">{row.year || "-"}</td>
                        <td className="px-4 py-2.5">{row.canonical_label || row.original_label || "Unknown"}</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">{row.value == null ? "-" : Number(row.value).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{row.confidence_score == null ? "-" : `${Math.round(Number(row.confidence_score) * 100)}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-[20px] font-semibold tracking-tight ${accent ? "text-gradient-gold" : ""}`}>{value}</div>
    </div>
  );
}
