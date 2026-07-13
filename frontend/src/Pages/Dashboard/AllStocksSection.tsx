"use client";

import { useState, useMemo } from "react";

import {
  useMarketSummary,
  useTradeSummary,
  useTopGainers,
  useTopLosers,
  useAspiData,
  useSnpData,
} from "@/hooks/useCseApi";

// --- Inline Icons (No Dependencies) ---
const Icons = {
  TrendingUp: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
  ),
  TrendingDown: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
  ),
  ArrowUp: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
  ),
  ArrowDown: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m7 7 10 10"/><path d="M17 7v10H7"/></svg>
  ),
};

// --- Helpers ---

/** Format large numbers compactly (e.g. 1,234,567 → 1.23M) */
function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2) + "B";
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(2) + "K";
  return value.toFixed(2);
}

function formatPrice(value: number): string {
  return value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Define shared column widths to ensure Header and Body align perfectly
const colWidths = {
  stock: "w-[24%]",
  price: "w-[16%]",
  high: "w-[12%]",
  low: "w-[12%]",
  volume: "w-[12%]",
  turnover: "w-[12%]",
  marketCap: "w-[12%]",
};

export default function AllStocksSection() {
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Real CSE API data (auto-refresh every 30s) ─────────────────
  const { data: tradeSummary, loading: tradesLoading, error: tradesError } = useTradeSummary({ refetchInterval: 30_000 });
  const { data: gainers, loading: gainersLoading } = useTopGainers({ refetchInterval: 10_000 });
  const { data: losers, loading: losersLoading } = useTopLosers({ refetchInterval: 10_000 });
  const { data: aspiData, loading: aspiLoading } = useAspiData({ refetchInterval: 10_000 });
  const { data: snpData, loading: snpLoading } = useSnpData({ refetchInterval: 10_000 });
  const { data: marcketData, loading: mercketLoading} = useMarketSummary({refetchInterval: 10_1000});

  // ─── Filtered stocks list ───────────────────────────────────────
  const stocks = useMemo(() => {
    const items = tradeSummary?.reqTradeSummery ?? [];
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [tradeSummary, searchQuery]);

  // ─── Skeleton components ────────────────────────────────────────
  const SkeletonRow = ({ i }: { i: number }) => (
    <div key={i} className="flex w-full items-center bg-[#121C33] rounded-lg px-2 sm:px-4 py-3 sm:py-4 animate-pulse gap-2">
      <div className={colWidths.stock}><div className="h-4 w-20 bg-gray-700 rounded" /><div className="h-3 w-28 bg-gray-800 rounded mt-1" /></div>
      <div className={colWidths.price}><div className="h-4 w-16 bg-gray-700 rounded" /></div>
      <div className={colWidths.high}><div className="h-4 w-12 bg-gray-700 rounded" /></div>
      <div className={colWidths.low}><div className="h-4 w-12 bg-gray-700 rounded" /></div>
      <div className={colWidths.volume}><div className="h-4 w-14 bg-gray-700 rounded" /></div>
      <div className={colWidths.turnover}><div className="h-4 w-14 bg-gray-700 rounded" /></div>
      <div className={colWidths.marketCap}><div className="h-4 w-14 bg-gray-700 rounded" /></div>
    </div>
  );

  const GainerLoserSkeleton = ({ i }: { i: number }) => (
    <div key={i} className="flex items-center justify-between px-3 py-3 animate-pulse border-b border-white/[0.03]">
      <div className="flex flex-col gap-1"><div className="h-3 w-14 bg-gray-700 rounded" /><div className="h-2 w-20 bg-gray-800 rounded" /></div>
      <div className="flex flex-col items-end gap-1"><div className="h-3 w-16 bg-gray-700 rounded" /><div className="h-2 w-10 bg-gray-800 rounded" /></div>
    </div>
  );

  return (
    <section className="relative flex flex-col lg:flex-row w-full p-4 sm:p-6 md:p-8 lg:p-10 min-h-screen bg-gradient-to-br from-[#0A0E1A] via-[#0D1425] to-[#182039]">
      
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* LEFT PANEL - Main Stocks Table (65%) */}
      <div className="relative min-h-screen h-auto w-full lg:w-[65%] border-r overflow-hidden border-white/5">
        <div className="h-full w-full flex flex-col">
          
          {/* UPPER SECTION */}
          <div className="relative px-1 py-1">
            <div className="w-full relative flex flex-col bg-[#090C1A] min-h-[140px] sm:h-[10vh] md:h-[20vh] lg:h-[20vh]">
              
          <div>
            {/* Label */}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-4 bg-linear-to-b froky-400 to-amber-500 rounded-fullm-s" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B28D41] ">
                Market Intelligence
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Stocks Overview
            </h2>
           
          </div>

              {/* Search Bar Section */}
              <div className="flex w-full h-[60px] sm:h-[8vh] py-2 left-0 overflow-hidden">
                <div className='relative w-full h-10 sm:h-12 bg-transparent border-t-2 border-gray-800 overflow-hidden top-0 flex items-center px-2 sm:px-4 gap-2'>
                  <input
                    type="text"
                    placeholder="Search stocks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 h-full bg-transparent text-white font-encode text-sm sm:text-[15px] font-thin outline-none placeholder:text-gray-500"
                  />
                    <button
                    type="button"
                    className="flex items-center cursor-pointer font-encode font-medium bg-gradient-to-r from-[#B28D41] to-[#E9D37E] text-[#0D1325] rounded-full shadow-md hover:shadow-lg hover:shadow-[#B28D41]/30 transition-all duration-200 hover:scale-105 gap-2 px-5 py-2 focus:outline-none focus:ring-2 focus:ring-[#B28D41] focus:ring-offset-2"
                    >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="hidden md:text-sm font-inter sm:inline">Search Stocks</span>
                    <span className="sm:hidden">Search</span>
                    </button>
                </div>
              </div>

            </div>
          </div>

          {/* TABLE SECTION */}
          <div className="px-1 sm:px-2 w-full mx-auto mt-2 sm:mt-4">
            
            {/* TABLE HEADER */}
            <div className="overflow-x-auto">
              <div className="relative flex w-full min-w-[700px] sm:min-w-0 border-b border-gray-800/60 px-2 sm:px-4 py-2 sm:py-3 mb-2 items-center">
                <div className={`${colWidths.stock} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Stock</div>
                <div className={`${colWidths.price} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Price</div>
                <div className={`${colWidths.high} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>High</div>
                <div className={`${colWidths.low} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Low</div>
                <div className={`${colWidths.volume} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Volume</div>
                <div className={`${colWidths.turnover} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Turnover</div>
                <div className={`${colWidths.marketCap} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Mkt Cap</div>
              </div>
            </div>

            {/* SCROLLABLE TABLE BODY */}
            <div className="overflow-x-auto mb-12">
              <div className="sm:h-[400px] md:h-[1000px] overflow-y-auto hide-scrollbar flex flex-col gap-1 sm:gap-2 mt-2 min-w-[700px] sm:min-w-0">
                
                {/* Error state */}
                {tradesError && (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-red-400 text-sm">Failed to load trades: {tradesError}</p>
                  </div>
                )}

                {/* Loading skeleton */}
                {tradesLoading && !tradeSummary && (
                  <>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} i={i} />)}</>
                )}

                {/* Empty state */}
                {!tradesLoading && stocks.length === 0 && !tradesError && (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-gray-500 text-sm">
                      {searchQuery ? "No stocks match your search." : "No trade data available."}
                    </p>
                  </div>
                )}

                {/* Live data rows */}
                {stocks.map((stock) => (
                  <div
                    key={stock.id}
                    className="flex w-full items-center bg-[#121C33] rounded-lg px-2 sm:px-4 py-2 sm:py-3 hover:bg-gray-800/70 text-[10px] sm:text-xs transition border border-transparent hover:border-gray-600"
                  >
                    {/* Stock Symbol / Name */}
                    <div className={`${colWidths.stock} flex flex-col font-encode text-gray-200`}>
                      <span className="text-xs sm:text-sm font-bold">{stock.symbol}</span>
                      <span className="text-[0.6rem] sm:text-[0.65rem] text-gray-400 font-thin truncate pr-1 sm:pr-2">{stock.name}</span>
                    </div>

                    {/* Price + Change% */}
                    <div className={`${colWidths.price} text-gray-200 font-mono`}>
                      <div className="flex flex-col">
                        <span className="text-[10px] sm:text-xs">{formatPrice(stock.price)}</span>
                        <span className={`text-[8px] sm:text-[10px] ${stock.percentageChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stock.percentageChange > 0 ? '+' : ''}{stock.percentageChange.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {/* High */}
                    <div className={`${colWidths.high} text-gray-300 text-[10px] sm:text-xs font-mono`}>
                      {formatPrice(stock.high)}
                    </div>

                    {/* Low */}
                    <div className={`${colWidths.low} text-gray-300 text-[10px] sm:text-xs font-mono`}>
                      {formatPrice(stock.low)}
                    </div>

                    {/* Volume */}
                    <div className={`${colWidths.volume} text-gray-300 text-[10px] sm:text-xs font-mono`}>
                      {formatCompact(stock.sharevolume)}
                    </div>

                    {/* Turnover */}
                    <div className={`${colWidths.turnover} text-gray-300 text-[10px] sm:text-xs font-mono`}>
                      {formatCompact(stock.turnover)}
                    </div>

                    {/* Market Cap */}
                    <div className={`${colWidths.marketCap} text-gray-300 text-[10px] sm:text-xs font-mono`}>
                      {formatCompact(stock.marketCap)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Market Movers (35%) */}
      <div className="relative min-h-screen h-auto w-full lg:mt-0 md:mt-0 sm:mt-18 lg:w-[35%] overflow-hidden">

      {/* Total Trade Cards */}
      <div className="flex flex-col p-2 sm:p-3 md:p-4 gap-3 sm:gap-4">
        {/* Caption about data freshness */}
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          <span className="text-[15px] sm:text-xs text-yellow-300 font-encode bg-yellow-900/20 px-2 py-1 rounded-lg">
            Note: This section shows summary data updated every 30 minutes, not live.
          </span>
        </div>
        <div className="grid bg-gradient-to-br from-[#0F1729] to-[#1a2642] rounded-2xl border border-yellow-400/10 shadow-lg grid-cols-2 gap-2 sm:gap-3 px-2 py-2">
          {/* Total Trades Card */}
          <div className="rounded-xl p-2 sm:p-3 md:p-4 bg-gradient-to-tr from-[#1a2642] via-[#0F1729] to-[#B28D41]/10 border border-yellow-400/10 shadow-sm transition-all">
            <div className="flex flex-col gap-1">
        <span className="text-[8px] sm:text-[10px] font-bold text-yellow-300 uppercase tracking-wider font-encode">Total Trades</span>
        {mercketLoading && !marcketData ? (
          <div className="h-7 w-28 bg-gray-700 rounded animate-pulse" />
        ) : marcketData ? (
          <span className="text-lg sm:text-xl md:text-2xl font-bold text-white font-mono">
            {formatCompact(marcketData.shareVolume)}
          </span>
        ) : (
          <span className="text-sm text-gray-500">N/A</span>
        )}
            </div>
          </div>
          {/* Total Shares Card */}
          <div className="rounded-xl p-2 sm:p-3 md:p-4 bg-gradient-to-tr from-[#1a2642] via-[#0F1729] to-[#E9D37E]/10 border border-yellow-400/10 shadow-sm transition-all">
            <div className="flex flex-col gap-1">
        <span className="text-[8px] sm:text-[10px] font-bold text-yellow-300 uppercase tracking-wider font-encode">Total Shares</span>
        {mercketLoading && !marcketData ? (
          <div className="h-7 w-28 bg-gray-700 rounded animate-pulse" />
        ) : marcketData ? (
          <span className="text-lg sm:text-xl md:text-2xl font-bold text-white font-mono">
            {formatCompact(marcketData.tradeVolume)}
          </span>
        ) : (
          <span className="text-sm text-gray-500">N/A</span>
        )}
            </div>
          </div>
        </div>
      </div>
        
        
      {/* Total Trade Cards -II */}
      <div className="flex flex-col p-2 sm:p-3 md:p-4 gap-3 sm:gap-4">
        <div className="grid bg-gradient-to-br from-[#0F1729] to-[#1a2642] rounded-2xl border border-yellow-400/10 shadow-lg grid-cols-2 gap-2 sm:gap-3 px-2 py-2">
          {/* Total Trades Card */}
          <div className="rounded-xl p-2 sm:p-3 md:p-4 bg-gradient-to-tr from-[#1a2642] via-[#0F1729] to-[#B28D41]/10 border border-yellow-400/10 shadow-sm transition-all">
            <div className="flex flex-col gap-1">
        <span className="text-[8px] sm:text-[10px] font-bold text-yellow-300 uppercase tracking-wider font-encode">Trades</span>
        {mercketLoading && !marcketData ? (
          <div className="h-7 w-28 bg-gray-700 rounded animate-pulse" />
        ) : marcketData ? (
          <span className="text-lg sm:text-xl md:text-2xl font-bold text-white font-mono">
            {formatCompact(marcketData.tradeDate)}
          </span>
        ) : (
          <span className="text-sm text-gray-500">N/A</span>
        )}
            </div>
          </div>
          {/* Total Shares Card */}
          <div className="rounded-xl p-2 sm:p-3 md:p-4 bg-gradient-to-tr from-[#1a2642] via-[#0F1729] to-[#E9D37E]/10 border border-yellow-400/10 shadow-sm transition-all">
            <div className="flex flex-col gap-1">
        <span className="text-[8px] sm:text-[10px] font-bold text-yellow-300 uppercase tracking-wider font-encode">Trade Amount</span>
        {mercketLoading && !marcketData ? (
          <div className="h-7 w-28 bg-gray-700 rounded animate-pulse" />
        ) : marcketData ? (
          <span className="text-lg sm:text-xl md:text-2xl font-bold text-white font-mono">
            {formatCompact(marcketData.trades)}
          </span>
        ) : (
          <span className="text-sm text-gray-500">N/A</span>
        )}
            </div>
          </div>
        </div>
      </div>


      {/* ASPI and SP Cards */}
      <div className="flex flex-col p-2 sm:p-3 md:p-4 gap-3 sm:gap-4">
          <div className="grid bg-gradient-to-br from-[#0F1729] to-[#1a2642] rounded-xl border border-white/10 grid-cols-2 gap-2 sm:gap-3 px-2">

            {/* ASPI Card */}
            <div className="rounded-xl p-2 sm:p-3 md:p-4 transition-all">
              <div className="flex flex-col gap-1">
                <span className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider font-encode">ASPI</span>
                {aspiLoading && !aspiData ? (
                  <div className="h-7 w-28 bg-gray-700 rounded animate-pulse" />
                ) : aspiData ? (
                  <>
                    <span className="text-lg sm:text-xl md:text-2xl font-bold text-white font-mono">
                      {formatPrice(aspiData.value)}
                    </span>
                    <div className="flex items-center gap-1 mt-1">
                      {aspiData.percentage >= 0 ? (
                        <Icons.ArrowUp className="w-2 h-2 sm:w-3 sm:h-3 text-green-400" />
                      ) : (
                        <Icons.ArrowDown className="w-2 h-2 sm:w-3 sm:h-3 text-red-400" />
                      )}
                      <span className={`text-[10px] sm:text-xs font-semibold ${aspiData.percentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {aspiData.percentage >= 0 ? '+' : ''}{aspiData.percentage.toFixed(2)}%
                      </span>
                      <span className={`text-[8px] sm:text-[10px] ${aspiData.change >= 0 ? 'text-green-400/60' : 'text-red-400/60'}`}>
                        ({aspiData.change >= 0 ? '+' : ''}{formatPrice(aspiData.change)})
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-gray-500">N/A</span>
                )}
              </div>
            </div>

            {/* S&P SL20 Card */}
            <div className="p-2 sm:p-3 md:p-4 hover:border-white/20 transition-all">
              <div className="flex flex-col gap-1">
                <span className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider font-encode">S&P SL20</span>
                {snpLoading && !snpData ? (
                  <div className="h-7 w-28 bg-gray-700 rounded animate-pulse" />
                ) : snpData ? (
                  <>
                    <span className="text-lg sm:text-xl md:text-2xl font-bold text-white font-mono">
                      {formatPrice(snpData.value)}
                    </span>
                    <div className="flex items-center gap-1 mt-1">
                      {snpData.percentage >= 0 ? (
                        <Icons.ArrowUp className="w-2 h-2 sm:w-3 sm:h-3 text-green-400" />
                      ) : (
                        <Icons.ArrowDown className="w-2 h-2 sm:w-3 sm:h-3 text-red-400" />
                      )}
                      <span className={`text-[10px] sm:text-xs font-semibold ${snpData.percentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {snpData.percentage >= 0 ? '+' : ''}{snpData.percentage.toFixed(2)}%
                      </span>
                      <span className={`text-[8px] sm:text-[10px] ${snpData.change >= 0 ? 'text-green-400/60' : 'text-red-400/60'}`}>
                        ({snpData.change >= 0 ? '+' : ''}{formatPrice(snpData.change)})
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-gray-500">N/A</span>
                )}
              </div>
            </div>

          </div>
      </div>

      {/* Top Gainers and Top Losers */}
      <div className="h-auto lg:h-[50%] flex flex-col lg:flex-row p-2 sm:p-3 md:p-4 gap-3 sm:gap-4">

          {/* Top Gainers Section */}
          <div className="flex-1 min-h-[300px] lg:min-h-0">
            <div className="h-full flex flex-col gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1 sm:p-1.5 rounded-lg bg-green-500/10">
                  <Icons.TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-100 uppercase tracking-wide font-encode">Top Gainers</h3>
              </div>
              
              <div className="flex-1 bg-gradient-to-br from-[#0F1729] to-[#0a1120] rounded-xl border border-white/5 overflow-hidden">
                <div className="h-full overflow-y-auto hide-scrollbar">
                  {/* Loading */}
                  {gainersLoading && !gainers && (
                    <>{Array.from({ length: 6 }).map((_, i) => <GainerLoserSkeleton key={i} i={i} />)}</>
                  )}
                  {/* Empty */}
                  {!gainersLoading && (!gainers || gainers.length === 0) && (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-gray-500 text-xs">No gainers data available.</p>
                    </div>
                  )}
                  {/* Live data */}
                  {gainers && gainers.slice(0, 10).map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between px-2 sm:px-3 md:px-4 py-2 sm:py-3 hover:bg-green-500/5 transition-all border-b border-white/[0.03] last:border-0 group"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm font-bold text-gray-200 group-hover:text-green-400 transition-colors">{item.symbol}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[10px] sm:text-xs font-mono text-gray-300">LKR {formatPrice(item.price)}</span>
                        <div className="flex items-center gap-1">
                          <Icons.ArrowUp className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-green-400" />
                          <span className="text-[8px] sm:text-[10px] font-bold text-green-400">+{item.changePercentage.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top Losers Section */}
          <div className="flex-1 min-h-[300px] lg:min-h-0">
            <div className="h-full flex flex-col gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1 sm:p-1.5 rounded-lg bg-red-500/10">
                  <Icons.TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-100 uppercase tracking-wide font-encode">Top Losers</h3>
              </div>
              
              <div className="flex-1 bg-gradient-to-br from-[#0F1729] to-[#0a1120] rounded-xl border border-white/5 overflow-hidden">
                <div className="h-full overflow-y-auto hide-scrollbar">
                  {/* Loading */}
                  {losersLoading && !losers && (
                    <>{Array.from({ length: 6 }).map((_, i) => <GainerLoserSkeleton key={i} i={i} />)}</>
                  )}
                  {/* Empty */}
                  {!losersLoading && (!losers || losers.length === 0) && (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-gray-500 text-xs">No losers data available.</p>
                    </div>
                  )}
                  {/* Live data */}
                  {losers && losers.slice(0, 10).map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between px-2 sm:px-3 md:px-4 py-2 sm:py-3 hover:bg-red-500/5 transition-all border-b border-white/[0.03] last:border-0 group"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm font-bold text-gray-200 group-hover:text-red-400 transition-colors">{item.symbol}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[10px] sm:text-xs font-mono text-gray-300">LKR {formatPrice(item.price)}</span>
                        <div className="flex items-center gap-1">
                          <Icons.ArrowDown className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-red-400" />
                          <span className="text-[8px] sm:text-[10px] font-bold text-red-400">{item.changePercentage.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

      </div>

 
      {/* Example Chart: ASPI Trend (last 10 values) */}
      <div className="mt-4 md:p-4">
        <div className="bg-[#0F1729] rounded-xl border border-white/10 p-3">
          {aspiData && Array.isArray(aspiData.value) && aspiData.value.length > 1 ? (
            <svg width="100%" height="80" viewBox={`0 0 200 80`} className="w-full h-20">
              {/* Line chart */}
              <polyline
                fill="none"
                stroke="#B28D41"
                strokeWidth="2"
                points={
                  aspiData.value
                    .slice(-10)
                    .map((v, i, arr) => {
                      const x = (i / (arr.length - 1)) * 190 + 5;
                      const min = Math.min(...arr);
                      const max = Math.max(...arr);
                      const y = 70 - ((v - min) / (max - min || 1)) * 60;
                      return `${x},${y}`;
                    })
                    .join(" ")
                }
              />
              {/* Dots */}
              {aspiData.value.slice(-10).map((v, i, arr) => {
                const x = (i / (arr.length - 1)) * 190 + 5;
                const min = Math.min(...arr);
                const max = Math.max(...arr);
                const y = 70 - ((v - min) / (max - min || 1)) * 60;
                return (
                  <circle key={i} cx={x} cy={y} r="2.5" fill="#E9D37E" />
                );
              })}
            </svg>
          ) : (
            <div className="h-20 flex items-center justify-center text-gray-500 text-xs">No ASPI trend data.</div>
          )}
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>Oldest</span>
            <span>Latest</span>
          </div>
        </div>
      </div>



      </div>

    </section>
  );
}