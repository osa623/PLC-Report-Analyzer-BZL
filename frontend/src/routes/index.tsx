import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { motion } from "framer-motion";
import {
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Lock,
  X,
  ChevronRight,
  FileCheck,
} from "lucide-react";
import { useRef, useState } from "react";
import { recentUploads } from "@/lib/mock-data";
import { uploadReports } from "@/lib/api";
import CompanyForm from "@/components/CompanyForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Upload Documents - FDI" },
      {
        name: "description",
        content:
          "Upload annual reports and financial statements for automated extraction.",
      },
    ],
  }),
  component: UploadPage,
});

const STEPS = ["Company", "Documents", "Review"] as const;

function UploadPage() {
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  const selectFiles = (list: FileList | null) => {
    const selected = Array.from(list || []).filter(
      (file) =>
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
    );
    setFiles(selected.slice(0, 5));
    setError("");
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!files.length) {
      setError("Add at least one annual report to continue.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      await uploadReports(files);
      navigate({ to: "/processing" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Page>

      {/* ── Page intro ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mb-10"
      >
        <p className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-black/30 mb-2">
          New submission
        </p>
        <h1 className="text-[28px] font-semibold leading-snug tracking-tight text-[var(--navy)]">
          Submit Your Company Reports Here.
        </h1>
        <p className="text-[13px] w-[40vw] bg-black/60 text-start border-white/60 border-2 font-thin rounded-r-2xl font-medium leading-snug text-white p-2 mt-2 ">
          Currently, only annual reports from companies registered with the<span className="font-bold"> Colombo Stock Exchange (CSE)</span> are supported. We plan to support additional document types and organizations in future releases.
        </p>
      </motion.div>

      {/* ── Step trail ── 
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="mb-8 flex items-center gap-0"
      >
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-all
                  ${i === 0
                    ? "bg-[var(--navy)] text-white"
                    : "border border-black/15 bg-white text-black/30"
                  }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-[12.5px] ${
                  i === 0
                    ? "font-semibold text-[var(--navy)]"
                    : "text-black/35"
                }`}
              >
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mx-3 h-px w-10 bg-black/10" />
            )}
          </div>
        ))}
      </motion.div> */}

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">

        {/* ── LEFT: Map placeholder + Company Form ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col overflow-hidden rounded-2xl border border-black/8 bg-white"
        >
          {/* Panel label */}
          <div className="flex items-center gap-2 border-b border-black/6 px-6 py-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/30">
              Company details
            </span>
          </div>



          {/* Company form */}
          <div className="flex-1 px-6 py-6">
            <CompanyForm />
          </div>
        </motion.div>

        {/* ── RIGHT: Upload panel ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5 }}
          className="flex flex-col overflow-hidden rounded-2xl border border-black/8 bg-white"
        >
          {/* Panel label */}
          <div className="flex items-center justify-between border-b border-black/6 px-6 py-3.5">
            <div className="flex items-center gap-2">
              <UploadCloud className="h-3.5 w-3.5 text-black/30" strokeWidth={1.5} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/30">
                Annual reports
              </span>
            </div>
            {files.length > 0 && (
              <span className="rounded-full bg-[var(--navy)] px-2.5 py-0.5 text-[11px] font-medium text-white">
                {files.length} of 5
              </span>
            )}
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              selectFiles(e.dataTransfer.files);
            }}
            className={`relative mx-5 mt-5 flex flex-col items-center rounded-xl border border-dashed px-8 py-10 text-center transition-all duration-200
              ${drag
                ? "border-[var(--navy)] bg-[var(--navy)]/[0.03]"
                : "border-black/12 bg-black/[0.015]"
              }`}
          >
            {/* Upload icon — subtle lift animation */}
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
              className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-black/8 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            >
              <UploadCloud
                className={`h-6 w-6 transition-colors ${drag ? "text-[var(--navy)]" : "text-black/40"}`}
                strokeWidth={1.5}
              />
            </motion.div>

            <p className="text-[15px] font-semibold text-[var(--navy)]">
              Drop your PDF files here
            </p>
            <p className="mt-1 text-[13px] text-black/40">
              or pick them from your computer
            </p>

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => selectFiles(e.target.files)}
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--navy)] px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-80"
            >
              Choose files
            </button>

            <p className="mt-4 text-[11.5px] text-black/30">
              PDF only · up to 5 reports per batch
            </p>
          </div>

          {/* File list — animates in when files are added */}
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mx-5 mt-3 overflow-hidden rounded-xl border border-black/8"
            >
              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${file.size}`}
                  className="group flex items-center gap-3 border-b border-black/6 px-4 py-2.5 last:border-b-0 hover:bg-black/[0.015] transition-colors"
                >
                  <FileCheck className="h-4 w-4 shrink-0 text-[var(--navy)]" strokeWidth={1.5} />
                  <span className="flex-1 truncate text-[12.5px] font-medium text-[var(--navy)]">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-black/35">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    aria-label={`Remove ${file.name}`}
                    className="ml-1 grid h-5 w-5 shrink-0 place-items-center rounded-full text-black/25 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/6 hover:text-black/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}

          {/* Error message */}
          {error && (
            <p className="mx-5 mt-3 rounded-lg border border-black/8 bg-black/[0.02] px-4 py-2.5 text-[12.5px] text-black/60">
              {error}
            </p>
          )}

          {/* Footer */}
          <div className="mt-auto px-5 pb-5 pt-4">
            {/* Security note */}
            <div className="mb-4 flex items-center gap-2 text-[11px] text-black/30">
              <Lock className="h-3 w-3 shrink-0" strokeWidth={1.5} />
              <span>Encrypted in transit · processed in your private workspace</span>
            </div>

            <div className="flex items-center justify-between">
              {files.length > 0 ? (
                <button
                  type="button"
                  onClick={() => { setFiles([]); setError(""); }}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--navy)] px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Clear all
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={submit}
                disabled={uploading}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--navy)] px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
                {uploading ? "Starting…" : "Start extraction"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Commented-out sections preserved exactly as original ── */}

      {/*
      <section className="mx-auto text-center">
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
      */}

      {/*
      <section className="mx-auto mt-16 max-w-5xl">
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
      </section>
      */}
    </Page>
  );
}