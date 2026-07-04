/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAllSectors , useTradeSummary } from "@/hooks/useCseApi";

// ─── Sector Vector Illustrations ────────────────────────────────────────────
const SectorIllustrations: Record<string, React.FC<{ className?: string }>> = {
  Banking: ({ className }) => (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Building base */}
      <rect x="10" y="55" width="100" height="5" rx="1" fill="currentColor" opacity="0.25" />
      {/* Columns */}
      {[18, 32, 46, 60, 74, 88].map((x, i) => (
        <rect key={i} x={x} y="28" width="8" height="27" rx="1" fill="currentColor" opacity="0.2" />
      ))}
      {/* Pediment / roof */}
      <polygon points="10,28 60,6 110,28" fill="currentColor" opacity="0.35" />
      {/* Roof ridge line */}
      <line x1="10" y1="28" x2="110" y2="28" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      {/* Mini dollar sign */}
      <text x="54" y="24" fontSize="10" fontWeight="bold" fill="currentColor" opacity="0.7">$</text>
      {/* Sparkline at bottom */}
      <polyline points="10,72 25,68 40,70 55,62 70,65 85,58 100,55 115,52"
        stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Finance: ({ className }) => (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Candlestick chart */}
      {[
        { x: 12, open: 52, close: 40, high: 35, low: 58 },
        { x: 28, open: 42, close: 30, high: 25, low: 48 },
        { x: 44, open: 32, close: 48, high: 26, low: 52 },
        { x: 60, open: 46, close: 34, high: 30, low: 50 },
        { x: 76, open: 36, close: 22, high: 18, low: 40 },
        { x: 92, open: 24, close: 14, high: 10, low: 28 },
      ].map((c, i) => (
        <g key={i}>
          <line x1={c.x + 5} y1={c.high} x2={c.x + 5} y2={c.low} stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
          <rect x={c.x} y={Math.min(c.open, c.close)} width="10"
            height={Math.abs(c.open - c.close)} rx="1"
            fill="currentColor" opacity={c.close < c.open ? 0.7 : 0.2}
            stroke="currentColor" strokeWidth="1" />
        </g>
      ))}
      {/* Trend arrow */}
      <polyline points="10,70 30,65 50,67 70,60 90,55 110,48"
        stroke="currentColor" strokeWidth="2" fill="none" opacity="0.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  Insurance: ({ className }) => (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Shield body */}
      <path d="M60 8 L100 22 L100 48 C100 64 60 75 60 75 C60 75 20 64 20 48 L20 22 Z"
        fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.5" />
      {/* Shield inner */}
      <path d="M60 18 L90 29 L90 49 C90 61 60 70 60 70 C60 70 30 61 30 49 L30 29 Z"
        fill="currentColor" opacity="0.08" />
      {/* Check mark inside */}
      <polyline points="44,45 55,56 76,34"
        stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      {/* Heartbeat/pulse line */}
      <polyline points="5,75 20,75 28,60 36,80 44,55 52,75 68,75 76,65 84,70 100,75 115,75"
        stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.45"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  "Capital Goods": ({ className }) => (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Gear large */}
      <circle cx="45" cy="38" r="18" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="45" cy="38" r="8" fill="currentColor" opacity="0.2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 45 + 18 * Math.cos(rad);
        const y1 = 38 + 18 * Math.sin(rad);
        const x2 = 45 + 24 * Math.cos(rad);
        const y2 = 38 + 24 * Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.4" />;
      })}
      {/* Gear small */}
      <circle cx="82" cy="30" r="12" fill="currentColor" opacity="0.08" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="82" cy="30" r="5" fill="currentColor" opacity="0.18" />
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 82 + 12 * Math.cos(rad);
        const y1 = 30 + 12 * Math.sin(rad);
        const x2 = 82 + 17 * Math.cos(rad);
        const y2 = 30 + 17 * Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.35" />;
      })}
      {/* Bar chart below */}
      {[10, 20, 30, 40, 45, 38, 52].map((h, i) => (
        <rect key={i} x={8 + i * 15} y={78 - h} width="10" height={h} rx="2"
          fill="currentColor" opacity="0.2" />
      ))}
    </svg>
  ),

  Consumer: ({ className }) => (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Shopping bag */}
      <rect x="25" y="28" width="50" height="40" rx="4" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.5" />
      {/* Handle */}
      <path d="M38 28 C38 18 62 18 62 28" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" strokeLinecap="round" />
      {/* Tag/label */}
      <rect x="38" y="40" width="24" height="14" rx="2" fill="currentColor" opacity="0.2" />
      <line x1="50" y1="40" x2="50" y2="36" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      {/* Trend line */}
      <polyline points="5,72 20,68 40,70 55,60 75,63 90,55 110,50 115,48"
        stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Stars for ratings */}
      {[88, 100, 112].map((x, i) => (
        <text key={i} x={x} y="30" fontSize="9" fill="currentColor" opacity="0.5">★</text>
      ))}
    </svg>
  ),

  Diversified: ({ className }) => (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Pie slices */}
      {/* Slice 1: top-right */}
      <path d="M60 38 L60 16 A22 22 0 0 1 82 38 Z" fill="currentColor" opacity="0.35" />
      {/* Slice 2: bottom-right */}
      <path d="M60 38 L82 38 A22 22 0 0 1 60 60 Z" fill="currentColor" opacity="0.2" />
      {/* Slice 3: bottom-left large */}
      <path d="M60 38 L60 60 A22 22 0 0 1 38 38 Z" fill="currentColor" opacity="0.12" />
      {/* Slice 4: top-left */}
      <path d="M60 38 L38 38 A22 22 0 0 1 60 16 Z" fill="currentColor" opacity="0.25" />
      {/* Center */}
      <circle cx="60" cy="38" r="8" fill="#0D121F" />
      <circle cx="60" cy="38" r="4" fill="currentColor" opacity="0.4" />
      {/* Legend dots */}
      {[
        { x: 6, y: 55, o: 0.35 }, { x: 6, y: 63, o: 0.2 }, { x: 6, y: 71, o: 0.12 }, { x: 6, y: 79, o: 0.25 }
      ].map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r="3" fill="currentColor" opacity={d.o} />
      ))}
      {/* Bar chart on right */}
      {[30, 45, 20, 50, 38].map((h, i) => (
        <rect key={i} x={92 + i * 6} y={68 - h} width="4" height={h} rx="1"
          fill="currentColor" opacity={0.15 + i * 0.07} />
      ))}
    </svg>
  ),
};

// Fallback illustration for unknown sectors
const DefaultIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <polyline points="10,65 30,50 50,55 70,35 90,42 110,25"
      stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5"
      strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="110" cy="25" r="4" fill="currentColor" opacity="0.6" />
    <rect x="10" y="68" width="100" height="2" rx="1" fill="currentColor" opacity="0.15" />
  </svg>
);

// ─── Color Config ─────────────────────────────────────────────────────────────
const SECTOR_THEME: Record<string, {
  color: string;
  gradient: string;
  border: string;
  badge: string;
  dot: string;
  iconBg: string;
  glow: string;
}> = {
  Banking: {
    color: "text-sky-400",
    gradient: "from-sky-500/10 via-sky-500/5 to-transparent",
    border: "border-sky-500/20 hover:border-sky-500/50",
    badge: "bg-sky-500/10 text-sky-300 border-sky-500/25",
    dot: "bg-sky-400",
    iconBg: "bg-sky-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(14,165,233,0.25)]",
  },
  Finance: {
    color: "text-emerald-400",
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    border: "border-emerald-500/20 hover:border-emerald-500/50",
    badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    dot: "bg-emerald-400",
    iconBg: "bg-emerald-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(16,185,129,0.25)]",
  },
  Insurance: {
    color: "text-violet-400",
    gradient: "from-violet-500/10 via-violet-500/5 to-transparent",
    border: "border-violet-500/20 hover:border-violet-500/50",
    badge: "bg-violet-500/10 text-violet-300 border-violet-500/25",
    dot: "bg-violet-400",
    iconBg: "bg-violet-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(139,92,246,0.25)]",
  },
  "Capital Goods": {
    color: "text-amber-400",
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    border: "border-amber-500/20 hover:border-amber-500/50",
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    dot: "bg-amber-400",
    iconBg: "bg-amber-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(245,158,11,0.25)]",
  },
  Consumer: {
    color: "text-rose-400",
    gradient: "from-rose-500/10 via-rose-500/5 to-transparent",
    border: "border-rose-500/20 hover:border-rose-500/50",
    badge: "bg-rose-500/10 text-rose-300 border-rose-500/25",
    dot: "bg-rose-400",
    iconBg: "bg-rose-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(244,63,94,0.25)]",
  },
  Diversified: {
    color: "text-cyan-400",
    gradient: "from-cyan-500/10 via-cyan-500/5 to-transparent",
    border: "border-cyan-500/20 hover:border-cyan-500/50",
    badge: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25",
    dot: "bg-cyan-400",
    iconBg: "bg-cyan-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(6,182,212,0.25)]",
  },
};

const DEFAULT_THEME = SECTOR_THEME.Banking;

// ─── Sector Descriptors for subtitle fallback ────────────────────────────────
const SECTOR_SUBTITLES: Record<string, string> = {
  Banking: "Commercial & Central Banks",
  Finance: "Investment & Asset Management",
  Insurance: "Life, Health & General Cover",
  "Capital Goods": "Industrials & Manufacturing",
  Consumer: "Retail & Consumer Staples",
  Diversified: "Multi-Sector Conglomerates",
};

// ─── Mini Sparkline (inline SVG trend) ───────────────────────────────────────
const Sparkline: React.FC<{ positive?: boolean; className?: string }> = ({
  positive = true,
  className = "",
}) => {
  const upPts = "0,20 10,16 20,18 30,12 40,14 50,8 60,10 70,4 80,6";
  const downPts = "0,4 10,8 20,6 30,12 40,10 50,16 60,14 70,18 80,20";
  return (
    <svg viewBox="0 0 80 24" className={`w-16 h-6 ${className}`} fill="none">
      <polyline
        points={positive ? upPts : downPts}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={positive ? "80" : "80"}
        cy={positive ? "6" : "20"}
        r="2.5"
        fill="currentColor"
      />
    </svg>
  );
};

// ─── SectorCard ──────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SectorCard: React.FC<{ data: any; onClick?: () => void }> = ({ data, onClick }) => {
  const theme = SECTOR_THEME[data.title] || DEFAULT_THEME;
  const Illustration = SectorIllustrations[data.title] || DefaultIllustration;
  const subtitle = data.subtitle || SECTOR_SUBTITLES[data.title] || "Market Sector";
  const isPositive = data.change >= 0;

  return (
    <div
      className={`
        group relative flex flex-col overflow-hidden rounded-2xl
        border ${theme.border}
        bg-[#0B0F1C] transition-all duration-400 cursor-pointer
        ${theme.glow}
      `}
      style={{ transition: "transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease" }}
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-4px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      {/* Gradient background that activates on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none`} />

      {/* Top: Vector Illustration */}
      <div className={`relative w-full px-4 pt-5 pb-2 ${theme.iconBg} overflow-hidden`}>
        <Illustration className={`w-full h-16 ${theme.color}`} />
        {/* Subtle grid lines */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)", backgroundSize: "10px 10px" }} />
      </div>

      {/* Body */}
      <div className="relative flex flex-col flex-1 p-4 gap-3 z-10">
        {/* Title & Status dot */}
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${theme.dot} shrink-0`} />
          <h3 className="text-sm font-bold text-gray-100 group-hover:text-white transition-colors leading-tight">
            {data.title}
          </h3>
        </div>

        {/* Subtitle */}
        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium leading-snug">
          {subtitle}
        </p>

        {/* Divider */}
        <div className="border-t border-gray-800/70" />

        {/* Stats row */}
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-0.5">Listed Assets</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-extrabold tabular-nums ${theme.color}`}>
                {data.count > 0 ? data.count : "—"}
              </span>
              <span className="text-[9px] text-gray-600 font-mono">CO.</span>
            </div>
          </div>

          {/* Change % + sparkline */}
          <div className="flex flex-col items-end gap-1">
            <Sparkline positive={isPositive} className={theme.color} />
            <span
              className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded border ${theme.badge}`}
            >
              {isPositive ? "▲" : "▼"}{" "}
              {data.change != null
                ? Math.abs(data.change).toFixed(2) + "%"
                : "N/A"}
            </span>
          </div>
        </div>

        {/* Asset count badge row */}
        <div className={`inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-mono font-semibold ${theme.badge}`}>
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none">
            <path d="M2 14 L2 6 L8 2 L14 6 L14 14 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <rect x="5" y="9" width="2" height="5" fill="currentColor" opacity="0.6" />
            <rect x="9" y="7" width="2" height="7" fill="currentColor" opacity="0.6" />
          </svg>
          MARKET SECTOR
        </div>
      </div>
    </div>
  );
};


// ─── Summary Stats Bar ────────────────────────────────────────────────────────
const SummaryBar: React.FC<{ totalSectors: number; totalAssets: number }> = ({
  totalSectors,
  totalAssets,
}) => (
  <div className="flex flex-wrap gap-6 items-center mt-4 mb-10">
    {[
      { label: "Active Sectors", value: totalSectors },
      { label: "Listed Companies", value: totalAssets }
    ].map((stat, i) => (
      <div key={i} className="flex flex-col">
        <span className="text-[10px] uppercase tracking-widest text-gray-600 font-medium">{stat.label}</span>
        <span className="text-base font-bold text-gray-300 tabular-nums">{stat.value}</span>
      </div>
    ))}
  </div>
);

// ─── Main Section ─────────────────────────────────────────────────────────────
export default function SectorsFullSection() {
  const router = useRouter();
  const {
    data: allSectors,
    loading: sectorLoading,
    error: sectorError,
  } = useAllSectors({ refetchInterval: 10_000 });
  const { data: stocksDetails, loading: stocksLoading, error: stocksError } = useTradeSummary({ refetchInterval: 10_000 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sectors: any[] = Array.isArray(allSectors) ? allSectors : [];
  const stocks: any[] = Array.isArray(stocksDetails) ? stocksDetails : [];
 

  return (
    <section className="w-full relative overflow-hidden py-20 px-6 md:px-10 border-y border-gray-800/40"
      style={{ background: "linear-gradient(160deg, #070B14 0%, #0A0E1C 50%, #0D1428 100%)" }}>

      {/* Background decoration — abstract grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, #3B82F6 0%, transparent 60%), radial-gradient(circle at 80% 70%, #8B5CF6 0%, transparent 60%)",
        }} />
      <div className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

      <div className="relative w-full mx-auto max-w-[1600px]">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-2">
          <div>
            {/* Label */}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-4 bg-linear-to-b froky-400 to-amber-500 rounded-fullm-s" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B28D41] ">
                Market Intelligence
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Sector Overview
            </h2>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 text-sm font-semibold text-white bg-gray-800/80 hover:bg-gray-700/80 px-4 py-2 rounded-lg border border-gray-700/60 hover:border-gray-600 transition-all duration-200 group backdrop-blur-sm">
              Go to Sectors
              <svg className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Summary stats */}
        {!sectorLoading && !sectorError && sectors.length > 0 && (
          <SummaryBar totalSectors={sectors.length} totalAssets={stocks.length} />
        )}

        {/* ── Grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Loading skeleton */}
          {sectorLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-800/50 bg-[#0B0F1C] overflow-hidden animate-pulse">
                <div className="h-16 bg-gray-800/40" />
                <div className="p-4 space-y-3">
                  <div className="h-3 bg-gray-800 rounded w-3/4" />
                  <div className="h-2 bg-gray-800/60 rounded w-1/2" />
                  <div className="h-px bg-gray-800/70 rounded" />
                  <div className="h-6 bg-gray-800 rounded w-1/3" />
                </div>
              </div>
            ))}

          {/* Error state */}
          {sectorError && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 gap-3 text-red-400">
              <svg className="w-10 h-10 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-sm">Failed to load sector data. <span className="opacity-60">{sectorError}</span></p>
            </div>
          )}

          {/* Sector cards */}
          {!sectorLoading && !sectorError && sectors.length > 0
            ? sectors.slice(0,12).map((sector: any, idx: number) => {
              const name = sector.name || sector.title || "Sector";
              return (
                <SectorCard
                  key={sector.id || idx}
                  data={{
                    id: sector.id || idx,
                    title: name,
                    subtitle: sector.subtitle || sector.description || "",
                    count: sector.count || sector.assetCount || sector.totalAssets || 0,
                    change: sector.change ?? sector.changePercent ?? null,
                  }}
                  onClick={() => router.push(`/sector_page?sectorId=${encodeURIComponent(sector.id || idx)}`)}
                />
              );
            })
            : !sectorLoading && !sectorError && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
                <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-sm">No sector data available</span>
              </div>
            )}
        </div>
      </div>
    </section>
  );
}