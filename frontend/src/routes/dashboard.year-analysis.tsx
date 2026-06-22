import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { yearSeries as mockSeries } from "@/lib/mock-data";
import { getCurrentReportId, getFullReport } from "@/lib/api";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";
import { filterValidYears } from "@/lib/year-utils";

export const Route = createFileRoute("/dashboard/year-analysis")({
  head: () => ({ meta: [{ title: "Year Analysis — FDI" }, { name: "description", content: "Multi-year financial trends and growth analytics." }] }),
  component: YearPage,
});

const navy = "#0B1F3A";
const gold = "#D4A017";

function YearPage() {
  const [report, setReport] = useState<any>(null);
  const [hasActiveReport, setHasActiveReport] = useState(false);
  const [year, setYear] = useState(2023);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const reportId = getCurrentReportId();
    setHasActiveReport(Boolean(reportId));
    if (!reportId) return;
    setLoading(true);
    getFullReport(reportId).then((data) => {
      setReport(data);
      const years = filterValidYears(data?.analytics?.ratios?.by_year || {});
      if (years.length) setYear(years[years.length - 1]);
    }).catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, []);
  const hasRealAnalytics = Object.keys(report?.analytics?.ratios?.by_year || {}).length > 0;

  const { availableYears, yearSeriesData, companyName, scaledSeries } = useMemo(() => {
    if (!report || !report.analytics || !report.analytics.ratios) {
      return {
        availableYears: [2020, 2021, 2022, 2023],
        companyName: "ABC Corporation",
        yearSeriesData: mockSeries,
        scaledSeries: [
          { key: "revenue", label: "Revenue Growth (M)", color: navy },
          { key: "profit", label: "Profit Growth (M)", color: gold },
          { key: "assets", label: "Asset Growth (M)", color: navy },
          { key: "cashflow", label: "Cash Flow Growth (M)", color: gold },
        ] as const
      };
    }
    const ratios = report.analytics.ratios;
    const byYear = ratios.by_year || {};
    const yearsList = filterValidYears(byYear);

    let maxRev = 0;
    yearsList.forEach(y => {
      const r = byYear[y]?.revenue || 0;
      if (r > maxRev) maxRev = r;
    });
    const scale = maxRev > 1e6 ? 1e6 : (maxRev > 1e3 ? 1e3 : 1);
    const scaleStr = maxRev > 1e6 ? " (M)" : (maxRev > 1e3 ? " (K)" : "");

    const yearSeries = yearsList.map(y => {
      const yData = byYear[y] || {};
      return {
        year: String(y),
        revenue: Math.round(((yData.revenue || 0) / scale) * 10) / 10,
        profit: Math.round(((yData.net_income || 0) / scale) * 10) / 10,
        assets: Math.round(((yData.total_assets || 0) / scale) * 10) / 10,
        cashflow: Math.round(((yData.operating_cash_flow || 0) / scale) * 10) / 10,
      };
    });

    const seriesDef = [
      { key: "revenue" as const, label: `Revenue Growth${scaleStr}`, color: navy },
      { key: "profit" as const, label: `Profit Growth${scaleStr}`, color: gold },
      { key: "assets" as const, label: `Asset Growth${scaleStr}`, color: navy },
      { key: "cashflow" as const, label: `Cash Flow Growth${scaleStr}`, color: gold },
    ];

    return {
      availableYears: yearsList,
      companyName: report.name || "Company Profile",
      yearSeriesData: yearSeries,
      scaledSeries: seriesDef
    };
  }, [report]);

  return (
    <Page>
      <DashboardHeader year={year} setYear={setYear} availableYears={availableYears} companyName={companyName} />
      <div className="mt-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Drill-down B</div>
        <h1 className="mt-1 text-[32px] font-semibold tracking-tight">Year Analysis</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{companyName} · premium multi-year charts</p>
      </div>

      {loading && (
        <div className="mt-6 flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--navy)]" />
        </div>
      )}

      {!loading && hasActiveReport && !hasRealAnalytics && (
        <div className="mt-8 rounded-xl border border-border bg-white px-5 py-4 text-[13px] text-muted-foreground">
          Finalized analysis charts are still processing for the uploaded report batch.
        </div>
      )}

      {!loading && (!hasActiveReport || hasRealAnalytics) && (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {scaledSeries.map((s, i) => (
            <motion.div key={s.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-elevated p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium">{s.label}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {yearSeriesData[0]?.year || "2018"} — {yearSeriesData[yearSeriesData.length - 1]?.year || "2023"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-muted-foreground">{s.label}</span>
                </div>
              </div>
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={yearSeriesData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#EEF2F6" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }} />
                    <Area type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2.2} fill={`url(#g-${s.key})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </Page>
  );
}
