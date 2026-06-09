import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { tocItems, statementSections } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/mapping")({
  head: () => ({ meta: [{ title: "Statement Mapping — FDI" }, { name: "description", content: "Map financial statements to PDF pages." }] }),
  component: MappingPage,
});

function MappingPage() {
  const [page, setPage] = useState(1);
  const [values, setValues] = useState<Record<string, number>>({ income: 45, balance: 51, cashflow: 58, comprehensive: 65, equity: 72 });

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight">Statement Mapping</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">Map the financial statements to their corresponding pages.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* TOC Preview */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <div className="text-[13px] font-medium">TOC Preview — Annual_Report_2023.pdf</div>
              <div className="text-[11.5px] text-muted-foreground">Page {page} of 2</div>
            </div>
            <div className="flex items-center gap-1">
              <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--hover)]"><ZoomOut className="h-4 w-4" /></button>
              <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--hover)]"><ZoomIn className="h-4 w-4" /></button>
              <div className="mx-2 h-5 w-px bg-border" />
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--hover)]"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage((p) => Math.min(2, p + 1))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--hover)]"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="bg-[var(--surface)] p-6">
            <div className="mx-auto max-w-md rounded-xl bg-white p-8 shadow-[0_2px_20px_-8px_rgba(15,23,42,0.15)] ring-1 ring-border">
              <div className="text-center text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Table of Contents</div>
              <div className="mt-6 space-y-2.5">
                {tocItems.map((t) => (
                  <div key={t.title} className="flex items-baseline gap-2 text-[13px]">
                    <span className={t.bold ? "font-semibold text-foreground" : "text-foreground/85"}>{t.title}</span>
                    <span className="flex-1 border-b border-dotted border-border" />
                    <span className="tabular-nums text-muted-foreground">{t.page}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-elevated p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[15px] font-medium">Map Statements to Pages</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">Enter the starting page number for each statement.</div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)]/12 px-2.5 py-1 text-[11px] font-medium text-[color:var(--navy)]">
              <Sparkles className="h-3 w-3 text-[var(--gold)]" /> AI Suggested
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {statementSections.map((s) => (
              <div key={s.key} className="grid grid-cols-[1fr_120px] items-center gap-4">
                <div>
                  <label className="text-[13.5px] font-medium">{s.label}</label>
                  <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                    {s.confidence}% confidence
                  </div>
                </div>
                <input
                  type="number"
                  value={values[s.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [s.key]: Number(e.target.value) }))}
                  className="h-11 rounded-xl border border-border bg-white px-4 text-right text-[15px] font-medium tabular-nums focus:border-[var(--navy)] focus:outline-none focus:ring-4 focus:ring-[var(--navy)]/8"
                />
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-4 mt-10 flex justify-end">
        <div className="card-elevated flex items-center gap-3 px-4 py-3 backdrop-blur">
          <span className="text-[12.5px] text-muted-foreground">5 statements mapped · ready for extraction</span>
          <Link to="/validation" className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-b from-[var(--navy-2)] to-[var(--navy)] px-5 text-[13px] font-medium text-white shadow-[0_8px_24px_-12px_rgba(11,31,58,0.6)] transition-transform hover:-translate-y-0.5">
            Submit Mapping
          </Link>
        </div>
      </div>
    </Page>
  );
}
