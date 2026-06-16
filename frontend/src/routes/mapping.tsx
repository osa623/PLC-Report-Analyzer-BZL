import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { detectManualStatements, getCurrentReportId, getDocumentExtractedData, getDocumentStatuses, listManualPdfs, retryDocumentExtraction, type ManualPdf, type ManualStatement, type PipelineDocument } from "@/lib/api";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function cleanImageUrl(url = "") {
  if (url.includes("localhost:5000")) {
    return url.replace(/https?:\/\/localhost:5000/, "/annual-api");
  }
  return url;
}

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
  toc: "Table of Contents",
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

function docName(doc: PipelineDocument) {
  return doc.pdf_name || doc.filename || doc.name || "Annual report";
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

function tocImageLabel(image: { kind?: string; page?: number; source_toc_page?: number }, index: number) {
  if (image.kind === "next_page_after_toc") {
    return `Next page after TOC ${image.source_toc_page || ""}`.trim();
  }
  return `Detected TOC page ${image.page || index + 1}`;
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
  const [tocIndex, setTocIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedFullscreenImage, setSelectedFullscreenImage] = useState<{ url: string; page?: number; filename?: string; statement?: string; kind?: string; source_toc_page?: number } | null>(null);

  const groupedImages = useMemo(() => {
    const groups: Record<string, Array<{ url: string; page?: number; filename?: string; kind?: string; source_toc_page?: number }>> = {};
    if (pipelineDoc?.statement_images) {
      Object.entries(pipelineDoc.statement_images).forEach(([key, imgs]) => {
        if (key === "toc") return;
        if (imgs && imgs.length) {
          groups[STATEMENT_LABELS[key] || key.replace(/_/g, " ")] = imgs;
        }
      });
    }
    if (Object.keys(groups).length === 0 && statements.length) {
      statements.forEach((stmt) => {
        if (stmt.images && stmt.images.length) {
          groups[stmt.title] = stmt.images;
        }
      });
    }
    return groups;
  }, [pipelineDoc, statements]);

  const tocImages = useMemo(
    () => (pipelineDoc?.statement_images?.toc || []).map((image) => ({ ...image, statement: "Table of Contents" })),
    [pipelineDoc],
  );

  const images = useMemo(() => {
    const pipelineImages = Object.entries(pipelineDoc?.statement_images || {}).flatMap(([statement, statementImages]) =>
      statement === "toc" ? [] :
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
          let hydratedDoc = matchedDoc;
          try {
            const data = await getDocumentExtractedData(currentReportId, docName(matchedDoc));
            hydratedDoc = {
              ...matchedDoc,
              statement_images: data.statement_images || matchedDoc.statement_images,
              statement_pages: data.statement_pages || matchedDoc.statement_pages,
              statement_refs: data.statement_refs || matchedDoc.statement_refs,
              page_mappings: data.page_mappings || matchedDoc.page_mappings,
            };
          } catch {
            hydratedDoc = matchedDoc;
          }
          setPipelineDoc(hydratedDoc);
          const nextValues: Record<string, string> = {};
          Object.entries({ income_statement: "income", balance_sheet: "balance", cash_flow: "cashflow", equity: "equity", comprehensive_income: "comprehensive_income" }).forEach(([backendKey, uiKey]) => {
            const pages = hydratedDoc.statement_pages?.[backendKey] || [];
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
  const pageMappings = pipelineDoc?.page_mappings || {};

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

      {tocImages.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated mt-8 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-white">
            <div className="flex flex-col items-center justigy-between gap-4">
            <div>
              <div className="text-[14px] font-semibold">Table of Contents Screenshots</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">Detected TOC pages plus the immediate next page for context.</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTocIndex((current) => Math.max(0, current - 1))}
                disabled={tocIndex === 0}
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-white hover:bg-[var(--hover)] disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-20 text-center text-[12px] tabular-nums text-muted-foreground">{tocIndex + 1} / {tocImages.length}</span>
              <button
                type="button"
                onClick={() => setTocIndex((current) => Math.min(tocImages.length - 1, current + 1))}
                disabled={tocIndex >= tocImages.length - 1}
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-white hover:bg-[var(--hover)] disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
           
            </div>
            </div>
            <div className="space-y-2">
              {tocImages.map((image, index) => (
                <button
                  key={image.filename || index}
                  type="button"
                  onClick={() => setTocIndex(index)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-[12px] ${
                    index === tocIndex ? "border-[var(--navy)] bg-white text-foreground shadow-sm" : "border-border bg-white/70 text-muted-foreground hover:bg-white"
                  }`}
                >
                  <div className="font-medium">{tocImageLabel(image, index)}</div>
                  <div className="mt-0.5 text-muted-foreground">PDF page {image.page || index + 1}</div>
                  <div className="mt-0.5 truncate">{image.filename}</div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-start p-5 justify-between gap-4 bg-[var(--surface)] ">

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
                    <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Dynamic Page Offset Resolution</div>
                    {Object.entries(statementRefs).map(([key, page]) => (
                      <div key={key} className="grid gap-1 border-t border-border/60 py-2 first:border-t-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{key.replace(/_/g, " ")}</span>
                          <span className="font-medium tabular-nums">TOC page {page}</span>
                        </div>
                        {pageMappings[key] && (
                          <div className="grid grid-cols-4 gap-2 text-[11px] text-muted-foreground">
                            <span>PDF {pageMappings[key].referenced_pdf_page ?? "-"}</span>
                            <span>Printed {pageMappings[key].printed_page ?? "-"}</span>
                            <span>Offset {pageMappings[key].offset == null ? "-" : pageMappings[key].offset! >= 0 ? `+${pageMappings[key].offset}` : pageMappings[key].offset}</span>
                            <span className="text-right font-medium text-foreground">Open {pageMappings[key].corrected_pdf_page ?? "-"}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {(statements.length ? statements : REQUIRED_MAPPING_STATEMENTS).map((statement) => (
                  <div key={statement.type} className="grid grid-cols-[1fr_150px] items-center gap-4">
                    <div>
                      <label className="text-[13.5px] font-medium">{STATEMENT_LABELS[statement.type] || statement.title}</label>
                      <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                        {(statement as any).confidence ? `${Math.round((statement as any).confidence * ((statement as any).confidence <= 1 ? 100 : 1))}% confidence` : "Needs manual page"}
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

            <div className="relative h-screen w-auto overflow-auto rounded-xl sticky flex top-20">
              <img
                src={cleanImageUrl(tocImages[Math.min(tocIndex, tocImages.length - 1)]?.url || "")}
                alt={tocImageLabel(tocImages[Math.min(tocIndex, tocImages.length - 1)] || {}, tocIndex)}
                className="w-[700px] rounded-lg bg-white overflow-auto shadow-sm"
                onClick={() => setSelectedFullscreenImage(tocImages[Math.min(tocIndex, tocImages.length - 1)] || null)}
              />
            </div>

          </div>
        </motion.section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
         
          { (() => {
            if (Object.keys(tocImages).length === 0) {
              return (
                <div className="hidden lg:block">
                  
                </div>
              );
            }
            return null;
          })() }

          { !tocImages || Object.keys(tocImages).length === 0 ? (

        <div className='relative'>
          
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated overflow-hidden flex flex-col">
            <div className="border-b border-border px-5 py-3.5 bg-white">
              <div className="text-[14px] font-semibold text-foreground">Statement Page Screenshots</div>
              <div className="text-[12px] text-muted-foreground mt-0.5">
                Click any image to expand and view the full table contents.
              </div>
            </div>
            <div className="bg-[var(--surface)] p-5 flex-1 min-h-[450px]">
              {Object.keys(groupedImages).length > 0 ? (
                <div className="space-y-6 max-h-[650px] overflow-y-auto pr-1">
                  {Object.entries(groupedImages).map(([statementTitle, imgs]) => (
                    <div key={statementTitle} className="border-b border-border/60 pb-5 last:border-0">
                      <h3 className="text-[12px] font-semibold text-[color:var(--navy)] mb-3 uppercase tracking-wider">{statementTitle}</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {imgs.map((img, idx) => (
                          <div
                            key={idx}
                            className="relative group cursor-pointer border border-border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all hover:scale-[1.01] duration-200"
                            onClick={() => setSelectedFullscreenImage({ ...img, statement: statementTitle })}
                          >
                            <img
                              src={cleanImageUrl(img.url)}
                              alt={`${statementTitle} page ${img.page || idx + 1}`}
                              className="w-full h-40 object-contain bg-slate-50 p-2"
                            />
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-black/40 text-white text-[11px] px-3 py-1.5 flex justify-between items-center opacity-90 group-hover:opacity-100 transition-opacity">
                              <span className="font-medium">Page {img.page || idx + 1}</span>
                              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">Expand</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-[400px] place-items-center rounded-xl bg-white text-[13px] text-muted-foreground ring-1 ring-border">
                  {loading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-[var(--navy)]" />
                      <span>Loading screenshots...</span>
                    </div>
                  ) : (
                    "No statement page screenshots are available yet for this PDF."
                  )}
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
                <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Dynamic Page Offset Resolution</div>
                {Object.entries(statementRefs).map(([key, page]) => (
                  <div key={key} className="grid gap-1 border-t border-border/60 py-2 first:border-t-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{key.replace(/_/g, " ")}</span>
                      <span className="font-medium tabular-nums">TOC page {page}</span>
                    </div>
                    {pageMappings[key] && (
                      <div className="grid grid-cols-4 gap-2 text-[11px] text-muted-foreground">
                        <span>PDF {pageMappings[key].referenced_pdf_page ?? "-"}</span>
                        <span>Printed {pageMappings[key].printed_page ?? "-"}</span>
                        <span>Offset {pageMappings[key].offset == null ? "-" : pageMappings[key].offset! >= 0 ? `+${pageMappings[key].offset}` : pageMappings[key].offset}</span>
                        <span className="text-right font-medium text-foreground">Open {pageMappings[key].corrected_pdf_page ?? "-"}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {(statements.length ? statements : REQUIRED_MAPPING_STATEMENTS).map((statement) => (
              <div key={statement.type} className="grid grid-cols-[1fr_150px] items-center gap-4">
                <div>
                  <label className="text-[13.5px] font-medium">{STATEMENT_LABELS[statement.type] || statement.title}</label>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {(statement as any).confidence ? `${Math.round((statement as any).confidence * ((statement as any).confidence <= 1 ? 100 : 1))}% confidence` : "Needs manual page"}
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

         ) : null }


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
      
      {/* Fullscreen Image Overlay */}
      {selectedFullscreenImage && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setSelectedFullscreenImage(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-white">
              <div>
                <span className="text-[14px] font-semibold text-foreground">
                  {selectedFullscreenImage.statement}
                </span>
                <span className="ml-2 text-[12px] text-muted-foreground">
                  · Page {selectedFullscreenImage.page}
                </span>
              </div>
              <button
                onClick={() => setSelectedFullscreenImage(null)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--hover)] text-foreground/80 hover:text-foreground"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="p-4 bg-slate-900 flex-1 overflow-auto flex items-center justify-center">
              <img
                src={cleanImageUrl(selectedFullscreenImage.url)}
                alt={`${selectedFullscreenImage.statement} page ${selectedFullscreenImage.page}`}
                className="max-h-[75vh] object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

