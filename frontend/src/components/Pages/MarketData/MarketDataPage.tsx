"use client";

import { useState } from "react";

import {
  useTradeSummary,
  useTodaySharePrice,
  useTopGainers,
  useTopLosers,
  useMostActiveTrades,
  useMarketStatus,
  useMarketSummary,
  useAspiData,
  useSnpData,
  useAllSectors,
  useNewListingsAnnouncements,
  useBuyInBoardAnnouncements,
  useApprovedAnnouncements,
  useCovidAnnouncements,
  useFinancialAnnouncements,
  useCircularAnnouncements,
  useDirectiveAnnouncements,
  useNonComplianceAnnouncements,
  useDetailedTrades,
  useDailyMarketSummary,
} from "@/hooks/useCseApi";

// ─── Inline icons ───────────────────────────────────────────────────
const Icons = {
  TrendingUp: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
  ),
  TrendingDown: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg>
  ),
  ArrowUp: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg>
  ),
  ArrowDown: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m7 7 10 10" /><path d="M17 7v10H7" /></svg>
  ),
  Refresh: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
  ),
  Activity: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
  ),
  Globe: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
  ),
  BarChart: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>
  ),
  Bell: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
  ),
};

// ─── Number formatter ───────────────────────────────────────────────
function fmt(n: number | undefined | null, decimals = 2): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtVol(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

// ─── Reusable loading / error states ────────────────────────────────
function LoadingPulse({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse flex flex-col gap-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 bg-white/5 rounded-lg" />
      ))}
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 gap-3">
      <p className="text-red-400 text-sm text-center">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs px-4 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition">
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Tab navigation ─────────────────────────────────────────────────
type Tab = "overview" | "trades" | "sectors" | "announcements";

const tabs: { key: Tab; label: string }[] = [
  { key: "overview", label: "Market Overview" },
  { key: "trades", label: "Trades & Prices" },
  { key: "sectors", label: "Sectors" },
  { key: "announcements", label: "Announcements" },
];

// ─── Announcement category selector ────────────────────────────────
type AnnouncementCat = "newListings" | "buyInBoard" | "approved" | "covid" | "financial" | "circular" | "directive" | "nonCompliance";
const announcementCategories: { key: AnnouncementCat; label: string }[] = [
  { key: "newListings", label: "New Listings" },
  { key: "buyInBoard", label: "Buy-In Board" },
  { key: "approved", label: "Approved" },
  { key: "covid", label: "COVID" },
  { key: "financial", label: "Financial" },
  { key: "circular", label: "Circular" },
  { key: "directive", label: "Directive" },
  { key: "nonCompliance", label: "Non-Compliance" },
];

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function MarketDataPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [announcementCat, setAnnouncementCat] = useState<AnnouncementCat>("financial");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Data hooks (overview) ──────────────────────────────────────
  const marketStatus = useMarketStatus({ refetchInterval: 60_000 });
  const marketSummary = useMarketSummary({ refetchInterval: 30_000 });
  const aspi = useAspiData();
  const snp = useSnpData();
  const topGainers = useTopGainers({ refetchInterval: 30_000 });
  const topLosers = useTopLosers({ refetchInterval: 30_000 });
  const mostActive = useMostActiveTrades({ refetchInterval: 30_000 });

  // ── Data hooks (trades) ────────────────────────────────────────
  const tradeSummary = useTradeSummary({ refetchInterval: 30_000, enabled: activeTab === "trades" || activeTab === "overview" });
  const todayPrice = useTodaySharePrice({ enabled: activeTab === "trades" });
  const detailedTrades = useDetailedTrades({ enabled: activeTab === "trades" });
  const dailyMarket = useDailyMarketSummary({ enabled: activeTab === "trades" });

  // ── Data hooks (sectors) ───────────────────────────────────────
  const allSectors = useAllSectors({ enabled: activeTab === "sectors" });

  // ── Data hooks (announcements) ─────────────────────────────────
  const newListings = useNewListingsAnnouncements({ enabled: activeTab === "announcements" && announcementCat === "newListings" });
  const buyInBoard = useBuyInBoardAnnouncements({ enabled: activeTab === "announcements" && announcementCat === "buyInBoard" });
  const approved = useApprovedAnnouncements({ enabled: activeTab === "announcements" && announcementCat === "approved" });
  const covid = useCovidAnnouncements({ enabled: activeTab === "announcements" && announcementCat === "covid" });
  const financial = useFinancialAnnouncements({ enabled: activeTab === "announcements" && announcementCat === "financial" });
  const circular = useCircularAnnouncements({ enabled: activeTab === "announcements" && announcementCat === "circular" });
  const directive = useDirectiveAnnouncements({ enabled: activeTab === "announcements" && announcementCat === "directive" });
  const nonCompliance = useNonComplianceAnnouncements({ enabled: activeTab === "announcements" && announcementCat === "nonCompliance" });

  // Collect the currently selected announcement data
  const announcementMap = {
    newListings, buyInBoard, approved, covid, financial, circular, directive, nonCompliance,
  } as const;
  const currentAnnouncementHook = announcementMap[announcementCat];

  // ── Filter trades by search query ──────────────────────────────
  const filteredTrades = (tradeSummary.data?.reqTradeSummery ?? []).filter(
    (t) =>
      !searchQuery ||
      t.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section className="relative min-h-screen w-full bg-gradient-to-br from-[#0A0E1A] via-[#0D1425] to-[#182039] text-white">
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ─── HEADER ──────────────────────────────────────────── */}
      <div className="w-full px-4 sm:px-6 md:px-10 pt-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-[#B28D41] uppercase tracking-widest mb-1 font-encode">
              Colombo Stock Exchange
            </h2>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#c7cbd0] tracking-tight leading-tight">
              Live Market Data
            </h1>
          </div>

          {/* Market status badge */}
          <div className="flex items-center gap-3">
            {marketStatus.data && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-[#0F1729]">
                <span className={`w-2 h-2 rounded-full animate-pulse ${
                  marketStatus.data?.status?.toLowerCase().includes("trading")
                    ? "bg-green-400"
                    : "bg-red-400"
                }`} />
                <span className="text-xs font-encode text-gray-300">
                  Market: {marketStatus.data?.status ?? "—"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ─── TAB BAR ─────────────────────────────────────────── */}
        <div className="mt-6 flex gap-1 overflow-x-auto hide-scrollbar border-b border-white/10 pb-px">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-encode font-semibold uppercase tracking-wider whitespace-nowrap rounded-t-lg transition-all ${
                activeTab === t.key
                  ? "bg-[#B28D41]/15 text-[#E9D37E] border-b-2 border-[#B28D41]"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── TAB CONTENT ─────────────────────────────────────── */}
      <div className="px-4 sm:px-6 md:px-10 pb-16">

        {/* ================== OVERVIEW TAB ================== */}
        {activeTab === "overview" && (
          <div className="flex flex-col gap-6 mt-4">

            {/* Row 1 — Market summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {/* ASPI */}
              <SummaryCard
                label="ASPI"
                value={fmt(aspi.data?.value)}
                change={aspi.data?.percentage}
                loading={aspi.loading}
              />
              {/* S&P SL20 */}
              <SummaryCard
                label="S&P SL20"
                value={fmt(snp.data?.value)}
                change={snp.data?.percentage}
                loading={snp.loading}
              />
              {/* Total Volume */}
              <SummaryCard
                label="Share Volume"
                value={fmtVol(marketSummary.data?.shareVolume)}
                loading={marketSummary.loading}
                icon={<Icons.BarChart className="w-4 h-4 text-[#B28D41]" />}
              />
              {/* Trades */}
              <SummaryCard
                label="Total Trades"
                value={fmtVol(marketSummary.data?.trades)}
                loading={marketSummary.loading}
                icon={<Icons.Activity className="w-4 h-4 text-[#B28D41]" />}
              />
            </div>

            {/* Row 2 — Gainers / Losers / Most Active */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Top Gainers */}
              <MarketMoversCard
                title="Top Gainers"
                icon={<Icons.TrendingUp className="w-4 h-4 text-green-400" />}
                iconBg="bg-green-500/10"
                hoverBg="hover:bg-green-500/5"
                items={(topGainers.data ?? []).map((g) => ({
                  symbol: g.symbol,
                  price: g.price,
                  change: g.changePercentage,
                }))}
                loading={topGainers.loading}
                error={topGainers.error}
                onRetry={topGainers.refetch}
                positive
              />
              {/* Top Losers */}
              <MarketMoversCard
                title="Top Losers"
                icon={<Icons.TrendingDown className="w-4 h-4 text-red-400" />}
                iconBg="bg-red-500/10"
                hoverBg="hover:bg-red-500/5"
                items={(topLosers.data ?? []).map((l) => ({
                  symbol: l.symbol,
                  price: l.price,
                  change: l.changePercentage,
                }))}
                loading={topLosers.loading}
                error={topLosers.error}
                onRetry={topLosers.refetch}
                positive={false}
              />
              {/* Most Active */}
              <MarketMoversCard
                title="Most Active"
                icon={<Icons.Activity className="w-4 h-4 text-[#B28D41]" />}
                iconBg="bg-[#B28D41]/10"
                hoverBg="hover:bg-[#B28D41]/5"
                items={(mostActive.data ?? []).map((a) => ({
                  symbol: a.symbol,
                  price: a.turnover,
                  change: a.percentageShareVolume,
                  volume: a.shareVolume,
                }))}
                loading={mostActive.loading}
                error={mostActive.error}
                onRetry={mostActive.refetch}
                showVolume
              />
            </div>

            {/* Row 3 — ASPI / S&P SL20 current index */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <IndexCard title="ASPI" data={aspi.data} loading={aspi.loading} error={aspi.error} onRetry={aspi.refetch} />
              <IndexCard title="S&P SL20" data={snp.data} loading={snp.loading} error={snp.error} onRetry={snp.refetch} />
            </div>
          </div>
        )}

        {/* ================== TRADES TAB ================== */}
        {activeTab === "trades" && (
          <div className="flex flex-col gap-6 mt-4">

            {/* Search */}
            <div className="flex items-center gap-2 bg-[#0F1729] rounded-xl border border-white/10 px-4 py-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by symbol or company name…"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none font-encode"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-gray-500 hover:text-gray-300 text-xs">Clear</button>
              )}
            </div>

            {/* Trade Summary Table */}
            <div className="bg-gradient-to-br from-[#0F1729] to-[#0a1120] rounded-xl border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5">
                <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wide font-encode">
                  Trade Summary
                  {filteredTrades.length > 0 && <span className="ml-2 text-gray-500 font-normal">({filteredTrades.length})</span>}
                </h3>
                <button onClick={tradeSummary.refetch} className="p-1.5 rounded-lg hover:bg-white/5 transition" title="Refresh">
                  <Icons.Refresh className={`w-4 h-4 text-gray-400 ${tradeSummary.loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {tradeSummary.loading && <LoadingPulse rows={8} />}
              {tradeSummary.error && <ErrorBox message={tradeSummary.error} onRetry={tradeSummary.refetch} />}

              {!tradeSummary.loading && !tradeSummary.error && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-encode">
                        <th className="text-left px-4 py-3">Symbol</th>
                        <th className="text-left px-4 py-3">Name</th>
                        <th className="text-right px-4 py-3">Price (Rs.)</th>
                        <th className="text-right px-4 py-3">Change</th>
                        <th className="text-right px-4 py-3">%</th>
                        <th className="text-right px-4 py-3">High</th>
                        <th className="text-right px-4 py-3">Low</th>
                        <th className="text-right px-4 py-3">Volume</th>
                        <th className="text-right px-4 py-3">Turnover</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTrades.map((t) => (
                        <tr key={t.id ?? t.symbol} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                          <td className="px-4 py-2.5 font-bold text-gray-200">{t.symbol}</td>
                          <td className="px-4 py-2.5 text-gray-400 truncate max-w-[200px]">{t.name}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-200">{fmt(t.price)}</td>
                          <td className={`px-4 py-2.5 text-right font-mono ${t.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {t.change > 0 ? "+" : ""}{fmt(t.change)}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-mono ${t.percentageChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {t.percentageChange > 0 ? "+" : ""}{fmt(t.percentageChange)}%
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-300">{fmt(t.high)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-300">{fmt(t.low)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-300">{fmtVol(t.sharevolume)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-300">{fmtVol(t.turnover)}</td>
                        </tr>
                      ))}
                      {filteredTrades.length === 0 && (
                        <tr><td colSpan={9} className="text-center py-8 text-gray-500">No trades found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Today Share Price */}
            <div className="bg-gradient-to-br from-[#0F1729] to-[#0a1120] rounded-xl border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5">
                <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wide font-encode">Today&apos;s Share Prices</h3>
                <button onClick={todayPrice.refetch} className="p-1.5 rounded-lg hover:bg-white/5 transition" title="Refresh">
                  <Icons.Refresh className={`w-4 h-4 text-gray-400 ${todayPrice.loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {todayPrice.loading && <LoadingPulse rows={6} />}
              {todayPrice.error && <ErrorBox message={todayPrice.error} onRetry={todayPrice.refetch} />}

              {!todayPrice.loading && !todayPrice.error && (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto hide-scrollbar">
                  <table className="w-full min-w-[700px] text-xs sm:text-sm">
                    <thead className="sticky top-0 bg-[#0F1729]">
                      <tr className="border-b border-white/5 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-encode">
                        <th className="text-left px-4 py-3">Symbol</th>
                        <th className="text-left px-4 py-3">Company</th>
                        <th className="text-right px-4 py-3">Price</th>
                        <th className="text-right px-4 py-3">Change %</th>
                        <th className="text-right px-4 py-3">Volume</th>
                        <th className="text-right px-4 py-3">Trades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(todayPrice.data ?? []).map((s) => (
                        <tr key={s.id ?? s.symbol} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                          <td className="px-4 py-2.5 font-bold text-gray-200">{s.symbol}</td>
                          <td className="px-4 py-2.5 text-gray-400 truncate max-w-[200px]">—</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-200">{fmt(s.lastTradedPrice)}</td>
                          <td className={`px-4 py-2.5 text-right font-mono ${s.changePercentage >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {s.changePercentage > 0 ? "+" : ""}{fmt(s.changePercentage)}%
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-300">{fmtVol(s.crossingVolume)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-300">{s.quantity?.toLocaleString() ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Detailed Trades */}
            <div className="bg-gradient-to-br from-[#0F1729] to-[#0a1120] rounded-xl border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5">
                <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wide font-encode">Detailed Trades</h3>
                <button onClick={detailedTrades.refetch} className="p-1.5 rounded-lg hover:bg-white/5 transition" title="Refresh">
                  <Icons.Refresh className={`w-4 h-4 text-gray-400 ${detailedTrades.loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {detailedTrades.loading && <LoadingPulse rows={6} />}
              {detailedTrades.error && <ErrorBox message={detailedTrades.error} onRetry={detailedTrades.refetch} />}

              {!detailedTrades.loading && !detailedTrades.error && (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto hide-scrollbar">
                  <table className="w-full min-w-[800px] text-xs sm:text-sm">
                    <thead className="sticky top-0 bg-[#0F1729]">
                      <tr className="border-b border-white/5 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-encode">
                        <th className="text-left px-4 py-3">Symbol</th>
                        <th className="text-left px-4 py-3">Name</th>
                        <th className="text-right px-4 py-3">Price</th>
                        <th className="text-right px-4 py-3">Change</th>
                        <th className="text-right px-4 py-3">Qty</th>
                        <th className="text-right px-4 py-3">Trades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailedTrades.data?.reqDetailTrades ?? []).map((t) => (
                        <tr key={t.id ?? t.symbol} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                          <td className="px-4 py-2.5 font-bold text-gray-200">{t.symbol}</td>
                          <td className="px-4 py-2.5 text-gray-400 truncate max-w-[180px]">{t.name}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-200">{fmt(t.price)}</td>
                          <td className={`px-4 py-2.5 text-right font-mono ${t.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {t.change > 0 ? "+" : ""}{fmt(t.change)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-300">{fmtVol(t.qty)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-300">{fmtVol(t.trades)}</td>
                        </tr>
                      ))}
                      {(detailedTrades.data?.reqDetailTrades ?? []).length === 0 && (
                        <tr><td colSpan={6} className="text-center py-8 text-gray-500">No detailed trades available.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Daily Market Summary */}
            <div className="bg-gradient-to-br from-[#0F1729] to-[#0a1120] rounded-xl border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5">
                <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wide font-encode">Daily Market Summary</h3>
                <button onClick={dailyMarket.refetch} className="p-1.5 rounded-lg hover:bg-white/5 transition" title="Refresh">
                  <Icons.Refresh className={`w-4 h-4 text-gray-400 ${dailyMarket.loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {dailyMarket.loading && <LoadingPulse rows={4} />}
              {dailyMarket.error && <ErrorBox message={dailyMarket.error} onRetry={dailyMarket.refetch} />}

              {!dailyMarket.loading && !dailyMarket.error && (
                <div className="overflow-x-auto max-h-[350px] overflow-y-auto hide-scrollbar">
                  <table className="w-full min-w-[700px] text-xs sm:text-sm">
                    <thead className="sticky top-0 bg-[#0F1729]">
                      <tr className="border-b border-white/5 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-encode">
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-right px-4 py-3">Turnover</th>
                        <th className="text-right px-4 py-3">Trades</th>
                        <th className="text-right px-4 py-3">Equity Turnover</th>
                        <th className="text-right px-4 py-3">Dom. Purchase</th>
                        <th className="text-right px-4 py-3">Dom. Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dailyMarket.data?.flat() ?? []).map((d, i) => (
                        <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                          <td className="px-4 py-2.5 text-gray-400 font-mono">{d.tradeDate ? new Date(d.tradeDate).toLocaleDateString() : "—"}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-200">{fmtVol(d.marketTurnover)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-300">{d.marketTrades?.toLocaleString() ?? "—"}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-300">{fmtVol(d.equityTurnover)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-300">{fmtVol(d.equityDomesticPurchase)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-300">{fmtVol(d.equityDomesticSales)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================== SECTORS TAB ================== */}
        {activeTab === "sectors" && (
          <div className="mt-4">
            <div className="bg-gradient-to-br from-[#0F1729] to-[#0a1120] rounded-xl border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Icons.Globe className="w-4 h-4 text-[#B28D41]" />
                  <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wide font-encode">All Sectors</h3>
                </div>
                <button onClick={allSectors.refetch} className="p-1.5 rounded-lg hover:bg-white/5 transition" title="Refresh">
                  <Icons.Refresh className={`w-4 h-4 text-gray-400 ${allSectors.loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {allSectors.loading && <LoadingPulse rows={10} />}
              {allSectors.error && <ErrorBox message={allSectors.error} onRetry={allSectors.refetch} />}

              {!allSectors.loading && !allSectors.error && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                  {(allSectors.data ?? []).map((sector) => (
                    <div
                      key={sector.id ?? sector.name}
                      className="bg-[#121C33] rounded-xl p-4 border border-white/5 hover:border-white/10 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-200 group-hover:text-[#E9D37E] transition font-encode leading-tight pr-2">
                          {sector.name}
                        </h4>
                        <span className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sector.percentage >= 0
                            ? "bg-green-900/40 text-green-400"
                            : "bg-red-900/40 text-red-400"
                        }`}>
                          {sector.percentage >= 0 ? <Icons.ArrowUp className="w-2.5 h-2.5" /> : <Icons.ArrowDown className="w-2.5 h-2.5" />}
                          {fmt(Math.abs(sector.percentage))}%
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-xs">
                        <div>
                          <span className="text-gray-500 block">Volume</span>
                          <span className="text-gray-300 font-mono">{fmtVol(sector.sectorVolumeToday)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Turnover</span>
                          <span className="text-gray-300 font-mono">{fmtVol(sector.sectorTurnoverToday)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Trades</span>
                          <span className="text-gray-300 font-mono">{sector.sectorTradeToday?.toLocaleString() ?? "—"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(allSectors.data ?? []).length === 0 && (
                    <p className="col-span-full text-center py-8 text-gray-500">No sector data available.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================== ANNOUNCEMENTS TAB ================== */}
        {activeTab === "announcements" && (
          <div className="flex flex-col gap-4 mt-4">

            {/* Category pills */}
            <div className="flex flex-wrap gap-2">
              {announcementCategories.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setAnnouncementCat(c.key)}
                  className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-encode font-semibold tracking-wide transition-all ${
                    announcementCat === c.key
                      ? "bg-[#B28D41]/20 text-[#E9D37E] border border-[#B28D41]/40"
                      : "bg-white/5 text-gray-400 border border-white/10 hover:text-gray-200 hover:bg-white/10"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Announcement list */}
            <div className="bg-gradient-to-br from-[#0F1729] to-[#0a1120] rounded-xl border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Icons.Bell className="w-4 h-4 text-[#B28D41]" />
                  <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wide font-encode">
                    {announcementCategories.find((c) => c.key === announcementCat)?.label} Announcements
                  </h3>
                </div>
                <button onClick={currentAnnouncementHook.refetch} className="p-1.5 rounded-lg hover:bg-white/5 transition" title="Refresh">
                  <Icons.Refresh className={`w-4 h-4 text-gray-400 ${currentAnnouncementHook.loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {currentAnnouncementHook.loading && <LoadingPulse rows={6} />}
              {currentAnnouncementHook.error && <ErrorBox message={currentAnnouncementHook.error} onRetry={currentAnnouncementHook.refetch} />}

              {!currentAnnouncementHook.loading && !currentAnnouncementHook.error && (
                <div className="max-h-[600px] overflow-y-auto hide-scrollbar divide-y divide-white/[0.03]">
                  {getAnnouncementItems(currentAnnouncementHook.data).length > 0 ? (
                    getAnnouncementItems(currentAnnouncementHook.data).map((ann, i) => (
                      <div key={ann.id ?? i} className="px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-200 font-medium leading-relaxed">{ann.title}</p>
                            {ann.description && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ann.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              {ann.symbol && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-[#B28D41]/10 text-[#E9D37E] font-bold font-encode">
                                  {ann.symbol}
                                </span>
                              )}
                              {ann.company && (
                                <span className="text-[10px] text-gray-500">{ann.company}</span>
                              )}
                            </div>
                          </div>
                          {ann.date && (
                            <span className="shrink-0 text-[10px] text-gray-500 font-mono">{ann.date}</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-12 text-gray-500">No announcements available.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function SummaryCard({
  label,
  value,
  change,
  loading,
  icon,
}: {
  label: string;
  value: string;
  change?: number | null;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="animate-pulse bg-gradient-to-br from-[#0F1729] to-[#1a2642] rounded-xl border border-white/10 p-4">
        <div className="h-3 w-16 bg-white/5 rounded mb-3" />
        <div className="h-6 w-24 bg-white/5 rounded" />
      </div>
    );
  }
  return (
    <div className="bg-gradient-to-br from-[#0F1729] to-[#1a2642] rounded-xl border border-white/10 p-4 hover:border-white/20 transition-all">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-encode">{label}</span>
      </div>
      <span className="text-lg sm:text-xl md:text-2xl font-bold text-white font-mono">{value}</span>
      {change != null && (
        <div className="flex items-center gap-1 mt-1">
          {change >= 0 ? (
            <Icons.ArrowUp className="w-3 h-3 text-green-400" />
          ) : (
            <Icons.ArrowDown className="w-3 h-3 text-red-400" />
          )}
          <span className={`text-xs font-semibold ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
            {change > 0 ? "+" : ""}{fmt(change)}%
          </span>
        </div>
      )}
    </div>
  );
}

function MarketMoversCard({
  title,
  icon,
  iconBg,
  hoverBg,
  items,
  loading,
  error,
  onRetry,
  positive,
  showVolume,
}: {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  hoverBg: string;
  items: { symbol: string; name?: string; price: number; change: number; volume?: number }[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  positive?: boolean;
  showVolume?: boolean;
}) {
  const changeColor = positive === true ? "text-green-400" : positive === false ? "text-red-400" : "text-gray-300";

  return (
    <div className="bg-gradient-to-br from-[#0F1729] to-[#0a1120] rounded-xl border border-white/5 overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <div className={`p-1.5 rounded-lg ${iconBg}`}>{icon}</div>
        <h3 className="text-xs sm:text-sm font-bold text-gray-100 uppercase tracking-wide font-encode">{title}</h3>
      </div>

      {loading && <LoadingPulse rows={6} />}
      {error && <ErrorBox message={error} onRetry={onRetry} />}

      {!loading && !error && (
        <div className="flex-1 max-h-[400px] overflow-y-auto hide-scrollbar">
          {items.slice(0, 15).map((item) => (
            <div
              key={item.symbol}
              className={`flex items-center justify-between px-4 py-2.5 ${hoverBg} transition-all border-b border-white/[0.03] last:border-0 group`}
            >
              <div className="flex flex-col">
                <span className={`text-xs sm:text-sm font-bold text-gray-200 group-hover:${changeColor} transition-colors`}>
                  {item.symbol}
                </span>
                <span className="text-[8px] sm:text-[9px] text-gray-500 truncate max-w-[120px]">{item.name ?? ""}</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] sm:text-xs font-mono text-gray-300">Rs. {fmt(item.price)}</span>
                <div className="flex items-center gap-1">
                  {item.change >= 0 ? (
                    <Icons.ArrowUp className="w-2.5 h-2.5 text-green-400" />
                  ) : (
                    <Icons.ArrowDown className="w-2.5 h-2.5 text-red-400" />
                  )}
                  <span className={`text-[10px] font-bold ${item.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {item.change > 0 ? "+" : ""}{fmt(item.change)}%
                  </span>
                </div>
                {showVolume && item.volume != null && (
                  <span className="text-[8px] text-gray-500 font-mono">Vol: {fmtVol(item.volume)}</span>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-center py-8 text-gray-500 text-xs">No data available.</p>
          )}
        </div>
      )}
    </div>
  );
}

function IndexCard({
  title,
  data,
  loading,
  error,
  onRetry,
}: {
  title: string;
  data: { value: number; lowValue: number; highValue: number; change: number; percentage: number } | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="bg-gradient-to-br from-[#0F1729] to-[#0a1120] rounded-xl border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5">
        <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wide font-encode">{title}</h3>
      </div>

      {loading && <LoadingPulse rows={2} />}
      {error && <ErrorBox message={error} onRetry={onRetry} />}

      {!loading && !error && data && (
        <div className="p-4 sm:p-6">
          <div className="flex items-end gap-3 mb-4">
            <span className="text-2xl sm:text-3xl font-bold text-white font-mono">{fmt(data.value)}</span>
            <div className="flex items-center gap-1 pb-1">
              {data.change >= 0 ? (
                <Icons.ArrowUp className="w-4 h-4 text-green-400" />
              ) : (
                <Icons.ArrowDown className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-sm font-bold ${data.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                {data.change > 0 ? "+" : ""}{fmt(data.change)} ({data.percentage > 0 ? "+" : ""}{fmt(data.percentage)}%)
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-encode block mb-1">Day Low</span>
              <span className="text-sm text-gray-300 font-mono">{fmt(data.lowValue)}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-encode block mb-1">Day High</span>
              <span className="text-sm text-gray-300 font-mono">{fmt(data.highValue)}</span>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && !data && (
        <p className="text-center py-8 text-gray-500 text-xs">No data available.</p>
      )}
    </div>
  );
}

// ─── Helper to extract announcement arrays from varying response shapes ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAnnouncementItems(data: any): { id?: number; title: string; description?: string; date?: string; symbol?: string; company?: string }[] {
  if (!data) return [];
  // If data itself is an array (plain array response)
  if (Array.isArray(data)) return data;
  // Fallback: check for a nested array key
  const keys = Object.keys(data);
  for (const key of keys) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}
