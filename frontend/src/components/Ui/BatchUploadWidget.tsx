"use client";

import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { reportApi, type CompanyMeta, type BatchUploadResponse } from "@/lib/api";

interface BatchUploadWidgetProps {
  onUploadComplete?: (result: BatchUploadResponse) => void;
}

interface FileEntry {
  file: File;
  id: string;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

export default function BatchUploadWidget({ onUploadComplete }: BatchUploadWidgetProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [company, setCompany] = useState<CompanyMeta>({ symbol: "", name: "", sector: "" });
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const pdfFiles = Array.from(newFiles).filter((f) => f.type === "application/pdf");
      const remaining = 10 - files.length;
      const toAdd = pdfFiles.slice(0, remaining).map((f) => ({
        file: f,
        id: crypto.randomUUID(),
      }));
      if (toAdd.length > 0) setFiles((prev) => [...prev, ...toAdd]);
    },
    [files.length]
  );

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const formatSize = (bytes: number) => {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    return `${(bytes / 1_000).toFixed(0)} KB`;
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleSubmit = async () => {
    if (files.length === 0 || !company.symbol.trim()) return;
    setStatus("uploading");
    setErrorMessage("");
    setProgress(10);

    try {
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + 5, 90));
      }, 2000);

      const { data } = await reportApi.batchUpload(
        files.map((f) => f.file),
        company
      );

      clearInterval(interval);
      setProgress(100);
      setStatus("success");
      onUploadComplete?.(data);
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative group"
    >
      {/* Outer glow */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-[#38BDF8]/30 via-[#38BDF8]/5 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-700 blur-sm" />

      <div className="relative rounded-2xl bg-[#131B2C]/90 backdrop-blur-xl overflow-hidden border border-[#38BDF8]/10">
        {/* Top accent line */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[#38BDF8] to-transparent" />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[11px] font-semibold tracking-widest uppercase text-[#38BDF8]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />
                Multi-Report
              </span>
            </div>
            <h3 className="text-xl font-bold text-white mt-3">Batch Upload</h3>
            <p className="text-sm text-gray-400 mt-1">
              Upload up to 10 annual reports for comparative analysis
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 ${
              dragOver
                ? "border-[#38BDF8] bg-[#38BDF8]/5"
                : "border-[#38BDF8]/20 hover:border-[#38BDF8]/40 hover:bg-[#38BDF8]/[0.02]"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <Upload className="w-8 h-8 text-[#38BDF8]/60 mx-auto mb-3" />
            <p className="text-sm text-gray-300">
              Drag & drop PDF files here, or <span className="text-[#38BDF8] font-medium">browse</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {files.length}/10 files · PDF only
            </p>
          </div>

          {/* File list */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {files.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#0B0F16]/60 border border-[#38BDF8]/8"
                  >
                    <FileText className="w-4 h-4 text-[#38BDF8]/60 shrink-0" />
                    <span className="text-sm text-gray-300 truncate flex-1">
                      {entry.file.name}
                    </span>
                    <span className="text-xs text-gray-500 shrink-0">
                      {formatSize(entry.file.size)}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(entry.id); }}
                      className="p-1 rounded hover:bg-[#F87171]/10 text-gray-500 hover:text-[#F87171] transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Company metadata */}
          <div className="grid grid-cols-3 gap-3">
            {(["symbol", "name", "sector"] as const).map((field) => (
              <div key={field}>
                <label className="text-[11px] uppercase tracking-wider text-gray-500 mb-1 block">
                  {field}
                </label>
                <input
                  value={company[field]}
                  onChange={(e) => setCompany((prev) => ({ ...prev, [field]: e.target.value }))}
                  placeholder={field === "symbol" ? "e.g. JKH" : field === "name" ? "Company Name" : "e.g. Diversified"}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F16]/80 border border-[#38BDF8]/10 text-sm text-gray-200 placeholder-gray-600 focus:border-[#38BDF8]/40 focus:outline-none transition-colors"
                />
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {status === "uploading" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-[#38BDF8] animate-spin" />
                <span className="text-sm text-gray-300">Processing {files.length} reports...</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#0B0F16] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#38BDF8] to-[#22D3EE]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}

          {/* Status messages */}
          {status === "success" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#4ADE80]/8 border border-[#4ADE80]/20">
              <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
              <span className="text-sm text-[#4ADE80]">All reports processed successfully!</span>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F87171]/8 border border-[#F87171]/20">
              <AlertCircle className="w-4 h-4 text-[#F87171]" />
              <span className="text-sm text-[#F87171]">{errorMessage || "Upload failed"}</span>
            </div>
          )}

          {/* Submit button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            disabled={files.length === 0 || !company.symbol.trim() || status === "uploading"}
            onClick={handleSubmit}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#1E6CB3] to-[#38BDF8] hover:shadow-lg hover:shadow-[#38BDF8]/20 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 rounded-xl transition-all duration-300"
          >
            {status === "uploading" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Analyze {files.length} Report{files.length !== 1 ? "s" : ""}
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
