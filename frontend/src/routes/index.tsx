import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { motion } from "framer-motion";
import { UploadCloud, FileText, Sparkles, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { recentUploads } from "@/lib/mock-data";
import { uploadReports } from "@/lib/api";
import CompanyForm from "@/components/CompanyForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Upload Documents - FDI" },
      { name: "description", content: "Upload annual reports and financial statements for automated extraction." },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  const selectFiles = (list: FileList | null) => {
    const selected = Array.from(list || []).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    setFiles(selected.slice(0, 5));
    setError("");
  };

  const submit = async () => {
    if (!files.length) {
      setError("Select at least one annual report PDF.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      await uploadReports(files);
      navigate({ to: "/processing" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Page>
      <section className="mx-auto max-w-3xl text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-[12px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-[var(--gold)]" /> AI-powered extraction
          </span>
          <h1 className="mt-6 text-[44px] font-light leading-[1.05] tracking-tight md:text-[56px]">
            Financial Document <span className="text-gradient-gold font-normal">Intelligence</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Upload annual reports and financial statements for automated extraction, validation and deep analytics.
          </p>
        </motion.div>
      </section>
      
      <CompanyForm/>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.6 }}
        className="mx-auto mt-12 max-w-3xl"
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            selectFiles(e.dataTransfer.files);
          }}
          className={`card-elevated relative overflow-hidden p-10 transition-all md:p-14 ${drag ? "ring-2 ring-[var(--gold)]/40 -translate-y-0.5" : ""}`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,160,23,0.06),transparent_60%)]" />
          <div className="relative flex flex-col items-center text-center">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
              className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-[var(--gold)]/15 to-[var(--gold-soft)]/15 ring-1 ring-[var(--gold)]/30"
            >
              <UploadCloud className="h-9 w-9 text-[var(--navy)]" strokeWidth={1.5} />
            </motion.div>

            <h3 className="mt-6 text-[20px] font-medium tracking-tight">Drag and drop PDF files here</h3>
            <p className="mt-1.5 text-[13px] text-muted-foreground">or</p>

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(event) => selectFiles(event.target.files)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-b from-[var(--navy-2)] to-[var(--navy)] px-6 text-[13.5px] font-medium text-white shadow-[0_8px_24px_-12px_rgba(11,31,58,0.6)] transition-transform hover:-translate-y-0.5"
            >
              Browse Files
            </button>
            <p className="mt-5 text-[12px] text-muted-foreground">Supports multiple files, up to 5 annual reports per batch</p>

            {files.length > 0 && (
              <div className="mt-6 w-full max-w-md rounded-xl border border-border bg-white/70 p-3 text-left">
                {files.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
                    <span className="truncate font-medium">{file.name}</span>
                    <span className="shrink-0 text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="mt-4 text-[12.5px] font-medium text-[color:var(--error)]">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={uploading}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-full border border-border bg-white px-6 text-[13.5px] font-medium text-foreground transition-colors hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {uploading ? "Starting pipeline" : "Start Extraction"}
            </button>

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

    {/*  <section className="mx-auto mt-16 max-w-5xl">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-[22px] font-semibold tracking-tight">Recent Uploads</h2>
          <a className="text-[13px] text-muted-foreground hover:text-foreground" href="/processing">View all</a>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {recentUploads.map((u, i) => (
            <motion.div
              key={u.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
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
      </section> */}
    </Page>
  );
}
