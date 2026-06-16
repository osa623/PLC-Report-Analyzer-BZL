import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import {
  finalizeCompletedBatch,
  getCurrentReportId,
  getDocumentExtractedData,
  getDocumentStatuses,
  getFullReport,
  type NormalizedReportGroup,
  type PipelineDocument,
} from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileText,
  Loader2,
  RotateCcw,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCompanyStore } from "@/lib/store/company-store";

export const Route = createFileRoute("/validation")({
  head: () => ({
    meta: [
      { title: "Extraction Validation - FDI" },
      { name: "description", content: "Review extracted annual report data." },
    ],
  }),
  component: ValidationPage,
});

function docName(doc: PipelineDocument) {
  return doc.pdf_name || doc.filename || doc.name || "Annual report";
}

function statusClass(status = "pending") {
  const value = status.toLowerCase();
  if (value === "completed")
    return "text-[color:var(--success)] bg-[var(--success)]/10";
  if (value === "failed")
    return "text-[color:var(--error)] bg-[var(--error)]/10";
  if (value === "running")
    return "text-[color:var(--warning)] bg-[var(--warning)]/10";
  return "text-muted-foreground bg-[var(--hover)]";
}

function statusIcon(status = "pending") {
  const value = status.toLowerCase();
  if (value === "completed")
    return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (value === "failed")
    return <AlertTriangle className="h-3.5 w-3.5" />;
  if (value === "running")
    return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  return null;
}

// ─── Year accordion ───────────────────────────────────────────────────────────
function YearAccordion({
  reportSourcePdf,
  year,
  defaultOpen,
}: {
  reportSourcePdf: string;
  year: NormalizedReportGroup["years"][number];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const totalStatements = year.entities.reduce(
    (s, e) => s + e.statements.length,
    0
  );
  const totalRows = year.entities.reduce(
    (s, e) =>
      s +
      e.statements.reduce(
        (ss, st) => ss + st.rows.filter((r) => r.value != null).length,
        0
      ),
    0
  );
  /* Fetching the company data */
  const company = useCompanyStore((s) => s.company);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Year header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 bg-white px-5 py-4 text-left hover:bg-[var(--hover)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--gold)]/12 text-[var(--navy)]">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[15px] font-semibold tracking-tight">
              {year.year} Annual Report
            </span>
            <span className="ml-3 text-[12px] text-muted-foreground">
              {totalStatements} statement{totalStatements !== 1 ? "s" : ""} ·{" "}
              {totalRows} line items
            </span>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Year body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="year-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden border-t border-border"
          >
            <div className="space-y-4 p-5">
              {year.entities.map((entity) => (
                <div
                  key={`${reportSourcePdf}-${year.year}-${entity.entity}`}
                  className="space-y-3"
                >
                  {entity.entity && (
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      {entity.entity}
                    </div>
                  )}
                  {entity.statements.map((statement) => (
                    <StatementAccordion
                      key={`${reportSourcePdf}-${year.year}-${entity.entity}-${statement.statement_type}`}
                      statement={statement}
                      defaultOpen={totalStatements <= 2}
                    />
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Statement accordion ──────────────────────────────────────────────────────
function StatementAccordion({
  statement,
  defaultOpen,
}: {
  statement: NormalizedReportGroup["years"][number]["entities"][number]["statements"][number];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const rowCount = statement.rows.filter((r) => r.value != null).length;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Statement header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 bg-[var(--surface)] px-5 py-3.5 text-left hover:bg-[var(--hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold">{statement.label}</span>
          <span className="text-[12px] text-muted-foreground">
            · {rowCount} line item{rowCount !== 1 ? "s" : ""}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Statement body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="stmt-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="overflow-hidden border-t border-border"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-[var(--surface)] text-left">
                  <tr>
                    <th className="px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground w-[60%]">
                      Label
                    </th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statement.rows.map((row, idx) =>
                    row.value == null ? (
                      // Section header row
                      <tr
                        key={`header-${idx}`}
                        className="border-t border-border bg-[var(--hover)]"
                      >
                        <td
                          colSpan={2}
                          className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          {row.label}
                        </td>
                      </tr>
                    ) : (
                      // Data row
                      <tr
                        key={`row-${idx}`}
                        className="border-t border-border hover:bg-[var(--hover)] transition-colors"
                      >
                        <td className="px-5 py-3 text-[13px] text-foreground">
                          {row.label}
                        </td>
                        <td className="px-5 py-3 text-right font-medium tabular-nums">
                          {row.display_value ?? String(row.value ?? "—")}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function ValidationPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<PipelineDocument[]>([]);
  const [normalizedReports, setNormalizedReports] = useState<
    NormalizedReportGroup[]
  >([]);
  const [reportId, setReportId] = useState("");
  const [analyticsReady, setAnalyticsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizingMessage, setFinalizingMessage] = useState("");
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestedPdf = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("pdf") || "";
  }, []);

  const load = async () => {
    const current = getCurrentReportId();
    setReportId(current);
    if (!current) return;
    setLoading(true);
    setError("");
    try {
      const [docsResult, reportResult] = await Promise.allSettled([
        getDocumentStatuses(current),
        getFullReport(current),
      ]);
      const nextDocuments =
        docsResult.status === "fulfilled"
          ? docsResult.value.documents || []
          : [];
      setDocuments(nextDocuments);

      if (reportResult.status === "fulfilled") {
        const hasRatios =
          Object.keys(
            reportResult.value?.analytics?.ratios?.by_year || {}
          ).length > 0;
        setAnalyticsReady(hasRatios);
        const grouped =
          reportResult.value?.data_views?.normalized_grouped_results;
        if (Array.isArray(grouped) && grouped.length) {
          setNormalizedReports(grouped);
          return;
        }
      }

      const targetPdfNames = requestedPdf
        ? [requestedPdf]
        : nextDocuments.map(docName);
      const extracted = await Promise.allSettled(
        Array.from(new Set(targetPdfNames)).map((pdfName) =>
          getDocumentExtractedData(current, pdfName)
        )
      );
      setNormalizedReports(
        extracted
          .filter(
            (
              result
            ): result is PromiseFulfilledResult<
              Awaited<ReturnType<typeof getDocumentExtractedData>>
            > => result.status === "fulfilled"
          )
          .flatMap((result) => result.value.normalized_grouped || [])
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load normalized extraction data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const failedDocs = documents.filter(
    (doc) => String(doc.status).toLowerCase() === "failed"
  );
  const completeDocs = documents.filter(
    (doc) => String(doc.status).toLowerCase() === "completed"
  );
  const allDocsCompleted =
    documents.length > 0 &&
    completeDocs.length === documents.length &&
    failedDocs.length === 0;

  const visibleReports = requestedPdf
    ? normalizedReports.filter(
        (r) => r.source_pdf.toLowerCase() === requestedPdf.toLowerCase()
      )
    : normalizedReports;

  const tableCount = visibleReports.reduce(
    (sum, report) =>
      sum +
      report.years.reduce(
        (yearSum, year) =>
          yearSum +
          year.entities.reduce(
            (entitySum, entity) => entitySum + entity.statements.length,
            0
          ),
        0
      ),
    0
  );

  const pollForAnalytics = useCallback(() => {
    if (!reportId) return;
    const check = async () => {
      try {
        const report = await getFullReport(reportId);
        const hasRatios =
          Object.keys(report?.analytics?.ratios?.by_year || {}).length > 0;
        if (hasRatios) {
          setAnalyticsReady(true);
          setFinalizing(false);
          setFinalizingMessage("");
          navigate({ to: "/dashboard" });
          return;
        }
        const status = report?.pipeline_status;
        if (status === "FAILED") {
          setFinalizing(false);
          setFinalizingMessage("");
          setError(
            "Analysis pipeline failed. Check backend logs for details."
          );
          return;
        }
        setFinalizingMessage(
          "Running financial analysis and generating report..."
        );
        pollRef.current = setTimeout(check, 3000);
      } catch {
        pollRef.current = setTimeout(check, 4000);
      }
    };
    pollRef.current = setTimeout(check, 2000);
  }, [reportId, navigate]);

  const handleFinalize = async () => {
    if (!reportId || finalizing) return;
    setFinalizing(true);
    setFinalizingMessage("Triggering batch finalization...");
    setError("");
    try {
      const result = await finalizeCompletedBatch(reportId);
      if (result.status === "already_completed") {
        setFinalizing(false);
        navigate({ to: "/dashboard" });
        return;
      }
      setFinalizingMessage(
        "Normalizing data and running analysis engine..."
      );
      pollForAnalytics();
    } catch (err) {
      setFinalizing(false);
      setFinalizingMessage("");
      setError(
        err instanceof Error
          ? err.message
          : "Failed to trigger batch finalization. Ensure all documents are completed."
      );
    }
  };

  const getButtonState = () => {
    if (analyticsReady)
      return {
        label: "View Dashboard",
        action: "navigate" as const,
        disabled: false,
      };
    if (finalizing)
      return {
        label: finalizingMessage || "Calculating Financial Data...",
        action: "none" as const,
        disabled: true,
      };
    if (allDocsCompleted)
      return {
        label: "Calculate Financial Data",
        action: "finalize" as const,
        disabled: false,
      };
    return {
      label: "Waiting for Extractions",
      action: "none" as const,
      disabled: true,
    };
  };

  const buttonState = getButtonState();

  const statusText = failedDocs.length
    ? "Manual Check Needed"
    : analyticsReady
      ? "Ready for Dashboard"
      : allDocsCompleted
        ? "Ready to Finalize"
        : "Processing";


  const company = useCompanyStore((s) => s.company);

  return (
    <Page>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight">
            Extraction Validation
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            File-wise normalized results from the finalized extraction output.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-[13px] font-medium hover:bg-[var(--hover)] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="mt-5 rounded-xl border border-[color:var(--error)]/20 bg-[color:var(--error)]/8 px-4 py-3 text-[13px] text-[color:var(--error)]">
          {error}
        </div>
      )}

      {/* ── Summary card ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elevated mt-8 overflow-hidden"
      >
        <div className="grid items-center gap-6 p-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--surface)] ring-1 ring-border">
              <FileText className="h-5 w-5 text-[var(--navy)]" />
            </div>
            <div>
              <div className="text-[14px] font-medium">
                {company.companyName}
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                {documents.length || 0} annual reports · {tableCount}{" "}
                normalized tables
              </div>
            </div>
          </div>
          <Stat
            label="Documents"
            value={`${completeDocs.length} / ${documents.length || 0}`}
          />
          <Stat
            label="Files With Data"
            value={String(visibleReports.length)}
            accent
          />
          <Stat label="Status" value={statusText} />
        </div>
      </motion.div>

      {/* ── Document cards ── */}
      <div className="mt-6 grid gap-3">
        {documents.map((doc, index) => {
          const status = String(doc.status || "pending").toLowerCase();
          const failed = status === "failed";
          const name = docName(doc);
          return (
            <motion.div
              key={`${name}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * index }}
              className="card-elevated grid items-center gap-4 p-5 md:grid-cols-[1.4fr_160px_auto]"
            >
              {/* Name + stage */}
              <div className="flex items-center gap-3">
                <div
                  className={`grid h-10 w-10 place-items-center rounded-lg ${
                    failed
                      ? "bg-[color:var(--error)]/10"
                      : "bg-[var(--gold)]/12"
                  } text-[var(--navy)]`}
                >
                  {failed ? (
                    <AlertTriangle className="h-5 w-5 text-[color:var(--error)]" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="text-[14px] font-medium">{company.ticker || "N/A"} - {name.replace(/\.pdf$/i, "").replace(/^\d+-/, "")}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {doc.stage || "Extraction"} ·{" "}
                    {doc.message || doc.error || "Backend document status"}
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <span
                className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass(String(doc.status || "pending"))}`}
              >
                {statusIcon(String(doc.status || "pending"))}
                {String(doc.status || "pending")}
              </span>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                {failed && (
                  <a
                    href={`/mapping?pdf=${encodeURIComponent(name)}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-[12.5px] font-medium hover:bg-[var(--hover)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Manual Mapping
                  </a>
                )}

              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Loading spinner ── */}
      {loading && (
        <div className="mt-8 flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--navy)]" />
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && visibleReports.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-white px-5 py-4 text-[13px] text-muted-foreground">
          Normalized extracted values are not ready yet. Wait for extraction
          and normalization to complete, then refresh.
        </div>
      )}

      {/* ── Normalized reports — accordion per year, per statement ── */}
      <div className="mt-8 space-y-10">
        {visibleReports.map((report) => (
          <motion.section
            key={report.source_pdf}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Report heading */}
            <div className="mb-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Statements Data of Each Annual Reports
              </div>
              <h2 className="text-[22px] font-semibold tracking-tight">
                {(() => {
                  const currentYear = parseInt(
                    report.source_pdf.replace(/^\d+-/, "").replace(/\.pdf$/i, ""),
                    10
                  );
                  return `${currentYear - 1} - ${currentYear}`;
                })()}
              </h2>
            </div>

            {/* Year accordions */}
             <div className="space-y-3">
              {report.years.map((year, yearIdx) => {
                const wrongYear = year.year - 2;

                if (year.year === wrongYear) {
                  return null;
                }

                return (
                  <YearAccordion
                    key={`${report.source_pdf}-${year.year}`}
                    reportSourcePdf={report.source_pdf}
                    year={year}
                    defaultOpen={yearIdx === 0}
                  />
                );
              })}
            </div>
          </motion.section>
        ))}
      </div>

      {/* ── Action button ── */}
      <div className="mt-10 flex justify-end">
        {analyticsReady ? (
          <Link
            to="/dashboard"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-b from-[var(--navy-2)] to-[var(--navy)] px-7 text-[14px] font-medium text-white shadow-[0_12px_32px_-12px_rgba(11,31,58,0.6)] transition-transform hover:-translate-y-0.5"
          >
            <Zap className="h-4 w-4" />
            View Dashboard
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleFinalize}
            disabled={buttonState.disabled}
            className={`inline-flex h-12 items-center gap-2 rounded-full px-7 text-[14px] font-medium text-white shadow-[0_12px_32px_-12px_rgba(11,31,58,0.6)] transition-transform ${
              buttonState.disabled
                ? "cursor-not-allowed bg-gray-400"
                : "bg-gradient-to-b from-[var(--navy-2)] to-[var(--navy)] hover:-translate-y-0.5"
            }`}
          >
            {finalizing && <Loader2 className="h-4 w-4 animate-spin" />}
            {!finalizing && allDocsCompleted && <Zap className="h-4 w-4" />}
            {buttonState.label}
          </button>
        )}
      </div>

      {/* ── Finalization progress ── */}
      {finalizing && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/8 px-5 py-4 text-[13px] text-[var(--navy)]"
        >
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--gold)]" />
            <div>
              <div className="font-medium">Analysis in Progress</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                The backend is normalizing extracted data, computing financial
                ratios, running risk analysis, and generating the final report.
                This typically takes several minutes.
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </Page>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-[20px] font-semibold tracking-tight ${accent ? "text-gradient-gold" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}