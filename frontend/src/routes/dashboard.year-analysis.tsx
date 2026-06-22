import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { yearSeries as mockSeries } from "@/lib/mock-data";
import { getCurrentReportId, getFullReport } from "@/lib/api";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { filterValidYears } from "@/lib/year-utils";

export const Route = createFileRoute("/dashboard/year-analysis")({
  head: () => ({ meta: [{ title: "Year Analysis - FDI" }, { name: "description", content: "Multi-year financial trends and growth analytics." }] }),
  component: YearPage,
});

const navy = "#0B1F3A";
const gold = "#D4A017";
const slate = "#64748B";
const green = "#16A34A";
const red = "#DC2626";

function pct(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 1000) / 10 : 0;
}

function rounded(value: unknown, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function yoy(current: number, previous: number) {
  if (!previous) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function buildMockSeries() {
  return mockSeries.map((row, index) => {
    const previous = mockSeries[index - 1];
    const revenueGrowth = previous ? yoy(row.revenue, previous.revenue) : 0;
    const profitGrowth = previous ? yoy(row.profit, previous.profit) : 0;
    return {
      ...row,
      netMargin: rounded((row.profit / row.revenue) * 100),
      operatingMargin: rounded(((row.profit + row.interest) / row.revenue) * 100),
      grossMargin: rounded(((row.revenue - row.revenue * 0.68) / row.revenue) * 100),
      roa: rounded((row.profit / row.assets) * 100),
      roe: rounded((row.profit / row.equity) * 100),
      currentRatio: rounded(1.52 + index * 0.08, 2),
      quickRatio: rounded(1.18 + index * 0.05, 2),
      debtRatio: rounded((row.liabilities / row.assets) * 100),
      interestCoverage: rounded((row.profit + row.interest) / row.interest, 2),
      assetTurnover: rounded(row.revenue / row.assets, 2),
      cashConversion: rounded((row.cashflow / row.profit) * 100),
      ocfToDebt: rounded((row.cashflow / row.liabilities) * 100),
      revenueGrowth: rounded(revenueGrowth),
      profitGrowth: rounded(profitGrowth),
      eps: rounded(row.profit / 12, 2),
      epsGrowth: previous ? rounded(yoy(row.profit / 12, previous.profit / 12)) : 0,
      dividendPerShare: rounded(2.1 + index * 0.22, 2),
      dividendPayout: rounded(30 + index * 1.8),
    };
  });
}

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

  const analysis = useMemo(() => {
    if (!report || !report.analytics || !report.analytics.ratios) {
      const series = buildMockSeries();
      const latest: any = series[series.length - 1] || {};
      const first: any = series[0] || {};
      return {
        availableYears: [2020, 2021, 2022, 2023],
        companyName: "ABC Corporation",
        scaleLabel: "M",
        yearSeriesData: series,
        summary: [
          { label: "Revenue CAGR", value: `${rounded(yoy(latest.revenue, first.revenue) / Math.max(series.length - 1, 1))}%`, tone: green },
          { label: "Latest Net Margin", value: `${latest.netMargin}%`, tone: navy },
          { label: "ROE", value: `${latest.roe}%`, tone: gold },
          { label: "Debt Ratio", value: `${latest.debtRatio}%`, tone: red },
        ],
      };
    }

    const ratios = report.analytics.ratios;
    const byYear = ratios.by_year || {};
    const yearsList = filterValidYears(byYear);

    let maxFinancial = 0;
    yearsList.forEach((y) => {
      const yData = byYear[y] || {};
      maxFinancial = Math.max(
        maxFinancial,
        Math.abs(yData.revenue || 0),
        Math.abs(yData.net_income || 0),
        Math.abs(yData.total_assets || 0),
        Math.abs(yData.total_equity || 0),
        Math.abs(yData.operating_cash_flow || 0),
        Math.abs(yData.total_liabilities || 0),
      );
    });
    const scale = maxFinancial > 1e6 ? 1e6 : (maxFinancial > 1e3 ? 1e3 : 1);
    const scaleLabel = maxFinancial > 1e6 ? "M" : (maxFinancial > 1e3 ? "K" : "");

    const series = yearsList.map((y) => {
      const yData = byYear[y] || {};
      return {
        year: String(y),
        revenue: rounded((yData.revenue || 0) / scale),
        profit: rounded((yData.net_income || 0) / scale),
        assets: rounded((yData.total_assets || 0) / scale),
        equity: rounded((yData.total_equity || 0) / scale),
        cashflow: rounded((yData.operating_cash_flow || 0) / scale),
        liabilities: rounded((yData.total_liabilities || 0) / scale),
        grossMargin: pct(yData.gross_margin),
        operatingMargin: pct(yData.operating_margin),
        netMargin: pct(yData.net_profit_margin),
        roa: pct(yData.return_on_assets),
        roe: pct(yData.return_on_equity),
        currentRatio: rounded(yData.current_ratio, 2),
        quickRatio: rounded(yData.quick_ratio, 2),
        debtRatio: pct(yData.debt_ratio),
        interestCoverage: rounded(yData.interest_coverage, 2),
        assetTurnover: rounded(yData.asset_turnover, 2),
        cashConversion: pct(yData.cash_flow_to_net_income),
        ocfToDebt: pct(yData.ocf_to_debt_ratio),
        revenueGrowth: pct(yData.revenue_growth_yoy),
        profitGrowth: pct(yData.net_profit_growth_yoy),
        eps: rounded(yData.eps, 2),
        epsGrowth: pct(yData.eps_growth_yoy),
        dividendPerShare: rounded(yData.dividend_per_share, 2),
        dividendPayout: pct(yData.dividend_payout_ratio),
      };
    });

    const latest: any = series[series.length - 1] || {};
    const first: any = series[0] || {};
    const yearsGap = Math.max(series.length - 1, 1);

    return {
      availableYears: yearsList,
      companyName: report.name || "Company Profile",
      scaleLabel,
      yearSeriesData: series,
      summary: [
        { label: "Revenue CAGR", value: `${rounded(yoy(latest.revenue, first.revenue) / yearsGap)}%`, tone: green },
        { label: "Latest Net Margin", value: `${latest.netMargin || 0}%`, tone: navy },
        { label: "ROE", value: `${latest.roe || 0}%`, tone: gold },
        { label: "Debt Ratio", value: `${latest.debtRatio || 0}%`, tone: red },
      ],
    };
  }, [report]);

  const chartRange = `${analysis.yearSeriesData[0]?.year || "2018"} - ${analysis.yearSeriesData[analysis.yearSeriesData.length - 1]?.year || "2023"}`;
  const unitSuffix = analysis.scaleLabel ? ` (${analysis.scaleLabel})` : "";

  return (
    <Page>
      <DashboardHeader year={year} setYear={setYear} availableYears={analysis.availableYears} companyName={analysis.companyName} />
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Drill-down B</div>
          <h1 className="mt-1 text-[32px] font-semibold tracking-tight">Year Analysis</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{analysis.companyName} - investor-focused multi-year research charts</p>
        </div>
        <div className="text-right text-[12px] text-muted-foreground">
          <div>Chart range</div>
          <div className="mt-0.5 font-medium text-foreground">{chartRange}</div>
        </div>
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
        <>
          <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {analysis.summary.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="card-elevated p-4"
              >
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
                <div className="mt-2 text-[26px] font-semibold tracking-tight" style={{ color: item.tone }}>{item.value}</div>
              </motion.div>
            ))}
          </section>

          <section className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <ResearchChart title={`Revenue, Profit & Cash Flow${unitSuffix}`} subtitle="Core performance stack" height={300} wide>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={analysis.yearSeriesData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="revenue" fill={navy} radius={[5, 5, 0, 0]} />
                  <Bar dataKey="profit" fill={gold} radius={[5, 5, 0, 0]} />
                  <Line type="monotone" dataKey="cashflow" stroke={green} strokeWidth={2.4} dot={{ r: 3, fill: green, strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ResearchChart>

            <div className="grid gap-4">
              <ResearchChart title="Revenue / Profit Growth" subtitle="YoY acceleration" height={136}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.yearSeriesData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#EEF2F6" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: slate }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: slate }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTip />} />
                    <Bar dataKey="revenueGrowth" fill={navy} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profitGrowth" fill={gold} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ResearchChart>

              <ResearchChart title="EPS & Dividend" subtitle="Shareholder signal" height={136}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysis.yearSeriesData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#EEF2F6" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: slate }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: slate }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTip />} />
                    <Line type="monotone" dataKey="eps" stroke={navy} strokeWidth={2.2} dot={{ r: 3, fill: navy, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="dividendPerShare" stroke={gold} strokeWidth={2.2} dot={{ r: 3, fill: gold, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ResearchChart>
            </div>
          </section>

          <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ResearchChart title="Margin Stack (%)" subtitle="Gross, operating, net" height={190}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysis.yearSeriesData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <Line type="monotone" dataKey="grossMargin" stroke={green} strokeWidth={2} dot={{ r: 2.8, fill: green, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="operatingMargin" stroke={gold} strokeWidth={2} dot={{ r: 2.8, fill: gold, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="netMargin" stroke={navy} strokeWidth={2} dot={{ r: 2.8, fill: navy, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </ResearchChart>

            <ResearchChart title="ROA / ROE (%)" subtitle="Return quality" height={190}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analysis.yearSeriesData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <Area type="monotone" dataKey="roe" stroke={navy} strokeWidth={2.2} fill={navy} fillOpacity={0.12} />
                  <Area type="monotone" dataKey="roa" stroke={gold} strokeWidth={2.2} fill={gold} fillOpacity={0.16} />
                </AreaChart>
              </ResponsiveContainer>
            </ResearchChart>

            <ResearchChart title="Balance Sheet Mix" subtitle={`Assets, equity, liabilities${unitSuffix}`} height={190}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysis.yearSeriesData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="assets" fill={navy} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="equity" fill={gold} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="liabilities" fill={slate} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ResearchChart>

            <ResearchChart title="Liquidity Ratios" subtitle="Short-term resilience" height={190}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysis.yearSeriesData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <Line type="monotone" dataKey="currentRatio" stroke={navy} strokeWidth={2.2} dot={{ r: 3, fill: navy, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="quickRatio" stroke={gold} strokeWidth={2.2} dot={{ r: 3, fill: gold, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </ResearchChart>

            <ResearchChart title="Leverage & Coverage" subtitle="Debt pressure" height={190}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={analysis.yearSeriesData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="debtRatio" fill={gold} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="interestCoverage" stroke={navy} strokeWidth={2.2} dot={{ r: 3, fill: navy, strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ResearchChart>

            <ResearchChart title="Cash Conversion (%)" subtitle="Profit backed by cash" height={190}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analysis.yearSeriesData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <Area type="monotone" dataKey="cashConversion" stroke={green} strokeWidth={2.2} fill={green} fillOpacity={0.14} />
                  <Area type="monotone" dataKey="ocfToDebt" stroke={gold} strokeWidth={2.2} fill={gold} fillOpacity={0.12} />
                </AreaChart>
              </ResponsiveContainer>
            </ResearchChart>

            <ResearchChart title="Asset Turnover" subtitle="Efficiency of asset base" height={190}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysis.yearSeriesData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <Line type="monotone" dataKey="assetTurnover" stroke={navy} strokeWidth={2.2} dot={{ r: 3, fill: navy, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </ResearchChart>

            <ResearchChart title="EPS Growth (%)" subtitle="Per-share compounding" height={190}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysis.yearSeriesData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="epsGrowth" fill={navy} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ResearchChart>

            <ResearchChart title="Dividend Payout (%)" subtitle="Distribution discipline" height={190}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analysis.yearSeriesData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: slate }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTip />} />
                  <Area type="monotone" dataKey="dividendPayout" stroke={gold} strokeWidth={2.2} fill={gold} fillOpacity={0.16} />
                </AreaChart>
              </ResponsiveContainer>
            </ResearchChart>
          </section>
        </>
      )}
    </Page>
  );
}

function ResearchChart({ title, subtitle, height, children, wide = false }: { title: string; subtitle: string; height: number; children: React.ReactNode; wide?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`card-elevated p-4 ${wide ? "min-h-[360px]" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium">{title}</div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <div className="mt-3" style={{ height }}>
        {children}
      </div>
    </motion.div>
  );
}

function CustomTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-[11.5px] shadow-md">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-1 space-y-0.5">
        {payload.map((item: any) => (
          <div key={item.dataKey} className="flex items-center gap-2 tabular-nums text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            <span>{item.name}: {Number(item.value || 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
