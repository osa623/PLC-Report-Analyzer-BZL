import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { Pipeline } from "@/components/Pipeline";
import { STAGES } from "@/lib/mock-data";
import { FileText, RefreshCw, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/reprocessing")({
  head: () => ({ meta: [{ title: "Reprocessing — FDI" }, { name: "description", content: "Real-time reprocessing of retried statements." }] }),
  component: ReprocessingPage,
});

const initial = [
  { name: "Income Statement (Retake)", pages: "45–57", stageIndex: 4, progress: 92 },
  { name: "Balance Sheet (Retake)", pages: "51–57", stageIndex: 3, progress: 87 },
  { name: "Cash Flow Statement (Retake)", pages: "58–61", stageIndex: 2, progress: 45 },
];

function ReprocessingPage() {
  const [items, setItems] = useState(initial);
  useEffect(() => {
    const t = setInterval(() => {
      setItems((curr) =>
        curr.map((it) => {
          let { stageIndex, progress } = it;
          progress += Math.random() * 6 + 2;
          if (progress >= 100) {
            progress = 0;
            stageIndex = Math.min(STAGES.length - 1, stageIndex + 1);
          }
          if (stageIndex === STAGES.length - 1) progress = 100;
          return { ...it, stageIndex, progress };
        })
      );
    }, 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight">Reprocessing Progress</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">Processing updated statements with live status updates.</p>
        </div>
        <button className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-[13px] font-medium hover:bg-[var(--hover)]">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="mt-8 grid gap-3">
        {items.map((f, i) => {
          const done = f.stageIndex === STAGES.length - 1 && f.progress >= 100;
          return (
            <motion.div key={f.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-elevated p-5 md:p-6">
              <div className="grid items-center gap-5 md:grid-cols-[280px_1fr_180px]">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--surface)] ring-1 ring-border">
                    <FileText className="h-5 w-5 text-[var(--navy)]" />
                  </div>
                  <div>
                    <div className="text-[14px] font-medium">{f.name}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">Pages {f.pages}</div>
                  </div>
                </div>
                <div className="px-2"><Pipeline stageIndex={f.stageIndex} progress={f.progress} /></div>
                <div className="text-right">
                  {done ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success)]/10 px-3 py-1 text-[12px] font-medium text-[color:var(--success)]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                    </span>
                  ) : (
                    <>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{STAGES[f.stageIndex]}</div>
                      <div className="mt-0.5 text-[16px] font-semibold tracking-tight tabular-nums">{Math.floor(f.progress)}%</div>
                      <div className="mt-0.5 text-[11.5px] text-muted-foreground">Live updating…</div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Page>
  );
}
