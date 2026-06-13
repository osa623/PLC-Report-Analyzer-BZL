import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { detectManualStatements, getCurrentReportId, getDocumentStatuses, listManualPdfs, retryDocumentExtraction, type ManualPdf, type ManualStatement, type PipelineDocument } from "@/lib/api";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/mapping")({
  head: () => ({ meta: [{ title: "Statement Mapping - FDI" }, { name: "description", content: "Map failed financial statement extraction to PDF pages." }] }),
  component: MappingPage,
});

const STATEMENT_LABELS: Record<string, string> = {
  income: "Income Statement",
  balance: "Balance Sheet",
  cashflow: "Cash Flow Statement",
  income_statement: "Income Statement",
  balance_sheet: "Balance Sheet",
  cash_flow: "Cash Flow Statement",
  equity: "Statement of Changes in Equity",
  comprehensive_income: "Comprehensive Income",
};

const REQUIRED_MAPPING_STATEMENTS = [
  { type: "income", title: "Income Statement" },
  { type: "balance", title: "Balance Sheet" },
  { type: "cashflow", title: "Cash Flow Statement" },
  { type: "equity", title: "Statement of Changes in Equity" },
  { type: "comprehensive_income", title: "Comprehensive Income" },
];

function requestedPdfName() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("pdf") || "";
}

function findManualPdf(pdfs: ManualPdf[], name: string) {
  const clean = name.toLowerCase();
  return (
    pdfs.find((pdf) => pdf.name?.toLowerCase() === clean) ||
    pdfs.find((pdf) => clean.includes(pdf.name?.toLowerCase() || "missing")) ||
    pdfs.find((pdf) => pdf.name?.toLowerCase().includes(clean.replace(/^.*[\\/]/, "")))
  );
}

function pagesFromText(text = "") {
  return Array.from(text.matchAll(/\d+/g)).map((match) => Number(match[0])).filter((page) => Number.isFinite(page) && page > 0);
}

function MappingPage() {
  const navigate = useNavigate();
  const [manualPdfs, setManualPdfs] = useState<ManualPdf[]>([]);
  const [pipelineDoc, setPipelineDoc] = useState<PipelineDocument | null>(null);
  const [selectedPdfId, setSelectedPdfId] = useState("");
  const [targetName, setTargetName] = useState("");
  const [reportId, setReportId] = useState("");
  const [statements, setStatements] = useState<ManualStatement[]>([]);
  const [values, setValues] = useState<Record<string, string>>({ income: "", balance: "", cashflow: "", equity: "", comprehensive_income: "" });
  const [imageIndex, setImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const images = useMemo(() => {
    const pipelineImages = Object.entries(pipelineDoc?.statement_images || {}).flatMap(([statement, statementImages]) =>
      (statementImages || []).map((image) => ({ ...image, statement: STATEMENT_LABELS[statement] || statement.replace(/_/g, " ") })),
    );
    if (pipelineImages.length) return pipelineImages;
    return statements.flatMap((statement) => (statement.images || []).map((image) => ({ ...image, statement: statement.title })));
  }, [pipelineDoc, statements]);

  const load = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const name = requestedPdfName();
      setTargetName(name);
      const currentReportId = getCurrentReportId();
      setReportId(currentReportId);

      if (currentReportId) {
        const docs = await getDocumentStatuses(currentReportId);
        const matchedDoc = (docs.documents || []).find((doc) => {
          const docName = doc.pdf_name || doc.filename || doc.name || "";
          return docName === name || docName.toLowerCase() === name.toLowerCase();
        });
        if (matchedDoc) {
          setPipelineDoc(matchedDoc);
          const nextValues: Record<string, string> = {};
          Object.entries({ income_statement: "income", balance_sheet: "balance", cash_flow: "cashflow", equity: "equity", comprehensive_income: "comprehensive_income" }).forEach(([backendKey, uiKey]) => {
            const pages = matchedDoc.statement_pages?.[backendKey] || [];
            if (pages.length) nextValues[uiKey] = pages.join(", ");
          });
          setValues((current) => ({ ...current, ...nextValues }));
        }
      }

      try {
        const pdfs = await listManualPdfs();
        setManualPdfs(pdfs);
        const match = findManualPdf(pdfs, name) || pdfs[0];
        if (match) {
          setSelectedPdfId(match.id);
          const detected = await detectManualStatements(match.id);
          const nextStatements = detected.statements || [];
          setStatements(nextStatements);

          const nextValues: Record<string, string> = {};
          nextStatements.forEach((statement) => {
            const pages = pagesFromText(statement.pages);
            if (pages.length) nextValues[statement.type] = String(pages[0]);
          });
          setValues((current) => ({ ...current, ...nextValues }));
        }
      } catch {
        setManualPdfs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load manual mapping data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reloadSelected = async (pdfId: string) => {
    setSelectedPdfId(pdfId);
    setLoading(true);
    setError("");
    try {
      const detected = await detectManualStatements(pdfId);
      const nextStatements = detected.statements || [];
      setStatements(nextStatements);
      const nextValues: Record<string, string> = {};
      nextStatements.forEach((statement) => {
        const pages = pagesFromText(statement.pages);
        if (pages.length) nextValues[statement.type] = String(pages[0]);
      });
      setValues({ income: "", balance: "", cashflow: "", equity: "", comprehensive_income: "", ...nextValues });
      setImageIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to detect statement pages");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!reportId || !targetName) {
      setError("No active pipeline report was found for this manual retry.");
      return;
    }
    const selectedPages = Object.fromEntries(
      Object.entries(values)
        .map(([key, raw]) => [key, raw.split(",").map((part) => Number(part.trim())).filter((page) => Number.isFinite(page) && page > 0)])
        .filter(([, pages]) => (pages as number[]).length > 0),
    ) as Record<string, number[]>;

    if (!Object.keys(selectedPages).length) {
      setError("Enter at least one real page number before retrying extraction.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await retryDocumentExtraction(reportId, targetName, selectedPages);
      setMessage("Manual mappings saved. Extraction restarted for this report only.");
      setTimeout(() => navigate({ to: "/processing" }), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manual extraction failed");
    } finally {
      setSubmitting(false);
    }
  };

  const activeImage = images[imageIndex];
  const statementRefs = pipelineDoc?.statement_refs || {};

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight">Statement Mapping</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Correct the failed annual report only, then rerun extraction for that file.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-[13px] font-medium hover:bg-[var(--hover)]"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_320px]">
        <div className="card-elevated p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Failed report from progress</div>
          <div className="mt-1 truncate text-[15px] font-semibold">{targetName || "Manual selection"}</div>
        </div>
        <select
          value={selectedPdfId}
          onChange={(event) => reloadSelected(event.target.value)}
          disabled={!manualPdfs.length}
          className="h-full min-h-16 rounded-xl border border-border bg-white px-4 text-[13px] font-medium outline-none focus:border-[var(--navy)]"
        >
          {!manualPdfs.length && <option>Pipeline-detected mapping</option>}
          {manualPdfs.map((pdf) => (
            <option key={pdf.id} value={pdf.id}>{pdf.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="mt-5 rounded-xl border border-[color:var(--error)]/20 bg-[color:var(--error)]/8 px-4 py-3 text-[13px] text-[color:var(--error)]">{error}</div>}
      {message && <div className="mt-5 rounded-xl border border-[color:var(--success)]/20 bg-[color:var(--success)]/8 px-4 py-3 text-[13px] text-[color:var(--success)]">{message}</div>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <div className="text-[13px] font-medium">Statement Page Screenshot</div>
              <div className="text-[11.5px] text-muted-foreground">
                {activeImage ? `${activeImage.statement} · page ${activeImage.page || imageIndex + 1}` : "No screenshots returned"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setImageIndex((p) => Math.max(0, p - 1))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--hover)]"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setImageIndex((p) => Math.min(Math.max(0, images.length - 1), p + 1))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--hover)]"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="bg-[var(--surface)] p-4">
            {activeImage ? (
              <img src={activeImage.url} alt={`${activeImage.statement} page ${activeImage.page || ""}`} className="mx-auto max-h-[620px] w-full rounded-lg object-contain ring-1 ring-border" />
            ) : (
              <div className="grid min-h-[360px] place-items-center rounded-lg bg-white text-[13px] text-muted-foreground ring-1 ring-border">
                {loading ? "Loading screenshots..." : "No statement page screenshots are available yet for this PDF."}
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-elevated p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[15px] font-medium">Map Statements to Real Pages</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">Use comma-separated pages for multi-page statements.</div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)]/12 px-2.5 py-1 text-[11px] font-medium text-[color:var(--navy)]">
              <Sparkles className="h-3 w-3 text-[var(--gold)]" /> Backend suggested
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {Object.keys(statementRefs).length > 0 && (
              <div className="rounded-xl border border-border bg-[var(--surface)] p-3 text-[12px]">
                <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Detected Statement Mappings</div>
                {Object.entries(statementRefs).map(([key, page]) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <span>{key.replace(/_/g, " ")}</span>
                    <span className="font-medium tabular-nums">TOC page {page}</span>
                  </div>
                ))}
              </div>
            )}
            {(statements.length ? statements : REQUIRED_MAPPING_STATEMENTS).map((statement) => (
              <div key={statement.type} className="grid grid-cols-[1fr_150px] items-center gap-4">
                <div>
                  <label className="text-[13.5px] font-medium">{STATEMENT_LABELS[statement.type] || statement.title}</label>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {statement.confidence ? `${Math.round(statement.confidence * (statement.confidence <= 1 ? 100 : 1))}% confidence` : "Needs manual page"}
                  </div>
                </div>
                <input
                  type="text"
                  value={values[statement.type] || ""}
                  placeholder="45, 46"
                  onChange={(e) => setValues((current) => ({ ...current, [statement.type]: e.target.value }))}
                  className="h-11 rounded-xl border border-border bg-white px-4 text-right text-[15px] font-medium tabular-nums focus:border-[var(--navy)] focus:outline-none focus:ring-4 focus:ring-[var(--navy)]/8"
                />
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="sticky bottom-4 mt-10 flex justify-end">
        <div className="card-elevated flex items-center gap-3 px-4 py-3 backdrop-blur">
          <span className="text-[12.5px] text-muted-foreground">Retry extraction only for the selected failed report</span>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !reportId || !targetName}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-b from-[var(--navy-2)] to-[var(--navy)] px-5 text-[13px] font-medium text-white shadow-[0_8px_24px_-12px_rgba(11,31,58,0.6)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Start Extraction Again
          </button>
          <Link to="/processing" className="inline-flex h-10 items-center rounded-full border border-border bg-white px-4 text-[13px] font-medium hover:bg-[var(--hover)]">
            Back
          </Link>
        </div>
      </div>
    </Page>
  );
}

