import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { motion } from "framer-motion";
import { UploadCloud, FileText, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { useState } from "react";
import { recentUploads } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Upload Documents — FDI" },
      { name: "description", content: "Upload annual reports and financial statements for automated extraction." },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const [drag, setDrag] = useState(false);
  return (
    <Page>
      <section className="mx-auto max-w-3xl text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-[12px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-[var(--gold)]" /> AI-powered extraction · v2.4
          </span>
          <h1 className="mt-6 text-[44px] font-light leading-[1.05] tracking-tight md:text-[56px]">
            Financial Document <span className="text-gradient-gold font-normal">Intelligence</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Upload annual reports and financial statements for automated extraction, validation and deep analytics — built for finance teams that move fast.
          </p>
        </motion.div>
      </section>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}
        className="mx-auto mt-12 max-w-3xl"
      >
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); }}
          className={`card-elevated relative overflow-hidden p-10 md:p-14 transition-all ${drag ? "ring-2 ring-[var(--gold)]/40 -translate-y-0.5" : ""}`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,160,23,0.06),transparent_60%)]" />
          <div className="relative flex flex-col items-center text-center">
            <motion.div
              animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
              className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-[var(--gold)]/15 to-[var(--gold-soft)]/15 ring-1 ring-[var(--gold)]/30"
            >
              <UploadCloud className="h-9 w-9 text-[var(--navy)]" strokeWidth={1.5} />
            </motion.div>
            <h3 className="mt-6 text-[20px] font-medium tracking-tight">Drag & drop PDF files here</h3>
            <p className="mt-1.5 text-[13px] text-muted-foreground">or</p>
            <button className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-b from-[var(--navy-2)] to-[var(--navy)] px-6 text-[13.5px] font-medium text-white shadow-[0_8px_24px_-12px_rgba(11,31,58,0.6)] transition-transform hover:-translate-y-0.5">
              Browse Files
            </button>
            <p className="mt-5 text-[12px] text-muted-foreground">Supports multiple files · up to 200MB each</p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {["PDF", "Annual Reports", "Financial Statements", "Scanned Documents"].map((t) => (
                <span key={t} className="rounded-full border border-border bg-white px-3 py-1 text-[11.5px] font-medium text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <section className="mx-auto mt-16 max-w-5xl">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-[22px] font-semibold tracking-tight">Recent Uploads</h2>
          <a className="text-[13px] text-muted-foreground hover:text-foreground" href="/processing">View all →</a>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {recentUploads.map((u, i) => (
            <motion.div
              key={u.name}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
              className="card-elevated card-elevated-hover group p-5"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--surface)] ring-1 ring-border">
                  <FileText className="h-5 w-5 text-[var(--navy)]" />
                </div>
                {u.status === "Completed" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/10 px-2 py-0.5 text-[11px] font-medium text-[color:var(--success)]">
                    <CheckCircle2 className="h-3 w-3" /> {u.status}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gold)]/15 px-2 py-0.5 text-[11px] font-medium text-[color:var(--navy)]">
                    <Clock className="h-3 w-3" /> {u.status}
                  </span>
                )}
              </div>
              <div className="mt-5">
                <div className="truncate text-[14px] font-medium">{u.name}</div>
                <div className="mt-1 text-[12px] text-muted-foreground">{u.size} · {u.time}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </Page>
  );
}
