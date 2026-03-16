"use client";

interface Props { symbol?: string; }

const mockIncomeData = [
  { label: "1. Revenue Growth Rate ", value: 657, rating: "Good" },
  { label: "2. Gross Profit", value: 667, rating: "Bad" },
  { label: "3. Gross Profit Margin", value: 990, rating: "Excellent" },
  { label: "4. Operating Profit (EBIT)", value: 890, rating: "Very Bad" },
  { label: "5. Operating Margin", value: 900, rating: "Good" },
  { label: "6. EBITDA", value: 990, rating: "Good" },
  { label: "7. EBITDA Margin", value: 654, rating: "Bad" },
  { label: "8. Net Profit Margin", value: 990, rating: "Excellent" },
];

const colWidths = {
  label: "w-[50%]",
  value: "w-[25%]",
  rating: "w-[25%]",
};

export default function IncomeST({ symbol }: Props) {
  return (
    <section className="relative flex flex-col w-full px-4 py-6 sm:px-6 md:px-8 lg:px-10 h-full">

      <div className="relative w-full max-w-7xl mx-auto flex flex-col gap-5">
        {/* ═══════ HEADER ═══════ */}
        <div className="flex flex-col gap-1">
          <h2 className="text-[10px] sm:text-xs font-bold px-1 text-[#38BDF8] uppercase tracking-[0.2em] font-inter">
            Financial Analysis{symbol ? ` — ${symbol}` : ""}
          </h2>
          <div className="flex items-end justify-between">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#F1F5F9] tracking-tight leading-tight font-inter uppercase">
              INCOME STATEMENT
            </h3>
            <div className="hidden sm:block h-[2px] w-20 mb-2" style={{
              background: "linear-gradient(90deg, #38BDF8, transparent)",
              boxShadow: "0 0 8px rgba(56,189,248,0.3)",
            }}></div>
          </div>
        </div>

        {/* ═══════ TABLE ═══════ */}
        <div
          className="overflow-hidden"
          style={{
            background: "#0B0F16",
            border: "1px solid rgba(56,189,248,0.08)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          {/* Table Header */}
          <div
            className="flex w-full px-4 sm:px-6 py-3.5 items-center"
            style={{
              background: "#0D131A",
              borderBottom: "1px solid rgba(56,189,248,0.12)",
            }}
          >
            <div className={`${colWidths.label} text-left text-[10px] sm:text-xs font-bold text-[#64748B] uppercase tracking-[0.15em] font-inter`}>METRIC</div>
            <div className={`${colWidths.value} text-left text-[10px] sm:text-xs font-bold text-[#64748B] uppercase tracking-[0.15em] font-inter`}>VALUE</div>
            <div className={`${colWidths.rating} text-left text-[10px] sm:text-xs font-bold text-[#64748B] uppercase tracking-[0.15em] font-inter`}>RATING</div>
          </div>

          {/* Table Body */}
          <div className="flex flex-col max-h-[600px] overflow-y-auto hide-scrollbar">
            {mockIncomeData.map((row, i) => (
              <div
                key={row.label}
                className="flex w-full items-center px-4 sm:px-6 py-3.5 transition-all duration-100 group cursor-default terminal-row-hover"
                style={{
                  borderBottom: "1px solid rgba(56,189,248,0.06)",
                  background: i % 2 === 0 ? "transparent" : "rgba(56,189,248,0.02)",
                }}
              >
                {/* Label */}
                <div className={`${colWidths.label} flex flex-col pr-4`}>
                  <span className="text-sm sm:text-[15px] font-semibold text-[#94A3B8] group-hover:text-[#F1F5F9] transition-colors duration-100 font-inter leading-tight">
                    {row.label}
                  </span>
                </div>

                {/* Value */}
                <div className={`${colWidths.value} font-jetbrains text-[#F1F5F9] text-sm sm:text-[15px] tabular-nums group-hover:text-[#FACC15] transition-colors duration-100`}>
                  {row.value.toLocaleString()}
                </div>

                {/* Rating */}
                <div className={`${colWidths.rating} flex items-center`}>
                  <span className={`
                    px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider
                    ${['Good', 'Excellent', 'Exellent'].includes(row.rating) ? 'badge-green' : ''}
                    ${['Bad', 'Very Bad'].includes(row.rating) ? 'badge-red' : ''}
                  `}>
                    {row.rating}
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
