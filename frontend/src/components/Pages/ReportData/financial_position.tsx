"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  dataApi,
  type ExtractedDataRecord,
} from "@/lib/api";

import {
  FolderTree,
  Calendar,
  Loader2,
  AlertCircle,
  Database
} from "lucide-react";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function extractSymbolBase(symbol: string): string {
  if (!symbol) return "";
  return symbol.split(".")[0].trim().toUpperCase();
}

const FINANCIAL_POSITION_KEYS = [
  "balance_sheet",
  "balance_sheet_statement",
  "financial_position",
  "statement_of_financial_position",
  "assets",
  "liabilities",
  "equity",
];

function filterFinancialPositionData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(data)) {
    const k = key.toLowerCase().replace(/\s+/g, "_");
    if (FINANCIAL_POSITION_KEYS.some((kw) => k.includes(kw))) {
      result[key] = val;
    }
  }

  return Object.keys(result).length > 0 ? result : data;
}

// ─────────────────────────────────────────────
// Value Renderer
// ─────────────────────────────────────────────

function renderValue(val: unknown): React.ReactNode {
  if (val === null || val === undefined) {
    return <span className="text-[#475569] italic font-jetbrains text-xs">—</span>;
  }

  if (typeof val === "number") {
    return (
      <span className="font-jetbrains text-[#F1F5F9] tabular-nums">
        {val < 1 && val > -1 && val !== 0
          ? `${(val * 100).toFixed(1)}%`
          : val.toLocaleString()}
      </span>
    );
  }

  if (typeof val === "string") {
    return <span className="text-[#F1F5F9] font-inter">{val}</span>;
  }

  if (Array.isArray(val)) {
    if (val.length === 0)
      return <span className="text-[#475569] italic font-jetbrains text-xs">[]</span>;

    if (typeof val[0] === "object") {
      const keys = Object.keys(val[0] as Record<string, unknown>);
      return (
        <div className="overflow-x-auto" style={{ border: "1px solid rgba(56,189,248,0.08)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#0D131A", borderBottom: "1px solid rgba(56,189,248,0.12)" }}>
                {keys.map((k) => (
                  <th key={k} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#64748B] font-inter">
                    {k.includes("Note") ? "" : k.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {val.map((item, i) => (
                <tr
                  key={i}
                  className="terminal-row-hover transition-colors duration-100"
                  style={{
                    borderBottom: "1px solid rgba(56,189,248,0.06)",
                    background: i % 2 === 0 ? "transparent" : "rgba(56,189,248,0.02)",
                  }}
                >
                  {keys.map((k) => (
                    <td key={k} className="px-4 py-2.5 font-inter">
                      {renderValue(
                        (item as Record<string, unknown>)[k]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <span className="text-[#F1F5F9] font-jetbrains text-xs tabular-nums">
        {val.map(String).join(", ")}
      </span>
    );
  }

  if (typeof val === "object") {
    const entries = Object.entries(val as Record<string, unknown>);
    return (
      <div className="overflow-hidden" style={{ border: "1px solid rgba(56,189,248,0.08)" }}>
        <table className="w-full text-sm">
          <tbody>
            {entries.map(([k, v], i) => (
              <tr
                key={k}
                className="terminal-row-hover transition-colors duration-100"
                style={{
                  borderBottom: "1px solid rgba(56,189,248,0.06)",
                  background: i % 2 === 0 ? "transparent" : "rgba(56,189,248,0.02)",
                }}
              >
                <td className="px-4 py-2.5 text-[#64748B] font-bold font-inter text-xs uppercase tracking-wider w-[35%]">
                  {k.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-2.5">
                  {renderValue(v)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <span className="text-[#F1F5F9]">{String(val)}</span>;
}

export default function ReportsPage() {
  const params = useParams<{ symbol?: string }>();

  const rawSymbol = params?.symbol
    ? decodeURIComponent(params.symbol)
    : null;

  const symbolParam = rawSymbol
    ? extractSymbolBase(rawSymbol)
    : null;

  const [records, setRecords] = useState<ExtractedDataRecord[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] =
    useState<ExtractedDataRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!symbolParam) return;

      try {
        setLoading(true);
        setError(null);

        const res = await dataApi.getCompanyDataByName(symbolParam);
        const fetched = res.data || [];

        setRecords(fetched);

        const uniqueYears = Array.from(
          new Set(fetched.map((r) => r.year))
        ).sort((a, b) => Number(b) - Number(a));

        setYears(uniqueYears);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to load company data";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [symbolParam]);

  const currentYearRecords = useMemo(() => {
    if (!selectedYear) return [];
    return records.filter((r) => r.year === selectedYear);
  }, [records, selectedYear]);

  return (
    <div className="flex flex-col h-full gap-4">

      {/* ═══════ Year Selector Bar ═══════ */}
      <aside
        className="hidden w-full shrink-0 flex-col overflow-y-auto lg:flex"
        style={{
          background: "#0B0F16",
          border: "1px solid rgba(56,189,248,0.1)",
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid rgba(56,189,248,0.1)" }}
        >
          <FolderTree className="h-4 w-4 text-[#38BDF8]" />
          <h2 className="font-bold text-[#F1F5F9] text-xs uppercase tracking-widest font-inter">Years</h2>
        </div>

        <div className="flex w-full p-2 gap-2">
          {loading ? (
            <div className="flex justify-center py-6 w-full">
              <Loader2 className="h-5 w-5 animate-spin text-[#38BDF8]" />
            </div>
          ) : years.length === 0 ? (
            <p className="px-3 py-4 text-sm text-[#475569] font-inter">
              No years found
            </p>
          ) : (
            years.map((year) => (
              <button
                key={year}
                onClick={() => {
                  setSelectedYear(year);
                  const yearRecords = records.filter(
                    (r) => r.year === year
                  );
                  const annual = yearRecords.find(
                    (r) =>
                      r.type?.toLowerCase() ===
                      "annual_report_ocr"
                  );
                  setSelectedRecord(
                    annual ?? yearRecords[0] ?? null
                  );
                }}
                className={`flex items-center gap-2 cursor-pointer px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-150 font-jetbrains ${selectedYear === year
                    ? "text-[#38BDF8]"
                    : "text-[#475569] hover:text-[#94A3B8]"
                  }`}
                style={{
                  background: selectedYear === year
                    ? "rgba(56,189,248,0.1)"
                    : "transparent",
                  border: selectedYear === year
                    ? "1px solid rgba(56,189,248,0.25)"
                    : "1px solid rgba(56,189,248,0.06)",
                  boxShadow: selectedYear === year
                    ? "0 0 12px rgba(56,189,248,0.15), inset 0 0 8px rgba(56,189,248,0.05)"
                    : "none",
                }}
              >
                <Calendar className="h-3.5 w-3.5" />
                {year}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ═══════ Main Content ═══════ */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">

        {error && (
          <div
            className="flex items-center gap-2 px-4 py-3 text-sm font-inter"
            style={{
              background: "rgba(248,113,113,0.06)",
              border: "1px solid rgba(248,113,113,0.2)",
              color: "#F87171",
            }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#38BDF8]" />
          </div>
        )}

        {!loading && selectedRecord && (
          <div
            className="flex-1 overflow-y-auto p-6"
            style={{
              background: "#0B0F16",
              border: "1px solid rgba(56,189,248,0.08)",
            }}
          >
            <h2 className="text-lg font-bold text-[#F1F5F9] font-inter uppercase tracking-wider">
              {selectedRecord.company}
            </h2>

            <div className="mt-4 space-y-4">
              {Object.entries(
                filterFinancialPositionData(
                  selectedRecord.data as Record<string, unknown>
                )
              ).map(([key, val]) => (
                <div
                  key={key}
                  className="p-4"
                  style={{
                    background: "#0D131A",
                    border: "1px solid rgba(56,189,248,0.08)",
                  }}
                >
                  <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#38BDF8] font-inter">
                    {key.replace(/_/g, " ")}
                  </h3>
                  {renderValue(val)}
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !selectedYear && (
          <div className="flex flex-1 flex-col items-center justify-center" style={{ color: "#475569" }}>
            <Database className="mb-3 h-12 w-12 text-[#38BDF8] opacity-30" />
            <p className="text-lg font-bold text-[#94A3B8] font-inter uppercase tracking-wider">
              {rawSymbol} — Financial Reports
            </p>
            <p className="mt-1 text-sm text-[#475569] font-inter">
              Select a year from the panel above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}