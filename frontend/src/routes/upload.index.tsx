import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { motion } from "framer-motion";
import { useAuthStore } from "@/lib/store/auth-store";
import Homepage from "@/Pages/Home/Homepage";
import {
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  X,
  ChevronRight,
  FileCheck,
  Info,
  FileEdit,
  Shield,
} from "lucide-react";
import { useRef, useState } from "react";
import { recentUploads } from "@/lib/mock-data";
import { uploadReports, getCurrentReportId } from "@/lib/api";
import CompanyForm from "@/components/CompanyForm";
import { useCompanyStore } from "@/lib/store/company-store";

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

function UploadPage() {
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return <Homepage />;
  }

  return <UploadPageContent />;
}

function UploadPageContent() {
  const isAppending = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("append") === "true";
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const company = useCompanyStore((s) => s.company);

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
      const currentReportId = isAppending ? getCurrentReportId() : undefined;
      await uploadReports(files, {
        symbol: company.ticker,
        name: company.companyName,
        sector: company.sector,
        report_id: currentReportId,
      });
      navigate({ to: "/processing" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Page>
      {/* ── Page Intro with Title on Left and SVG Graphic on Right ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex-1"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-600 mb-2">
            {isAppending ? "Append to Batch" : "New Submission"}
          </p>
          <h1 className="text-[36px] font-extrabold leading-tight tracking-tight text-[var(--navy)]">
            {isAppending ? "Add Report to Current Batch" : "Submit Your Company Reports"}
          </h1>
          <p className="text-[14px] text-gray-500 mt-2 max-w-xl">
            {isAppending 
              ? "Upload additional annual reports to be analyzed as part of your current active batch." 
              : "Upload annual reports and let our AI extract key insights quickly and accurately."}
          </p>

          {/* Colombo Stock Exchange Info Card */}
          <div className="flex items-start gap-3 bg-blue-50/40 border border-blue-100 rounded-2xl p-4 max-w-2xl mt-5">
            <div className="bg-blue-900 text-white rounded-full p-1 shrink-0">
              <Info className="h-3.5 w-3.5" />
            </div>
            <p className="text-[12.5px] leading-relaxed text-blue-900/80">
              Currently, only <strong className="font-semibold text-blue-950">annual reports</strong> from companies registered with the <strong className="font-semibold text-blue-950">Colombo Stock Exchange (CSE)</strong> are supported. We plan to support additional document types and organizations in future releases.
            </p>
          </div>
        </motion.div>

        {/* Beautiful Floating Inline SVG illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="hidden md:block w-72 h-44 shrink-0 relative"
        >
          <svg width="280" height="180" viewBox="0 0 280 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            {/* Wave lines background */}
            <path d="M10 80 Q 70 40, 130 90 T 250 60" stroke="#E2E8F0" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
            <path d="M20 110 Q 80 70, 140 120 T 260 90" stroke="#E2E8F0" strokeWidth="1" fill="none" />
            
            {/* Document sheet */}
            <g transform="translate(100, 20)">
              {/* 3D shadow */}
              <rect x="2" y="4" width="96" height="126" rx="12" fill="#E2E8F0" opacity="0.4" />
              {/* Document body */}
              <rect x="0" y="0" width="96" height="126" rx="12" fill="white" stroke="#E2E8F0" strokeWidth="1" />
              
              {/* Fold at top right */}
              <path d="M84 0 L96 12 L84 12 Z" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1" />
              
              {/* Lines inside document */}
              <rect x="12" y="24" width="50" height="6" rx="3" fill="#E2E8F0" />
              <rect x="12" y="38" width="72" height="4" rx="2" fill="#F1F5F9" />
              <rect x="12" y="48" width="60" height="4" rx="2" fill="#F1F5F9" />
              <rect x="12" y="58" width="40" height="4" rx="2" fill="#F1F5F9" />
              
              {/* Pie Chart element inside document */}
              <circle cx="48" cy="90" r="18" fill="#F1F5F9" />
              <path d="M48 90 L48 72 A18 18 0 0 1 66 90 Z" fill="#2563EB" />
              <path d="M48 90 L66 90 A18 18 0 0 1 48 108 Z" fill="#93C5FD" />
            </g>

            {/* Blue circle badge with Upload Icon */}
            <g transform="translate(90, 65)">
              <circle cx="20" cy="20" r="20" fill="#0B1F3A" className="shadow-lg" />
              <path d="M14 20 L20 14 L26 20 M20 14 L20 26 M13 26 L27 26" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            
            {/* Decorative bubble dots */}
            <circle cx="210" cy="115" r="7" fill="#93C5FD" opacity="0.6" />
            <circle cx="70" cy="45" r="4" fill="#CBD5E1" />
          </svg>
        </motion.div>
      </div>

      {/* ── Two-column Grid (Card 1 & Card 2) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
        {/* Card 1: 1. SELECT COMPANY */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]"
        >
          <div className="flex items-center gap-3 border-b border-gray-50 px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <FileEdit className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                1. SELECT COMPANY
              </h2>
              <p className="text-xs text-gray-400">
                {isAppending ? "Selected company is locked for appending" : "Search and select the correct company to begin."}
              </p>
            </div>
          </div>

          <div className="flex-1 px-6 py-6">
            {isAppending ? (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-900 text-white font-bold text-sm">
                    {company.companyName ? company.companyName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "CP"}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{company.companyName || "Current Batch Company"}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{company.ticker || "Ticker"} · {company.sector || "Sector"}</p>
                  </div>
                </div>
                <div className="border-t border-slate-100 my-1" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  You are appending additional reports to the active processing batch for <strong>{company.companyName}</strong>. The company selection is locked.
                </p>
              </div>
            ) : (
              <CompanyForm />
            )}
          </div>
        </motion.div>

        {/* Card 2: 2. UPLOAD REPORTS */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5 }}
          className="flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]"
        >
          <div className="flex items-center gap-3 border-b border-gray-50 px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <UploadCloud className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                2. UPLOAD REPORTS
              </h2>
              <p className="text-xs text-gray-400">
                Upload your annual report (PDF) files.
              </p>
            </div>
          </div>

          {/* Drag zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              selectFiles(e.dataTransfer.files);
            }}
            className={`relative mx-6 mt-6 flex flex-col items-center rounded-2xl border border-dashed px-8 py-10 text-center transition-all duration-200
              ${drag
                ? "border-blue-500 bg-blue-50/20"
                : "border-gray-250 bg-slate-50/30 hover:bg-slate-50/70"
              }`}
          >
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
              className="mb-5 grid h-12 w-12 place-items-center rounded-full border border-gray-100 bg-white shadow-sm"
            >
              <UploadCloud
                className={`h-5 w-5 transition-colors ${drag ? "text-blue-500" : "text-gray-400"}`}
                strokeWidth={1.5}
              />
            </motion.div>

            <p className="text-sm font-bold text-slate-800">
              Drag & drop your PDF files here
            </p>
            <p className="mt-1 text-xs text-gray-400">
              or browse from your computer
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
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[#0B1F3A] px-5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 shadow-sm"
            >
              Choose files
            </button>

            <p className="mt-4 text-[11px] text-gray-450">
              PDF only · Up to 5 reports per batch · Max 50MB per file
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mx-6 mt-3 overflow-hidden rounded-xl border border-gray-100"
            >
              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${file.size}`}
                  className="group flex items-center gap-3 border-b border-gray-50 px-4 py-2.5 last:border-b-0 hover:bg-slate-50 transition-colors"
                >
                  <FileCheck className="h-4 w-4 shrink-0 text-blue-600" strokeWidth={1.5} />
                  <span className="flex-1 truncate text-xs font-semibold text-slate-700">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-gray-400">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    aria-label={`Remove ${file.name}`}
                    className="ml-1 grid h-5 w-5 shrink-0 place-items-center rounded-full text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}

          {/* Error message */}
          {error && (
            <p className="mx-6 mt-3 rounded-lg border border-red-100 bg-red-50/50 px-4 py-2.5 text-xs text-red-600 font-medium">
              {error}
            </p>
          )}

          {/* Footer */}
          <div className="mt-6 border-t border-gray-100 bg-slate-50/40 px-6 py-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Security note */}
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" strokeWidth={1.5} />
              <span>Encrypted in transit · Processed in your private workspace</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {files.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setFiles([]); setError(""); }}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-[13px] font-semibold text-slate-600 hover:bg-gray-50 transition-colors"
                >
                  Clear all
                </button>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={uploading}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-5 text-[13px] font-semibold text-blue-600 transition-colors hover:bg-blue-50/50 disabled:cursor-not-allowed disabled:opacity-40 shadow-sm"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    Start extraction
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Value Proposition Footer Banner ── */}
      <div className="mt-12 bg-slate-50/50 border border-gray-100 rounded-3xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
        {/* Item 1 */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Your data is secure</h4>
            <p className="text-[10px] text-gray-400 leading-tight">We use enterprise-grade encryption and never share your data.</p>
          </div>
        </div>

        {/* Item 2 */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Secure & Private</h4>
            <p className="text-[10px] text-gray-400 leading-tight">End-to-end encryption</p>
          </div>
        </div>

        {/* Item 3 */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">AI-Powered</h4>
            <p className="text-[10px] text-gray-400 leading-tight">Accurate data extraction</p>
          </div>
        </div>

        {/* Item 4 */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Trusted by Professionals</h4>
            <p className="text-[10px] text-gray-400 leading-tight">Built for compliance</p>
          </div>
        </div>
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

function WelcomingPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans overflow-x-hidden text-slate-800">
      {/* Simplified Top Nav */}
      <header className="w-full py-5 px-6 md:px-12 flex justify-between items-center border-b border-gray-100 bg-white/85 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#0B1F3A] text-[13px] font-bold tracking-tight text-white shadow-md">
            FDI
          </span>
          <span className="text-[14px] font-bold tracking-tight text-slate-900 sm:block">
            Financial Document Intelligence
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-[13px] font-bold text-slate-650 hover:text-slate-900 transition-colors">
            Sign in
          </Link>
          <Link to="/register" className="inline-flex h-9 items-center rounded-xl bg-[#0B1F3A] px-4.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 shadow-sm">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow max-w-[1280px] mx-auto w-full px-6 md:px-12 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left Column */}
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl md:text-5xl lg:text-[54px] font-extrabold tracking-tight text-[#0B1F3A] leading-tight">
              Smarter Financial <br />
              <span className="text-blue-600 font-extrabold">Document Processing</span>
            </h1>
            <p className="text-md md:text-lg text-gray-500 mt-4 max-w-lg leading-relaxed">
              Automate. Validate. Extract. All in one intelligent platform.
            </p>
          </div>

          {/* List of features */}
          <div className="space-y-4 max-w-lg">
            {/* Feature 1 */}
            <div className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Intelligent Extraction</h4>
                <p className="text-xs text-gray-400 mt-0.5">Extract key data from financial documents with high accuracy.</p>
              </div>
            </div>
            {/* Feature 2 */}
            <div className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Shield className="h-4.5 w-4.5" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Secure & Compliant</h4>
                <p className="text-xs text-gray-400 mt-0.5">Your data is encrypted and processed with enterprise-grade security.</p>
              </div>
            </div>
            {/* Feature 3 */}
            <div className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <FileText className="h-4.5 w-4.5" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Built for Professionals</h4>
                <p className="text-xs text-gray-400 mt-0.5">Designed for finance teams, auditors, and compliance professionals.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Premium CSS extracted report mockup */}
        <div className="flex justify-center lg:justify-end">
          <div className="w-full max-w-[400px] bg-white border border-gray-150 rounded-3xl p-6 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.06)] relative overflow-hidden">
            {/* Header of Mockup */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-red-50 text-red-500 rounded-xl p-2.5">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Annual Report.pdf</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">142 pages · 12.8 MB</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-100 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Processed
              </span>
            </div>

            {/* Content stats */}
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Key Highlights</h5>
            <div className="space-y-3">
              {/* Stat 1 */}
              <div className="flex items-center justify-between bg-slate-50/60 border border-slate-100 rounded-2xl p-3">
                <div>
                  <p className="text-[10px] text-gray-405 font-medium">Total Assets</p>
                  <p className="text-[15px] font-bold text-slate-800 mt-0.5">$8,750,000</p>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">+12.5%</span>
              </div>
              {/* Stat 2 */}
              <div className="flex items-center justify-between bg-slate-50/60 border border-slate-100 rounded-2xl p-3">
                <div>
                  <p className="text-[10px] text-gray-405 font-medium">Net Profit</p>
                  <p className="text-[15px] font-bold text-slate-800 mt-0.5">$1,250,000</p>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">+8.3%</span>
              </div>
              {/* Stat 3 */}
              <div className="flex items-center justify-between bg-slate-50/60 border border-slate-100 rounded-2xl p-3">
                <div>
                  <p className="text-[10px] text-gray-405 font-medium">Revenue</p>
                  <p className="text-[15px] font-bold text-slate-800 mt-0.5">$6,300,000</p>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">+10.7%</span>
              </div>
            </div>

            {/* Sparkline Accuracy */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-450 font-medium">Processing Accuracy</p>
                <p className="text-[20px] font-extrabold text-[#0B1F3A] mt-0.5">98.6%</p>
              </div>
              {/* Wave Sparkline */}
              <div className="w-28 h-8">
                <svg className="w-full h-full" viewBox="0 0 100 30" fill="none">
                  <path d="M0 25 Q15 5, 30 18 T60 8 T90 20 L100 15" stroke="rgb(37, 99, 235)" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M0 25 Q15 5, 30 18 T60 8 T90 20 L100 15 L100 30 L0 30 Z" fill="rgba(37, 99, 235, 0.08)" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Curved Dark Navy bottom section */}
      <footer className="bg-[#0B1F3A] text-white pt-16 pb-12 px-6 md:px-12 relative overflow-hidden" style={{ borderRadius: "24px 24px 0 0" }}>
        {/* Buttons / CTA segment */}
        <div className="max-w-xl mx-auto text-center space-y-5 mb-12">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link 
              to="/register" 
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-8 text-[14px] font-bold text-[#0B1F3A] hover:bg-slate-50 transition-colors w-full sm:w-auto shadow-md"
            >
              <span>Get Started</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
            <a 
              href="#features" 
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/20 hover:border-white/60 px-8 text-[14px] font-bold text-white transition-colors w-full sm:w-auto"
            >
              Learn More
            </a>
          </div>
          <p className="text-xs text-blue-200/60 font-medium">
            Already have an account?{" "}
            <Link to="/login" className="font-bold text-white hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        {/* Trusted Partners / Brands segment */}
        <div className="max-w-[1280px] mx-auto border-t border-white/10 pt-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-200/50 text-center md:text-left">
            Trusted by listed companies and organizations
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-65">
            {/* CSE */}
            <div className="flex flex-col items-center">
              <span className="font-sans font-black text-lg tracking-tighter text-white">CSE</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-blue-200/60 -mt-1.5">Colombo Stock Exchange</span>
            </div>
            {/* DFCC BANK */}
            <div className="flex flex-col items-center">
              <span className="font-serif font-black text-lg italic text-white tracking-tight">DFCC BANK</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-blue-200/60 -mt-1.5">Keep Growing</span>
            </div>
            {/* Nations Trust Bank */}
            <div className="flex flex-col items-center">
              <span className="font-sans font-extrabold text-sm tracking-tight text-white">NationsTrustBank</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}