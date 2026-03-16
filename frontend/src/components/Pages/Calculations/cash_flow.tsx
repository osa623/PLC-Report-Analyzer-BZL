"use client";

interface Props { symbol?: string; }

const mockIncomeData = [
  { label: "Interest Income", value: 7567458657 },
  { label: "Interest Expense", value: 5325654667 },
  { label: "Net Interest Income", value: 2241803990 },
  { label: "Operating Income", value: 1874567890 },
  { label: "Operating Expenses", value: 945678900 },
  { label: "Profit Before Tax", value: 928888990 },
  { label: "Tax Expense", value: 275666000 },
  { label: "Net Profit", value: 653222990 },
];

const colWidths = {
  label: "w-[60%]",
  value: "w-[40%]",
};

export default function CashFlow({ symbol }: Props) {
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
              STATEMENT OF CASH FLOW
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
            <div className={`${colWidths.label} text-left text-[10px] sm:text-xs font-bold text-[#64748B] uppercase tracking-[0.15em] font-inter`}>ITEM</div>
            <div className={`${colWidths.value} text-right text-[10px] sm:text-xs font-bold text-[#64748B] uppercase tracking-[0.15em] font-inter`}>AMOUNT (LKR)</div>
          </div>

          {/* Table Body */}
          <div className="flex flex-col max-h-[600px] overflow-y-auto hide-scrollbar">
            {mockIncomeData.map((row, i) => {
              const isTotal = row.label.toLowerCase().includes("net") || row.label.toLowerCase().includes("profit");
              return (
                <div
                  key={row.label}
                  className="flex w-full items-center px-4 sm:px-6 py-3.5 transition-all duration-100 group cursor-default terminal-row-hover"
                  style={{
                    borderBottom: "1px solid rgba(56,189,248,0.06)",
                    background: i % 2 === 0 ? "transparent" : "rgba(56,189,248,0.02)",
                  }}
                >
                  <div className={`${colWidths.label} flex flex-col pr-4`}>
                    <span className={`text-sm sm:text-[15px] font-semibold group-hover:text-[#F1F5F9] transition-colors duration-100 font-inter leading-tight ${isTotal ? "text-[#FACC15]" : "text-[#94A3B8]"}`}>
                      {row.label}
                    </span>
                  </div>
                  <div className={`${colWidths.value} text-right font-jetbrains text-sm sm:text-[15px] tabular-nums group-hover:text-[#FACC15] transition-colors duration-100 ${isTotal ? "text-[#FACC15] font-bold" : "text-[#F1F5F9]"}`}>
                    <span className="text-[#475569] mr-2 text-xs">LKR</span>
                    {row.value.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
