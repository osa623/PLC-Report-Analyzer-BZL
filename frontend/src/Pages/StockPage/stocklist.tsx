/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";


import {
  useTradeSummary,
  useAllSectors,
  useTopGainers,
  useTopLosers,
  useAspiData,
  useSnpData,
} from "@/hooks/useCseApi";

import sectorData from "@/Data/Sectors.json";

type WatchlistMap = Record<string, boolean>;

export default function Value() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState<string>("All");
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchlistMap>({});

  // ─── Real CSE API data (auto-refresh) ─────────────────────────────
  const {
    data: tradeSummary,
    loading: tradesLoading,
    error: tradesError,
  } = useTradeSummary({ refetchInterval: 10_000 });

  const { data: sectors } = useAllSectors({ refetchInterval: 10_000 });

  // ─── Sector map from local JSON ───────────────────────────────────
  const symbolToSector = useMemo(() => {
    const map = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sectorData as any[]).forEach((s) => {
      if (s?.symbol && s?.sector)
        map.set(String(s.symbol).toUpperCase(), String(s.sector));
    });
    return map;
  }, []);

  const sectorOptions = useMemo(() => {
    // Prefer API sectors if available; fallback to local mapping list
    const apiSectors =
      sectors?.map((x: any) => String(x?.sector ?? "")).filter(Boolean) ?? [];

    const localSectors = Array.from(new Set(Array.from(symbolToSector.values())));

    const merged = Array.from(new Set([...apiSectors, ...localSectors])).sort((a, b) =>
      a.localeCompare(b)
    );

    return ["All", ...merged];
  }, [sectors, symbolToSector]);

  // ─── Stocks list with filters ─────────────────────────────────────
  const stocks = useMemo(() => {
    const items = tradeSummary?.reqTradeSummery ?? [];

    const q = searchQuery.trim().toLowerCase();
    const filtered = items.filter((s: any) => {
      const sym = String(s.symbol ?? "").toLowerCase();
      const nm = String(s.name ?? "").toLowerCase();

      const sector = symbolToSector.get(String(s.symbol).toUpperCase()) ?? "Unknown";

      const matchQuery = !q || sym.includes(q) || nm.includes(q);
      const matchSector = selectedSector === "All" || sector === selectedSector;
      const matchWatch = !onlyWatchlist || !!watchlist[String(s.symbol).toUpperCase()];

      return matchQuery && matchSector && matchWatch;
    });

    // A little “UX” sorting: keep more active items on top when no query
    if (!q) {
      return filtered.sort((a: any, b: any) => (Number(b.tradevolume) || 0) - (Number(a.tradevolume) || 0));
    }

    return filtered;
  }, [tradeSummary, searchQuery, selectedSector, onlyWatchlist, watchlist, symbolToSector]);

  // ─── Auto “last refreshed” indicator ──────────────────────────────
  const [lastTick, setLastTick] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setLastTick(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  const toggleWatch = (symbol: string) => {
    const key = symbol.toUpperCase();
    setWatchlist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const fmt = (n: any) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return "—";
    return num.toLocaleString();
  };

   //useRoutes Options
  const router = useRouter();

  const handleClick = (symbol: any , name : string) => {
  router.push(`/report_data/income/${symbol}/financials`);
  sessionStorage.setItem("CompanyName", name);
 
};

  const chipBase =
    "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-gray-200 font-encode";

  return (
    <section className="relative flex flex-col w-full min-h-[calc(100vh-64px)] px-4 py-8 sm:px-6 md:px-8 lg:px-10 bg-gradient-to-br from-[#0A0E1A] via-[#0D1425] to-[#182039]">
      <div className="relative w-full max-w-7xl mx-auto flex flex-col gap-6">
        {/* ───────────────────────────── HEADER ───────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <p className="text-xs sm:text-sm font-bold px-1 text-[#B28D41] uppercase tracking-widest font-encode">
                BUYZONLABS
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold font-encode bg-clip-text text-transparent bg-gradient-to-r from-[#DFBD69] to-[#ffffff] leading-tight">
                Stock Fundamentals
              </h1>
              <p className="mt-1 text-sm text-gray-300 max-w-xl">
                Explore valuations, momentum and sector insights. Star a stock to keep it on your watchlist.
              </p>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <span className={chipBase}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#B28D41]" />
                Live refresh: 10s
              </span>
              <span className={chipBase}>
                Last tick:{" "}
                <span className="text-[#E9D37E] font-semibold">
                  {lastTick.toLocaleTimeString()}
                </span>
              </span>
            </div>
          </div>

          {/* ───────────────────────── MARKET SNAPSHOT STRIP ───────────────────────── 
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-7 rounded-2xl border border-white/10 bg-[#0F1729]/70 shadow-[0_10px_40px_rgba(0,0,0,0.35)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-gray-400 font-encode">
                  Market Snapshot
                </p>

                <div className="flex items-center gap-2">
                  <span className="text-[0.65rem] uppercase tracking-widest text-gray-500 font-encode">
                    Adv / Dec
                  </span>
                  <span className="text-xs text-gray-200 font-mono">
                    {fmt(tradeSummary?.advances)} / {fmt(tradeSummary?.declines)}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[0.65rem] uppercase tracking-widest text-gray-500 font-encode">
                    ASPI
                  </p>
                  <p className="mt-1 text-lg font-semibold text-gray-100 font-mono">
                    {fmt(aspiData?.aspi)}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[0.65rem] uppercase tracking-widest text-gray-500 font-encode">
                    S&amp;P SL20
                  </p>
                  <p className="mt-1 text-lg font-semibold text-gray-100 font-mono">
                    {fmt(snpData?.snp)}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[0.65rem] uppercase tracking-widest text-gray-500 font-encode">
                    Turnover
                  </p>
                  <p className="mt-1 text-lg font-semibold text-gray-100 font-mono">
                    {fmt(tradeSummary?.turnover)}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[0.65rem] uppercase tracking-widest text-gray-500 font-encode">
                    Trades
                  </p>
                  <p className="mt-1 text-lg font-semibold text-gray-100 font-mono">
                    {fmt(tradeSummary?.trades)}
                  </p>
                </div>
              </div>
            </div>

            <div className="md:col-span-5 rounded-2xl border border-white/10 bg-[#0F1729]/70 shadow-[0_10px_40px_rgba(0,0,0,0.35)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-gray-400 font-encode">
                  Movers
                </p>
                <div className="h-[2px] w-20 bg-gradient-to-r from-[#B28D41] to-transparent" />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[0.65rem] uppercase tracking-widest text-gray-500 font-encode">
                    Top Gainer
                  </p>
                  <p className="mt-1 text-sm text-gray-200 font-mono">
                    {gainers?.[0]?.symbol ?? "—"}
                    <span className="text-[#E9D37E]"> +{fmt(gainers?.[0]?.change)}%</span>
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[0.65rem] uppercase tracking-widest text-gray-500 font-encode">
                    Top Loser
                  </p>
                  <p className="mt-1 text-sm text-gray-200 font-mono">
                    {losers?.[0]?.symbol ?? "—"}
                    <span className="text-[#B28D41]"> {fmt(losers?.[0]?.change)}%</span>
                  </p>
                </div>

                <div className="col-span-2 rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.03] to-white/[0.01] p-3">
                  <p className="text-[0.65rem] uppercase tracking-widest text-gray-500 font-encode">
                    Hint
                  </p>
                  <p className="mt-1 text-sm text-gray-300">
                    Click a card to open detailed valuation, ratios and intrinsic value breakdown.
                  </p>
                </div>
              </div>
            </div>
          </div> */}

          {/* ───────────────────────── TOOLBAR ───────────────────────── */}
          <div className="sticky top-2 z-10">
            <div className="rounded-2xl border border-white/10 bg-[#0F1729]/75 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.35)] p-3 sm:p-4">
              <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <div className="flex-1 flex items-center gap-2 sm:gap-3">
                  <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-800 bg-transparent px-3 py-2">
                    <svg
                      className="w-4 h-4 text-[#B28D41]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>

                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      type="text"
                      placeholder="Search symbol or company..."
                      className="w-full bg-transparent text-white font-encode text-sm outline-none placeholder:text-gray-500"
                    />
                  </div>

                  <button
                    onClick={() => setSearchQuery("")}
                    className="hidden sm:inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-200 hover:bg-white/[0.06] transition"
                    title="Clear"
                  >
                    Clear
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.65rem] uppercase tracking-widest text-gray-500 font-encode">
                      Sector
                    </span>

                    <select
                      value={selectedSector}
                      onChange={(e) => setSelectedSector(e.target.value)}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-100 outline-none"
                    >
                      {sectorOptions.map((s) => (
                        <option key={s} value={s} className="bg-[#0D1425]">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => setOnlyWatchlist((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                      onlyWatchlist
                        ? "border-[#B28D41]/60 bg-[#B28D41]/15 text-[#E9D37E]"
                        : "border-white/10 bg-white/[0.03] text-gray-200 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="text-xs uppercase tracking-widest font-encode">
                      Watchlist
                    </span>
                    <span className="font-mono text-xs">
                      {Object.values(watchlist).filter(Boolean).length}
                    </span>
                  </button>

                  <div className="hidden lg:flex items-center gap-2">
                    <span className={chipBase}>
                      Results{" "}
                      <span className="text-[#E9D37E] font-semibold font-mono">
                        {fmt(stocks.length)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {(tradesLoading || tradesError) && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                  {tradesLoading && (
                    <span className="text-gray-300">Loading live market data…</span>
                  )}
                  {tradesError && (
                    <span className="text-[#E9D37E]">
                      Couldn’t load data right now. Please try again.
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ───────────────────────── LIST AREA ───────────────────────── */}
        <div className="rounded-2xl border border-white/10 bg-[#121C33] shadow-[0_10px_40px_rgba(0,0,0,0.35)] overflow-hidden">
          {/* “Column header” as subtle guide (not a heavy table header) */}
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-white/10 bg-[#0F1729]/70">
            <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-widest font-encode">
              Symbol / Sector
            </div>
            <div className="col-span-4 text-xs font-semibold text-gray-400 uppercase tracking-widest font-encode">
              Company
            </div>
            <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-widest font-encode">
              Price
            </div>
            <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-widest font-encode">
              Valuation
            </div>
            <div className="col-span-1 text-xs font-semibold text-gray-400 uppercase tracking-widest font-encode">
              Growth
            </div>
            <div className="col-span-1 text-xs font-semibold text-[#B28D41] uppercase tracking-widest font-encode text-right">
              Star
            </div>
          </div>

          {/* Cards list */}
          <div className="max-h-[650px] overflow-y-auto hide-scrollbar">
            {!tradesLoading && !stocks.length && (
              <div className="p-10 text-center">
                <p className="text-lg text-gray-200 font-encode">No matches found</p>
                <p className="mt-2 text-sm text-gray-400">
                  Try a different keyword, change the sector filter, or disable Watchlist-only.
                </p>
              </div>
            )}

            {stocks.map((row: any, idx: number) => {
              const sym = String(row.symbol ?? "");
              const name = String(row.name ?? "");
              const sector = symbolToSector.get(sym.toUpperCase()) ?? "Unknown";
              const starred = !!watchlist[sym.toUpperCase()];

              return (
                  <div
                    key={`${sym}-${idx}`}
                    onClick={() => handleClick(sym , name)}
                    className="group relative cursor-pointer px-4 sm:px-5 py-4 border-b border-white/[0.05] hover:bg-white/[0.02] transition"
                  >
                  {/* subtle glow line */}
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#B28D41]/25 to-transparent opacity-0 group-hover:opacity-100 transition" />

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:items-center">
                    {/* Symbol + Sector badge */}
                    <div className="md:col-span-2 flex items-start gap-3">
                      <div className="flex">
                        <span className="text-sm font-mono text-gray-100 tracking-wide">
                          {sym}
                        </span>
                      </div>
                    </div>

                    {/* Company */}
                    <div className="md:col-span-4 flex flex-col items-start">
                        <span className="mt-1 inline-flex w-fit items-center py-0.5 text-[0.65rem] text-[#E9D37E] font-encode">
                          {sector}
                        </span>
                      <p className="text-sm text-gray-100">{row.name}</p>
                    </div>

                    {/* Price */}
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-200 font-mono">
                        {fmt(row.price)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 font-mono">
                        Vol: {fmt(row.tradevolume)}
                      </p>
                    </div>

                    {/* Valuation */}
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-500 uppercase tracking-widest font-encode">
                        DCF
                      </p>
                      <p className="mt-1 text-sm font-mono text-[#E9D37E]">
                        {fmt(row.high)}
                      </p>
                    </div>

                    {/* Growth */}
                    <div className="md:col-span-1">
                      <p className="text-xs text-gray-500 uppercase tracking-widest font-encode">
                        Growth
                      </p>
                      <p className="mt-1 text-sm font-mono text-gray-200">
                        {fmt(row.tradevolume)}%
                      </p>
                    </div>

                    {/* Watchlist */}
                    <div className="md:col-span-1 flex md:justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatch(sym);
                        }}
                        className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 transition ${
                          starred
                            ? "border-[#B28D41]/60 bg-[#B28D41]/15 text-[#E9D37E]"
                            : "border-white/10 bg-white/[0.03] text-gray-200 hover:bg-white/[0.06]"
                        }`}
                        title={starred ? "Remove from watchlist" : "Add to watchlist"}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill={starred ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* bottom micro actions (mobile-friendly) */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 md:hidden">
                    <span className={chipBase}>Price: <span className="font-mono text-[#E9D37E]">{fmt(row.price)}</span></span>
                    <span className={chipBase}>DCF: <span className="font-mono text-[#E9D37E]">{fmt(row.high)}</span></span>
                    <span className={chipBase}>Growth: <span className="font-mono text-[#E9D37E]">{fmt(row.tradevolume)}%</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer note */}
        <div className="text-xs text-gray-500 font-encode">
          Data auto-refreshes every 10 seconds. Sector labels come from your local sector map when missing from API.
        </div>
      </div>
    </section>
  );
}