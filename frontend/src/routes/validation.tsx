import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { statementSections } from "@/lib/mock-data";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, CheckCircle2, Eye, RotateCcw, X } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/validation")({
  head: () => ({ meta: [{ title: "Extraction Validation — FDI" }, { name: "description", content: "Review and validate extracted financial statements." }] }),
  component: ValidationPage,
});

function ValidationPage() {
  const [view, setView] = useState<string | null>(null);
  return (
    <Page>
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight">Extraction Validation</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">Review and validate extracted financial statements before analysis.</p>
      </div>

      {/* Overview card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated mt-8 overflow-hidden">
        <div className="grid items-center gap-6 p-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--surface)] ring-1 ring-border">
              <FileText className="h-5 w-5 text-[var(--navy)]" />
            </div>
            <div>
              <div className="text-[14px] font-medium">Annual_Report_2023.pdf</div>
              <div className="text-[11.5px] text-muted-foreground">12.4 MB · 152 pages · extracted Jun 10, 2026</div>
            </div>
          </div>
          <Stat label="Sections" value="5 / 5" />
          <Stat label="Avg. Confidence" value="92.2%" accent />
          <Stat label="Status" value="Ready for Analysis" />
        </div>
      </motion.div>

      {/* Sections list */}
      <div className="mt-6 grid gap-4">
        {statementSections.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
            className="card-elevated card-elevated-hover grid items-center gap-4 p-5 md:grid-cols-[1.4fr_180px_120px_auto]"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--gold)]/12 text-[var(--navy)]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[14px] font-medium">{s.label}</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">Pages {s.pages}</div>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Confidence</div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--hover)]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-soft)]" style={{ width: `${s.confidence}%` }} />
                </div>
                <span className="text-[12px] font-medium tabular-nums">{s.confidence}%</span>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--success)]/10 px-2.5 py-1 text-[11px] font-medium text-[color:var(--success)]">
              Validated
            </span>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setView(s.label)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-[12.5px] font-medium hover:bg-[var(--hover)]">
                <Eye className="h-3.5 w-3.5" /> View
              </button>
              <Link to="/reprocessing" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-[12.5px] font-medium hover:bg-[var(--hover)]">
                <RotateCcw className="h-3.5 w-3.5" /> Retake
              </Link>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-10 flex justify-end">
        <Link to="/dashboard" className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-b from-[var(--navy-2)] to-[var(--navy)] px-7 text-[14px] font-medium text-white shadow-[0_12px_32px_-12px_rgba(11,31,58,0.6)] transition-transform hover:-translate-y-0.5">
          Analyze Financial Data →
        </Link>
      </div>

      <AnimatePresence>
        {view && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setView(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="card-elevated relative max-h-[80vh] w-full max-w-2xl overflow-auto p-6"
            >
              <button onClick={() => setView(null)} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--hover)]"><X className="h-4 w-4" /></button>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Preview</div>
              <h3 className="mt-1 text-[20px] font-semibold tracking-tight">{view}</h3>
              <div className="mt-5 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-[13px]">
                  <thead className="bg-[var(--surface)] text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr><th className="px-4 py-2.5">Line Item</th><th className="px-4 py-2.5 text-right">2022</th><th className="px-4 py-2.5 text-right">2023</th></tr>
                  </thead>
                  <tbody>
                    {[["Revenue", "1,107.8", "1,245.8"], ["Cost of Revenue", "612.4", "684.1"], ["Gross Profit", "495.4", "561.7"], ["Operating Expenses", "318.2", "352.8"], ["Operating Income", "177.2", "208.9"], ["Net Income", "140.6", "162.6"]].map((r) => (
                      <tr key={r[0]} className="border-t border-border">
                        <td className="px-4 py-2.5">{r[0]}</td><td className="px-4 py-2.5 text-right tabular-nums">{r[1]}</td><td className="px-4 py-2.5 text-right font-medium tabular-nums">{r[2]}</td>
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
