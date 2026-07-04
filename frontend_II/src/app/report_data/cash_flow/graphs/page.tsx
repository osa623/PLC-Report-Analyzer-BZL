"use client";

import { useParams } from "next/navigation";
import MainNav from "@/components/Ui/Stocks/MainNav";
import SecondaryNav from "@/components/Ui/Stocks/Report_DataNav";
import CashFlowSubNav from "@/components/Ui/Stocks/CashFlowSubNav";
import { useCompanyGraphData } from "@/hooks/useCompanyGraphData";
import EChartsLineChart from "@/components/Ui/Charts/EChartsLineChart";
import GraphCard from "@/components/Ui/Charts/GraphCard";
import { AlertCircle, BarChart3 } from "lucide-react";

export default function CashFlowGraphsPage() {
  const params = useParams<{ symbol?: string }>();
  const hasSymbol = !!params?.symbol;

  const { series, symbol, loading, error } = useCompanyGraphData({
    category: "cash_flow",
  });

  return (
    <main className="min-h-screen text-white">
      <div className="container mx-auto px-6 py-8 space-y-8">

        {!hasSymbol && (
          <>
            <MainNav />
            <SecondaryNav />
            <CashFlowSubNav />
          </>
        )}

        {error && (
          <div
            className="flex items-center gap-3 px-5 py-4 rounded-xl text-sm font-inter"
            style={{
              background: "rgba(248,113,113,0.06)",
              border: "1px solid rgba(248,113,113,0.2)",
              color: "#F87171",
            }}
          >
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        {!hasSymbol && !symbol && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BarChart3 className="h-16 w-16 text-[#38BDF8] opacity-20 mb-4" />
            <p className="text-lg font-bold text-slate-300 font-inter">
              Cash Flow Charts
            </p>
            <p className="mt-2 text-sm text-[#475569] font-inter">
              Select a company from the navigation to view real-time cash flow charts.
            </p>
          </div>
        )}

        {(hasSymbol || symbol) && (
          <>
            {symbol && (
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-bold text-slate-100 font-inter tracking-wide uppercase">
                  {symbol}
                </h2>
                <span className="text-xs text-[#475569] font-inter">
                  Cash Flow · Trend Analysis
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                  <GraphCard
                    key={i}
                    title="Loading…"
                    color="#38BDF8"
                    loading
                    fullWidth={i === 0}
                  >
                    <div />
                  </GraphCard>
                ))
                : series.map((s, idx) => (
                  <GraphCard
                    key={s.label}
                    title={s.label}
                    color={s.color}
                    fullWidth={idx === 0}
                  >
                    <EChartsLineChart
                      data={s.data}
                      color={s.color}
                      height={idx === 0 ? 320 : 280}
                      areaFill
                    />
                  </GraphCard>
                ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
