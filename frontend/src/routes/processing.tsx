import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { Pipeline } from "@/components/Pipeline";
import { processingFiles, STAGES } from "@/lib/mock-data";
import { FileText, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/processing")({
  head: () => ({ meta: [{ title: "Processing — FDI" }, { name: "description", content: "Track extraction progress of uploaded documents." }] }),
  component: ProcessingPage,
});

function ProcessingPage() {
  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight">Processing Progress</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">Track the extraction progress of your uploaded files in real time.</p>
        </div>
        <button className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--hover)]">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="mt-8 grid gap-3">
        {processingFiles.map((f, i) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="card-elevated card-elevated-hover p-5 md:p-6"
          >
            <div className="grid items-center gap-5 md:grid-cols-[280px_1fr_180px]">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--surface)] ring-1 ring-border">
                  <FileText className="h-5 w-5 text-[var(--navy)]" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{f.name}</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">{f.size} · {f.pages} pages · {f.uploadedAt}</div>
                </div>
              </div>

              <div className="px-2">
                <Pipeline stageIndex={f.stageIndex} progress={f.progress} />
              </div>

              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{STAGES[f.stageIndex]}</div>
                <div className="mt-0.5 text-[16px] font-semibold tracking-tight">
                  {f.eta === "Done" ? <span className="text-[color:var(--success)]">Complete</span> : `${f.progress}%`}
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {f.eta === "Done" ? `Confidence ${f.confidence}%` : `ETA ${f.eta}`}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="mt-6 text-center text-[12px] text-muted-foreground">Showing 1–10 of 24 files</p>
    </Page>
  );
}
