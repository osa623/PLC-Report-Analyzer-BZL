/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useMemo } from "react";
import {
    Search,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTradeSummary, useAllSectors } from "@/hooks/useCseApi";
import localSectors from '../../../Data/Sector_Cat.json';
import localSectors_name from '../../../Data/Sectors.json';



// Data section ---------






// Temp code snippets ---------------------- for the sector widgets-----------


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

  "Commercial & Professional Services": {
    color: "text-sky-400",
    gradient: "from-sky-500/15 via-sky-500/5 to-transparent",
    border: "border-sky-500/25 hover:border-sky-400/60",
    badge: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    dot: "bg-sky-400",
    iconBg: "bg-sky-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(56,189,248,0.30)]",
  },

  Transportation: {
    color: "text-cyan-400",
    gradient: "from-cyan-500/15 via-cyan-500/5 to-transparent",
    border: "border-cyan-500/25 hover:border-cyan-400/60",
    badge: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    dot: "bg-cyan-400",
    iconBg: "bg-cyan-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(34,211,238,0.30)]",
  },

  "Automobiles & Components": {
    color: "text-blue-400",
    gradient: "from-blue-500/15 via-blue-500/5 to-transparent",
    border: "border-blue-500/25 hover:border-blue-400/60",
    badge: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    dot: "bg-blue-400",
    iconBg: "bg-blue-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(59,130,246,0.30)]",
  },

  "Consumer Durables & Apparel": {
    color: "text-amber-400",
    gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
    border: "border-amber-500/25 hover:border-amber-400/60",
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
    iconBg: "bg-amber-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(245,158,11,0.35)]",
  },

  "Consumer Services": {
    color: "text-yellow-400",
    gradient: "from-yellow-500/15 via-yellow-500/5 to-transparent",
    border: "border-yellow-500/25 hover:border-yellow-400/60",
    badge: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
    dot: "bg-yellow-400",
    iconBg: "bg-yellow-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(250,204,21,0.35)]",
  },

  Retailing: {
    color: "text-amber-400",
    gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
    border: "border-amber-500/25 hover:border-amber-400/60",
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
    iconBg: "bg-amber-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(245,158,11,0.35)]",
  },

  "Food & Staples Retailing": {
    color: "text-yellow-400",
    gradient: "from-yellow-500/15 via-yellow-500/5 to-transparent",
    border: "border-yellow-500/25 hover:border-yellow-400/60",
    badge: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
    dot: "bg-yellow-400",
    iconBg: "bg-yellow-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(250,204,21,0.35)]",
  },

  "Food, Beverage & Tobacco": {
    color: "text-amber-400",
    gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
    border: "border-amber-500/25 hover:border-amber-400/60",
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
    iconBg: "bg-amber-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(245,158,11,0.35)]",
  },

  "Household & Personal Products": {
    color: "text-yellow-400",
    gradient: "from-yellow-500/15 via-yellow-500/5 to-transparent",
    border: "border-yellow-500/25 hover:border-yellow-400/60",
    badge: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
    dot: "bg-yellow-400",
    iconBg: "bg-yellow-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(250,204,21,0.35)]",
  },

  "Health Care Equipment & Services": {
    color: "text-indigo-400",
    gradient: "from-indigo-500/15 via-indigo-500/5 to-transparent",
    border: "border-indigo-500/25 hover:border-indigo-400/60",
    badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    dot: "bg-indigo-400",
    iconBg: "bg-indigo-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(99,102,241,0.30)]",
  },

  Banks: {
    color: "text-sky-400",
    gradient: "from-sky-500/15 via-sky-500/5 to-transparent",
    border: "border-sky-500/25 hover:border-sky-400/60",
    badge: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    dot: "bg-sky-400",
    iconBg: "bg-sky-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(56,189,248,0.30)]",
  },

  "Diversified Financials": {
    color: "text-indigo-400",
    gradient: "from-indigo-500/15 via-indigo-500/5 to-transparent",
    border: "border-indigo-500/25 hover:border-indigo-400/60",
    badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    dot: "bg-indigo-400",
    iconBg: "bg-indigo-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(99,102,241,0.30)]",
  },

  Insurance: {
    color: "text-blue-400",
    gradient: "from-blue-500/15 via-blue-500/5 to-transparent",
    border: "border-blue-500/25 hover:border-blue-400/60",
    badge: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    dot: "bg-blue-400",
    iconBg: "bg-blue-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(59,130,246,0.30)]",
  },

  "Software & Services": {
    color: "text-cyan-400",
    gradient: "from-cyan-500/15 via-cyan-500/5 to-transparent",
    border: "border-cyan-500/25 hover:border-cyan-400/60",
    badge: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    dot: "bg-cyan-400",
    iconBg: "bg-cyan-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(34,211,238,0.30)]",
  },

  "Telecommunication Services": {
    color: "text-blue-400",
    gradient: "from-blue-500/15 via-blue-500/5 to-transparent",
    border: "border-blue-500/25 hover:border-blue-400/60",
    badge: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    dot: "bg-blue-400",
    iconBg: "bg-blue-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(59,130,246,0.30)]",
  },

  Utilities: {
    color: "text-sky-400",
    gradient: "from-sky-500/15 via-sky-500/5 to-transparent",
    border: "border-sky-500/25 hover:border-sky-400/60",
    badge: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    dot: "bg-sky-400",
    iconBg: "bg-sky-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(56,189,248,0.30)]",
  },

  "Real Estate Management&Development": {
    color: "text-amber-400",
    gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
    border: "border-amber-500/25 hover:border-amber-400/60",
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
    iconBg: "bg-amber-500/10",
    glow: "hover:shadow-[0_4px_30px_-6px_rgba(245,158,11,0.35)]",
  },

};

const DEFAULT_THEME = SECTOR_THEME.Banks;

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

const SectorCard: React.FC<{ data: any; onClick?: () => void; active?: boolean }> = ({
  data,
  onClick,
  active = false,
}) => {
  const theme = SECTOR_THEME[data.title] || DEFAULT_THEME;
  const subtitle = data.subtitle || SECTOR_SUBTITLES[data.title] || "Market Sector";
  const isPositive = data.change >= 0;

  const sector = localSectors.find((s) => s.name === data.title);

  return (
    <div
      className={`
        group relative flex flex-col overflow-hidden rounded-2xl
        border bg-[#0B0F1C] transition-all duration-400 cursor-pointer
        ${theme.border}
        ${theme.glow}
        ${active ? "ring-2 ring-[#DFBD69]/70 border-[#DFBD69]/60 shadow-[0_0_40px_-10px_rgba(223,189,105,0.35)]" : ""}
      `}
      style={{ transition: "transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease" }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.transform = "translateY(-4px)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Gradient background that activates on hover */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        } transition-opacity duration-400 pointer-events-none`}
      />

      {/* Selected badge */}
      {active && (
        <div className="absolute top-3 right-3 z-20">

        </div>
      )}

      {/* Body */}
      <div className="relative flex flex-1 items-center justify-between p-4 gap-3 z-10">
        <div className="flex flex-col items-start gap-2">
          {sector ? (
            <h3 className="md:text-[8px] bg-amber-600 p-0.5 px-2 rounded-2xl font-bold font-encode text-gray-100">
              ASSETS: {Object.keys(sector.stocks).length}
            </h3>
          ) : null}

          <h3 className="text-sm font-thin font-encode text-gray-100 group-hover:text-white transition-colors leading-tight">
            {data.title}
          </h3>
        </div>

        <div className="border-t h-2/3 w-0.25 bg-amber-50 border-gray-800/70" />

        <div className="flex items-end justify-end gap-2">
          <div className="flex flex-col items-end gap-1">
            <Sparkline positive={isPositive} className={theme.color} />
            <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded border ${theme.badge}`}>
              {isPositive ? "▲" : "▼"}{" "}
              {data.change != null ? Math.abs(data.change).toFixed(2) + "%" : "N/A"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};










// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCompact(value: number): string {
    if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2) + "B";
    if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + "M";
    if (value >= 1_000) return (value / 1_000).toFixed(2) + "K";
    return value.toFixed(2);
}

function formatPrice(value: number): string {
    return value.toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

// clamp helper
const clamp = (n: number, min: number, max: number) =>
    Math.min(Math.max(n, min), max);

// ─── Chart Components (pure SVG, zero dependencies) ─────────────────────────

/**
 * MiniSparkline — generates a 7-point trend line from price + change %.
 * Points are synthesised from price and change to give believable motion.
 */
const MiniSparkline: React.FC<{
    price: number;
    change: number;
    positive: boolean;
}> = ({ price, change, positive }) => {
    // Synthesise 8 price points that end at `price` and started from price/(1+pct)
    const W = 80,
        H = 32,
        PAD = 3;
    const pts = useMemo(() => {
        const end = price;
        const start = price / (1 + change / 100);
        const raw: number[] = [];
        for (let i = 0; i < 8; i++) {
            const t = i / 7;
            // cubic easing + small noise
            const noise = (Math.sin(i * 2.3 + price) * 0.012 + Math.cos(i * 1.7) * 0.008) * price;
            raw.push(start + (end - start) * (t * t * (3 - 2 * t)) + noise);
        }
        const min = Math.min(...raw);
        const max = Math.max(...raw);
        const range = max - min || 1;
        return raw.map((v, i) => ({
            x: PAD + (i / 7) * (W - PAD * 2),
            y: H - PAD - ((v - min) / range) * (H - PAD * 2),
        }));
    }, [price, change]);

    const polyPts = pts.map((p) => `${p.x},${p.y}`).join(" ");
    const fillPts = `${pts[0].x},${H} ${polyPts} ${pts[pts.length - 1].x},${H}`;
    const color = positive ? "#34d399" : "#f87171";

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8" fill="none">
            <defs>
                <linearGradient id={`sg-${positive ? "up" : "dn"}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={fillPts} fill={`url(#sg-${positive ? "up" : "dn"})`} />
            <polyline
                points={polyPts}
                stroke={color}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* End dot */}
            <circle
                cx={pts[7].x}
                cy={pts[7].y}
                r="2.5"
                fill={color}
                opacity="0.9"
            />
        </svg>
    );
};

/**
 * PriceRangeBar — shows low / current / high as a horizontal track.
 */
const PriceRangeBar: React.FC<{
    low: number;
    high: number;
    price: number;
    positive: boolean;
}> = ({ low, high, price, positive }) => {
    const range = high - low || 1;
    const fillPct = clamp(((price - low) / range) * 100, 0, 100);
    const dotPct = clamp(((price - low) / range) * 100, 1, 99);
    const color = positive ? "#34d399" : "#f87171";

    return (
        <div className="w-full">
            <div className="flex justify-between text-[9px] text-gray-600 font-mono mb-1">
                <span>{formatPrice(low)}</span>
                <span className="text-gray-500">52W Range</span>
                <span>{formatPrice(high)}</span>
            </div>
            <div className="relative h-1.5 w-full rounded-full bg-gray-800/80 overflow-visible">
                {/* Filled track */}
                <div
                    className="absolute left-0 top-0 h-full rounded-full"
                    style={{ width: `${fillPct}%`, background: `${color}55` }}
                />
                {/* Price dot */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-[#0D1425]"
                    style={{ left: `calc(${dotPct}% - 5px)`, background: color }}
                />
            </div>
        </div>
    );
};

/**
 * VolumeBarChart — 6 synthetic volume bars that peak at current volume.
 */
const VolumeBarChart: React.FC<{ volume: number; positive: boolean }> = ({
    volume,
    positive,
}) => {
    const bars = useMemo(() => {
        const seed = volume % 100;
        // 6 bars; last bar = 100% (current)
        const raws = [
            0.4 + ((seed * 7) % 40) / 100,
            0.5 + ((seed * 3) % 35) / 100,
            0.35 + ((seed * 11) % 45) / 100,
            0.6 + ((seed * 5) % 30) / 100,
            0.45 + ((seed * 9) % 38) / 100,
            1.0,
        ];
        return raws;
    }, [volume]);

    const color = positive ? "#34d399" : "#f87171";
    const W = 60, H = 28;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-14 h-7" fill="none">
            {bars.map((ratio, i) => {
                const barH = ratio * (H - 4);
                const isLast = i === bars.length - 1;
                return (
                    <rect
                        key={i}
                        x={i * 10 + 1}
                        y={H - barH}
                        width="8"
                        height={barH}
                        rx="1.5"
                        fill={color}
                        opacity={isLast ? 0.85 : 0.25 + ratio * 0.3}
                    />
                );
            })}
        </svg>
    );
};

// SVG height constant for CandlestickIndicator
const CANDLE_H = 32;

/**
 * CandlestickIndicator — a compact OHLC-style symbol.
 */
const CandlestickIndicator: React.FC<{
    open: number;
    close: number;
    high: number;
    low: number;
    positive: boolean;
}> = ({ open, close, high, low, positive }) => {
    const color = positive ? "#34d399" : "#f87171";
    const range = high - low || 1;
    const bodyTop = CANDLE_H - ((Math.max(open, close) - low) / range) * (CANDLE_H - 4) - 2;
    const bodyBot = CANDLE_H - ((Math.min(open, close) - low) / range) * (CANDLE_H - 4) - 2;
    const bodyH = Math.max(bodyBot - bodyTop, 2);
    const wickTop = CANDLE_H - ((high - low) / range) * (CANDLE_H - 4) - 2;
    const wickBot = CANDLE_H - 2;

    return (
        <svg viewBox="0 0 24 32" className="w-5 h-7" fill="none">
            {/* wick */}
            <line x1="12" y1={wickTop} x2="12" y2={wickBot} stroke={color} strokeWidth="1.5" opacity="0.5" />
            {/* body */}
            <rect x="6" y={bodyTop} width="12" height={bodyH} rx="1.5" fill={color} opacity="0.85" />
        </svg>
    );
};

// ─── Stock Card ───────────────────────────────────────────────────────────────

const StockCard: React.FC<{ stock: any; index: number }> = ({ stock, index }) => {
    const positive = stock.percentageChange >= 0;
    const accentColor = positive ? "text-emerald-400" : "text-red-400";
    const accentBg = positive ? "bg-emerald-400/10" : "bg-red-400/10";
    // matching the ticker to get the sector name
    const sector_name = localSectors_name.find((t)=> t.symbol === stock.symbol ); 

    return (
        <motion.div
            key={stock.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.04 }}
            className="group relative flex flex-col gap-0 bg-[#080D1A] cursor-pointer backdrop-blur-md rounded-2xl border border-white/10 hover:border-[#DFBD69]/35 transition-all duration-300 hover:shadow-[0_0_35px_-8px_rgba(223,189,105,0.18)] overflow-hidden"
        >
            {/* Hover gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-[#DFBD69]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            {/* ── Market Cap Badge ─── */}
            <div className="absolute top-0 left-0">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-[#DFBD69]/10 border-b border-r border-[#DFBD69]/20 rounded-br-xl">
                    <div className="w-1 h-1 rounded-full bg-[#DFBD69] shadow-[0_0_6px_#DFBD69]" />
                    <span className="text-[9px] font-mono uppercase tracking-widest text-[#DFBD69]">
                        {sector_name?.sector || "Unknown Sector"}
                    </span>
                </div>
            </div>

            {/* ── Header row ─── */}
            <div className="flex justify-between items-start px-5 pt-8 pb-2">
                <div className="flex flex-col">
                    <span className="text-lg font-bold text-white group-hover:text-[#DFBD69] transition-colors tracking-wide">
                        {stock.symbol}
                    </span>
                    <span className="text-[10px] text-gray-500 max-w-[160px] truncate mt-0.5">
                        {stock.name}
                    </span>
                </div>
                {/* Change badge */}
                <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md mt-1 ${accentColor} ${accentBg}`}>
                    {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(stock.percentageChange).toFixed(2)}%
                </div>
            </div>

            {/* ── Price row ─── */}
            <div className="flex items-center justify-between px-5 pb-2">
                <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-bold text-white font-mono">
                        LKR {formatPrice(stock.price)}
                    </span>
                    <span className={`text-[10px] ${positive ? "text-emerald-400" : "text-red-400"}`}>
                        ({positive ? "+" : ""}{formatPrice(stock.change)})
                    </span>
                </div>
                {/* Candlestick indicator */}
                <CandlestickIndicator
                    open={stock.open ?? (stock.price - stock.change)}
                    close={stock.price}
                    high={stock.high}
                    low={stock.low}
                    positive={positive}
                />
            </div>

            {/* ── Sparkline chart ─── */}
            <div className="px-5 pb-2">
                <div className="rounded-xl overflow-hidden bg-gray-900/40 border border-white/5 px-2 pt-1 pb-0.5">
                    <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[8px] uppercase tracking-widest text-gray-600">Trend</span>
                        <span className={`text-[8px] font-mono ${positive ? "text-emerald-500" : "text-red-500"}`}>
                            {positive ? "↑ Bullish" : "↓ Bearish"}
                        </span>
                    </div>
                    <MiniSparkline price={stock.price} change={stock.percentageChange} positive={positive} />
                </div>
            </div>

            {/* ── Price Range bar ─── */}
            <div className="px-5 pb-3">
                <PriceRangeBar low={stock.low} high={stock.high} price={stock.price} positive={positive} />
            </div>

            {/* ── Stats bar ─── */}
            <div className="px-5 pb-4 pt-2 border-t border-white/[0.07] flex items-center justify-between gap-2">
                {/* Volume mini-chart */}
                <div className="flex flex-col items-start gap-0.5">
                    <span className="text-[8px] uppercase tracking-widest text-gray-600">Volume</span>
                    <div className="flex items-end gap-1.5">
                        <VolumeBarChart volume={stock.sharevolume} positive={positive} />
                        <span className={`text-[10px] font-bold font-mono ${accentColor}`}>
                            {formatCompact(stock.sharevolume)}
                        </span>
                    </div>
                </div>

                {/* Vertical divider */}
                <div className="h-10 w-px bg-white/10 mx-1 shrink-0" />

                {/* OHLC stat stack */}
                <div className="flex gap-3 flex-1 justify-end">
                    <div className="flex flex-col items-center">
                        <span className="text-[8px] text-gray-600 uppercase">High</span>
                        <span className="text-[10px] font-semibold text-sky-400 font-mono">
                            {formatPrice(stock.high)}
                        </span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[8px] text-gray-600 uppercase">Low</span>
                        <span className="text-[10px] font-semibold text-violet-400 font-mono">
                            {formatPrice(stock.low)}
                        </span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[8px] text-gray-600 uppercase">T/O</span>
                        <span className="text-[10px] font-semibold text-[#DFBD69] font-mono">
                            {formatCompact(stock.turnover)}
                        </span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ─── Main Section ─────────────────────────────────────────────────────────────

export default function SectorSection() {



    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSector, setSelectedSector] = useState<string>("all");
    const [sortOption, setSortOption] = useState("");

    const { data: tradeSummary, loading: tradesLoading, error: tradesError } =
        useTradeSummary({ refetchInterval: 30_000 });
    const { data: sectorData, error: sectorError, loading: sectorLoading } = useAllSectors({
        refetchInterval: 60_000,
    });

    const sectors: any[] = Array.isArray(sectorData) ? sectorData : [];
    const totalAssets = sectors.reduce(
        (sum: number, s: any) => sum + (s.count || s.assetCount || s.totalAssets || 0),
        0
    );



    

    /*
    const sectorTabs = useMemo(() => {
        const allTab = { id: "all", name: "All Sectors", icon: Activity };
        if (!sectorsData) return [allTab];
        const icons = [Server, Landmark, Zap, TrendingUp, Briefcase, Activity];
        const realTabs = sectorsData.slice(0, 10).map((s: any, i: number) => ({
            id: String(s.sectorId),
            name: s.name,
            icon: icons[i % icons.length],
        }));
        return [allTab, ...realTabs];
    }, [sectorsData]); */


    const symbolToSector = useMemo(() => {
  const map = new Map<string, string>();
  for (const row of localSectors_name as any[]) {
        if (row?.symbol && row?.sector) map.set(String(row.symbol).toUpperCase(), String(row.sector));
    }
    return map;
    }, []);

    const allStocks: any[] = useMemo(
        () => tradeSummary?.reqTradeSummery ?? [],
        [tradeSummary]
    );

    // Aggregate stats for the summary bar
    const stats = useMemo(() => {
        const gainers = allStocks.filter((s) => s.percentageChange > 0).length;
        const losers = allStocks.filter((s) => s.percentageChange < 0).length;
        const totalTurnover = allStocks.reduce((acc, s) => acc + (s.turnover || 0), 0);
        const totalVol = allStocks.reduce((acc, s) => acc + (s.sharevolume || 0), 0);
        return { gainers, losers, totalTurnover, totalVol };
    }, [allStocks]);

    

    // Filter & Sort
    const filteredStocks = useMemo(() => {
    const q = searchQuery.toLowerCase();

    let result = allStocks.filter((stock) => {
        const nameMatch =
        stock.name?.toLowerCase().includes(q) ||
        stock.symbol?.toLowerCase().includes(q);

        if (!nameMatch) return false;

        // sector filter
        if (selectedSector !== "all") {
        const stockSector = symbolToSector.get(String(stock.symbol).toUpperCase()) || "Unknown Sector";
        return stockSector === selectedSector;
        }

        return true;
    });

    result = [...result].sort((a, b) => {
        switch (sortOption) {
        case "price": return a.price - b.price;
        case "change": return b.percentageChange - a.percentageChange;
        case "high": return b.high - a.high;
        case "low": return a.low - b.low;
        case "volume": return b.sharevolume - a.sharevolume;
        case "turnover": return b.turnover - a.turnover;
        case "marketCap": return (b.marketCap || 0) - (a.marketCap || 0);
        default: return 0;
        }
    });

    return result;
    }, [allStocks, searchQuery, sortOption, selectedSector, symbolToSector]);

    return (
        <section
            className="w-full min-h-screen text-gray-100 font-sans"
            style={{
                background:
                    "linear-gradient(160deg, #060A14 0%, #090D1C 50%, #0D1428 100%)",
            }}
        >
            <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10 space-y-8">

                {/* ── Header ────────────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 rounded-full bg-linear-to-b from-[#DFBD69] to-[#926F34]" />
                            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#DFBD69]">
                                CSE Market Feed
                            </span>
                        </div>
                        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-[#DFBD69] to-white tracking-tight">
                            Sector Analysis
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Real-time sector performance & analytics — Colombo Stock Exchange
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3 items-center">
                        {/* Search */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-500 group-focus-within:text-[#DFBD69] transition-colors" />
                            </div>
                            <input
                                type="text"
                                className="block w-72 pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-sm placeholder-gray-600 focus:outline-none focus:border-[#DFBD69]/50 focus:ring-1 focus:ring-[#DFBD69]/30 transition-all backdrop-blur-sm"
                                placeholder="Search stocks or companies…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>



                        {/* Live dot */}
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[11px] font-semibold text-emerald-400">Live</span>
                        </div>
                    </div>
                </div>

                {/* ── Market Summary Strip ───────────────────────────────────── 
                {!tradesLoading && allStocks.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            {
                                label: "Listed Stocks",
                                value: allStocks.length,
                                sub: "active instruments",
                                color: "text-sky-400",
                                border: "border-sky-500/20",
                                bg: "bg-sky-500/5",
                                icon: (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                ),
                            },
                            {
                                label: "Gainers",
                                value: stats.gainers,
                                sub: `${((stats.gainers / (allStocks.length || 1)) * 100).toFixed(0)}% of market`,
                                color: "text-emerald-400",
                                border: "border-emerald-500/20",
                                bg: "bg-emerald-500/5",
                                icon: <ArrowUpRight className="w-4 h-4" />,
                            },
                            {
                                label: "Losers",
                                value: stats.losers,
                                sub: `${((stats.losers / (allStocks.length || 1)) * 100).toFixed(0)}% of market`,
                                color: "text-red-400",
                                border: "border-red-500/20",
                                bg: "bg-red-500/5",
                                icon: <ArrowDownRight className="w-4 h-4" />,
                            },
                            {
                                label: "Total Turnover",
                                value: formatCompact(stats.totalTurnover),
                                sub: `Vol: ${formatCompact(stats.totalVol)}`,
                                color: "text-[#DFBD69]",
                                border: "border-[#DFBD69]/20",
                                bg: "bg-[#DFBD69]/5",
                                icon: (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" />
                                    </svg>
                                ),
                            },
                        ].map((s, i) => (
                            <div
                                key={i}
                                className={`flex items-center gap-3 p-4 rounded-xl border ${s.border} ${s.bg} backdrop-blur-sm`}
                            >
                                <div className={`${s.color} opacity-70`}>{s.icon}</div>
                                <div>
                                    <p className="text-[9px] uppercase tracking-widest text-gray-600">{s.label}</p>
                                    <p className={`text-lg font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
                                    <p className="text-[9px] text-gray-600 mt-0.5">{s.sub}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )} */}

                {/* ── Sector Card Grid ──────────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
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
                    ? sectors.slice(0,20).map((sector: any, idx: number) => {
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
                            onClick={() => setSelectedSector((prev) => (prev === name ? "all" : name))}
                            active={selectedSector === name}
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


                {/* ── Results count ─────────────────────────────────────────── */}
                {!tradesLoading && filteredStocks.length > 0 && (
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-600">
                            Showing{" "}
                            <span className="text-gray-400 font-semibold">{filteredStocks.length}</span>{" "}
                            instruments
                            {searchQuery && (
                                <> for <span className="text-[#DFBD69]">{searchQuery}</span></>
                            )}
                        </p>
                        {/* Sort */}
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value)}
                            className="px-3 py-2 text-sm rounded-xl bg-black/40 border border-white/10 text-gray-300 focus:outline-none focus:border-[#DFBD69]/50 backdrop-blur-sm transition-colors cursor-pointer"
                        >
                            <option value="">Sort By</option>
                            <option value="price">Price ↑</option>
                            <option value="change">Change % ↓</option>
                            <option value="high">High ↓</option>
                            <option value="low">Low ↑</option>
                            <option value="volume">Volume ↓</option>
                            <option value="turnover">Turnover ↓</option>
                            <option value="marketCap">Market Cap ↓</option>
                        </select>
                    </div>
                )}

                {/* ── Stock Cards Grid ───────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">

                    {/* Loading skeletons */}
                    {tradesLoading && !tradeSummary && (
                        <>
                            {Array.from({ length: 9 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="relative flex flex-col gap-3 p-5 bg-[#080D1A] rounded-2xl border border-white/8 animate-pulse"
                                >
                                    <div className="h-3 w-16 bg-gray-800 rounded mt-6" />
                                    <div className="flex justify-between">
                                        <div className="h-5 w-20 bg-gray-800 rounded" />
                                        <div className="h-5 w-12 bg-gray-800 rounded" />
                                    </div>
                                    <div className="h-8 w-full bg-gray-900/60 rounded-xl" />
                                    <div className="h-2 w-full bg-gray-800/60 rounded-full mt-1" />
                                    <div className="h-px w-full bg-gray-800/40 mt-1" />
                                    <div className="flex justify-between">
                                        <div className="h-6 w-14 bg-gray-800 rounded" />
                                        <div className="h-6 w-14 bg-gray-800 rounded" />
                                        <div className="h-6 w-14 bg-gray-800 rounded" />
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Error */}
                    {tradesError && (
                        <div className="col-span-full py-20 flex flex-col items-center gap-3 text-red-400">
                            <svg className="w-10 h-10 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                            <p className="text-sm">Failed to load trade data: {tradesError}</p>
                        </div>
                    )}

                    {/* Cards */}
                    {filteredStocks.map((stock: any, idx: number) => (
                        <StockCard key={stock.id} stock={stock} index={idx} />
                    ))}

                    {/* Empty */}
                    {!tradesLoading && filteredStocks.length === 0 && !tradesError && (
                        <div className="col-span-full py-24 flex flex-col items-center gap-3 text-gray-600">
                            <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="text-sm">
                                {searchQuery
                                    ? `No stocks found matching "${searchQuery}"`
                                    : "No trade data available."}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
