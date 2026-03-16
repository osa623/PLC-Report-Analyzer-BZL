"use client";

// --- Inline Icons (No Dependencies) ---
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
  Search: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
};

const mockStockData = [
  { symbol: "JKH.N0000", name: "John Keels Holdings", industry: "Diversified", price: 210, pe: 14.5, pb: 1.8, nav: 165, valuation: 20, growth: 5, target: 80 },
  { symbol: "HNB.N0000", name: "Hatton National Bank", industry: "Bank", price: 285, pe: 9.2, pb: 1.1, nav: 260, valuation: 12, growth: 23, target: 500 },
  { symbol: "JKH.N0000", name: "John Keels Holdings", industry: "Diversified", price: 210, pe: 14.5, pb: 1.8, nav: 165, valuation: 20, growth: 5, target: 80 },
  { symbol: "HNB.N0000", name: "Hatton National Bank", industry: "Bank", price: 285, pe: 9.2, pb: 1.1, nav: 260, valuation: 12, growth: 23, target: 500 },
  { symbol: "JKH.N0000", name: "John Keels Holdings", industry: "Diversified", price: 210, pe: 14.5, pb: 1.8, nav: 165, valuation: 20, growth: 5, target: 80 },
  { symbol: "JKH.N0000", name: "John Keels Holdings", industry: "Diversified", price: 210, pe: 14.5, pb: 1.8, nav: 165, valuation: 20, growth: 5, target: 80 },
  { symbol: "HNB.N0000", name: "Hatton National Bank", industry: "Bank", price: 285, pe: 9.2, pb: 1.1, nav: 260, valuation: 12, growth: 23, target: 500 },
  { symbol: "JKH.N0000", name: "John Keels Holdings", industry: "Diversified", price: 210, pe: 14.5, pb: 1.8, nav: 165, valuation: 20, growth: 5, target: 80 },
];

const colWidths = {
  symbol: "w-[20%]", // Increased to accommodate stacked name/symbol
  industry: "w-[12%]",
  price: "w-[10%]",
  pe: "w-[8%]",
  pb: "w-[8%]",
  nav: "w-[10%]",
  valuation: "w-[12%]",
  growth: "w-[10%]",
  target: "w-[10%]"
};

export default function Watchlist() {
  return (
    <section className="relative flex flex-col w-full min-h-screen bg-gradient-to-br from-[#0A0E1A] via-[#0D1425] to-[#182039] p-4 sm:p-6 md:p-8 lg:p-10">

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">

        {/* HEADER SECTION */}
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col">
            <h2 className="text-xs sm:text-sm font-bold px-1 text-[#B28D41] uppercase tracking-widest mb-1">Market Intelligence</h2>
            <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-[#c7cbd0] tracking-tight leading-tight">
              WATCHLIST
            </h3>
          </div>

          {/* Search Bar - Matching AllStocksSection Design */}
          <div className="flex w-full h-[50px] sm:h-[60px] py-1">
            <div className='relative w-full h-full bg-transparent border-t-2 border-gray-800 overflow-hidden flex items-center px-2 gap-2'>
              <input
                type="text"
                placeholder="Search your watchlist..."
                className="flex-1 h-full bg-transparent text-white font-encode text-sm sm:text-[15px] font-thin outline-none placeholder:text-gray-500"
              />
              <button
                className="flex items-center cursor-pointer font-encode font-medium bg-gradient-to-r from-[#B28D41] to-[#E9D37E] text-[#0D1325] rounded-lg hover:shadow-lg hover:shadow-[#B28D41]/30 transition-all duration-300 hover:scale-105 gap-2 px-6 sm:px-10 py-2 "
              >
                <Icons.Search className="w-4 h-4" />
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>
          </div>
        </div>

        {/* TABLE SECTION */}
        <div className="w-full mt-4">

          {/* Table Header */}
          <div className="flex w-full border-b border-gray-800/60 px-4 py-2 mb-2 items-center">
            <div className={`${colWidths.symbol} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Company</div>
            <div className={`${colWidths.industry} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Industry</div>
            <div className={`${colWidths.price} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Price</div>
            <div className={`${colWidths.pe} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>P/E</div>
            <div className={`${colWidths.pb} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>P/B</div>
            <div className={`${colWidths.nav} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>NAV</div>
            <div className={`${colWidths.valuation} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Valuation</div>
            <div className={`${colWidths.growth} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Growth</div>
            <div className={`${colWidths.target} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Target</div>
          </div>

          {/* Scrollable Body */}
          <div className="flex flex-col gap-2 overflow-y-auto hide-scrollbar max-h-[600px]">
            {mockStockData.map((row, idx) => (
              <div
                key={idx}
                className="flex w-full cursor-pointer items-center bg-[#121C33] rounded-lg px-4 py-3 hover:bg-gray-800/70 text-[10px] sm:text-xs transition border border-transparent hover:border-gray-600 group"
              >
                {/* Symbol & Name */}
                <div className={`${colWidths.symbol} flex flex-col font-encode text-gray-200`}>
                  <span className="text-xs sm:text-sm font-bold group-hover:text-[#B28D41] transition-colors">{row.symbol}</span>
                  <span className="text-[10px] text-gray-400 font-thin truncate pr-2">{row.name}</span>
                </div>

                {/* Industry */}
                <div className={`${colWidths.industry} text-gray-400`}>
                  {row.industry}
                </div>

                {/* Price */}
                <div className={`${colWidths.price} text-gray-200 font-mono text-xs sm:text-sm`}>
                  {row.price.toLocaleString()}
                </div>

                {/* PE */}
                <div className={`${colWidths.pe} text-gray-300 font-mono`}>
                  {row.pe}
                </div>

                {/* PB */}
                <div className={`${colWidths.pb} text-gray-300 font-mono`}>
                  {row.pb}
                </div>

                {/* NAV */}
                <div className={`${colWidths.nav} text-gray-300 font-mono`}>
                  {row.nav.toLocaleString()}
                </div>

                {/* Valuation */}
                <div className={`${colWidths.valuation} text-[#B28D41] font-mono font-bold`}>
                  DCF: {row.valuation}
                </div>

                {/* Growth */}
                <div className={`${colWidths.growth}`}>
                  <div className={`flex items-center gap-1 font-bold ${row.growth >= 15 ? "text-green-400" : "text-red-400"}`}>
                    {row.growth >= 0 ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />}
                    <span>{row.growth}%</span>
                  </div>
                </div>

                {/* Target */}
                <div className={`${colWidths.target} text-gray-300 font-mono`}>
                  <span className="px-2 py-1 bg-white/5 rounded text-gray-300 border border-white/10">
                    {row.target}
                  </span>
                </div>

              </div>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
}
