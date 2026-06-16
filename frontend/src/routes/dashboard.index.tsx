import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { YearViewBar } from "@/components/YearViewBar";
//import { kpis, yearSeries, patterns, risks } from "@/lib/mock-data";
import { getCurrentReportId, getFullReport } from "@/lib/api";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, Percent, Activity, Wallet, ArrowRight, AlertTriangle, ShieldCheck, Calculator, CalendarRange,ShieldAlert, } from "lucide-react";
import { YearsDropdown } from "react-day-picker";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({ meta: [{ title: "Dashboard — FDI" }, { name: "description", content: "ABC Corporation financial dashboard." }] }),
  component: Dashboard,
});

const navy = "#0B1F3A";
const gold = "#D4A017";

function buildDashboardData(report: any, selectedYear: number) {
  if (!report || !report.analytics || !report.analytics.ratios) {
    const mockYears = [2020, 2021, 2022, 2023];
    const mockSeries = [
      { year: "2018", revenue: 720, profit: 82,  assets: 1420, equity: 612, cashflow: 140, interest: 38, liabilities: 808 },
      { year: "2019", revenue: 845, profit: 95,  assets: 1535, equity: 648, cashflow: 168, interest: 41, liabilities: 887 },
      { year: "2020", revenue: 982.4, profit: 105.2, assets: 1650.3, equity: 682.1, cashflow: 198, interest: 44, liabilities: 968 },
      { year: "2021", revenue: 1004.6, profit: 121.3, assets: 1821.0, equity: 743.6, cashflow: 232, interest: 46, liabilities: 1077 },
      { year: "2022", revenue: 1107.8, profit: 140.6, assets: 2158.2, equity: 876.4, cashflow: 268, interest: 49, liabilities: 1281 },
      { year: "2023", revenue: 1245.8, profit: 162.6, assets: 2358.7, equity: 954.3, cashflow: 312, interest: 52, liabilities: 1404 },
    ];
    
    const curIdx = mockSeries.findIndex(s => Number(s.year) === selectedYear);
    const curYearData = curIdx !== -1 ? mockSeries[curIdx] : mockSeries[mockSeries.length - 1];
    const prevYearData = curIdx > 0 ? mockSeries[curIdx - 1] : curYearData;
    
    const calcChange = (cur: number, prev: number) => {
      if (!prev) return 0;
      return Math.round(((cur - prev) / prev) * 1000) / 10;
    };

    return {
      years: mockYears,
      companyName: "ABC Corporation",
      kpis: {
        revenue: { value: `$${curYearData.revenue}M`, change: calcChange(curYearData.revenue, prevYearData.revenue), series: mockSeries.slice(0, (curIdx !== -1 ? curIdx : mockSeries.length) + 1).map(s => s.revenue) },
        netProfit: { value: `$${curYearData.profit}M`, change: calcChange(curYearData.profit, prevYearData.profit), series: mockSeries.slice(0, (curIdx !== -1 ? curIdx : mockSeries.length) + 1).map(s => s.profit) },
        totalAssets: { value: `$${curYearData.assets}M`, change: calcChange(curYearData.assets, prevYearData.assets), series: mockSeries.slice(0, (curIdx !== -1 ? curIdx : mockSeries.length) + 1).map(s => s.assets) },
        cash: { value: `$${curYearData.cashflow}M`, change: calcChange(curYearData.cashflow, prevYearData.cashflow), series: mockSeries.slice(0, (curIdx !== -1 ? curIdx : mockSeries.length) + 1).map(s => s.cashflow) },
      },
      yearSeries: mockSeries,
      patterns: [
        { key: "revenue", title: "Revenue Trend", subtitle: "Increasing", delta: "+12.4%", insight: "Strong Revenue Acceleration", body: "Revenue has grown consistently over the last 4 years with an average CAGR of 12.4%.", confidence: 96, impact: "High", recommendation: "Reinforce enterprise sales motion." },
        { key: "profit",  title: "Profitability Trend", subtitle: "Margin Expansion", delta: "+2.3%", insight: "Operating Leverage Kicking In", body: "Gross margin improved YoY as unit economics improve.", confidence: 94, impact: "High", recommendation: "Lock in supplier contracts." },
        { key: "expense", title: "Expense Trend", subtitle: "Operating Cost Growth", delta: "+6.7%", insight: "Disciplined Investment", body: "Opex grew below revenue, signaling efficient scaling.", confidence: 91, impact: "Medium", recommendation: "Maintain hiring discipline." },
        { key: "cashflow",title: "Cash Flow Trend", subtitle: "Positive", delta: "+15.1%", insight: "Cash Generation Strong", body: "Operating cash flow up with DSO improvements.", confidence: 95, impact: "High", recommendation: "Initiate strategic allocations." },
      ],
      risks: [
        { key: "liquidity", label: "Liquidity Risk", level: "Low",    score: 22, items: [["Current Ratio", "1.92"], ["Quick Ratio", "1.45"], ["Cash Ratio", "0.68"]] },
        { key: "leverage",  label: "Leverage Risk",  level: "Medium", score: 54, items: [["Debt to Equity", "0.86"], ["Interest Coverage", "4.2x"], ["Debt Ratio", "46.2%"]] },
        { key: "profit",    label: "Profitability Risk", level: "Low", score: 18, items: [["Net Margin", "13.0%"], ["ROA", "7.4%"], ["ROE", "18.1%"]] },
        { key: "growth",    label: "Growth Sustainability", level: "High", score: 78, items: [["Revenue Growth", "12.4%"], ["Earnings Growth", "8.7%"], ["Volatility", "Medium"]] },
      ]
    };
  }

  const ratios = report.analytics.ratios;
  const byYear = ratios.by_year || {};
  const sortedYears = Object.keys(byYear).map(Number).filter(Number.isFinite).sort();
  
  const companyName = report.name || "Company Profile";
  
  let maxRev = 0;
  sortedYears.forEach(y => {
    const r = byYear[y]?.revenue || 0;
    if (r > maxRev) maxRev = r;
  });
  
  const divideFactor = maxRev > 1e6 ? 1e6 : (maxRev > 1e3 ? 1e3 : 1);
  const unitStr = maxRev > 1e6 ? "M" : (maxRev > 1e3 ? "K" : "");
  
  const formatVal = (val: number | null | undefined) => {
    if (val == null) return "0.0";
    return (val / divideFactor).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  const yearSeriesData = sortedYears.map(y => {
    const yData = byYear[y] || {};
    const revVal = yData.revenue || 0;
    const netIncVal = yData.net_income || 0;
    const oProfit = (yData.operating_margin || 0) * revVal;
    const interestVal = yData.interest_coverage ? (oProfit / yData.interest_coverage) : 0;
    
    return {
      year: String(y),
      revenue: Math.round((revVal / divideFactor) * 10) / 10,
      profit: Math.round((netIncVal / divideFactor) * 10) / 10,
      assets: Math.round(((yData.total_assets || 0) / divideFactor) * 10) / 10,
      equity: Math.round(((yData.total_equity || 0) / divideFactor) * 10) / 10,
      cashflow: Math.round(((yData.operating_cash_flow || 0) / divideFactor) * 10) / 10,
      interest: Math.round((interestVal / divideFactor) * 10) / 10,
      liabilities: Math.round(((yData.total_liabilities || 0) / divideFactor) * 10) / 10,
    };
  });

  const selectedYearNum = Number(selectedYear);
  const currentData = byYear[selectedYearNum] || byYear[sortedYears[sortedYears.length - 1]] || {};
  const currentIdx = sortedYears.indexOf(selectedYearNum);
  const prevYearNum = currentIdx > 0 ? sortedYears[currentIdx - 1] : null;
  const prevData = prevYearNum !== null ? byYear[prevYearNum] : {};
  
  const upToSelectedYears = sortedYears.filter(y => y <= selectedYearNum);
  const revenueSeries = upToSelectedYears.map(y => (byYear[y]?.revenue || 0) / divideFactor);
  const profitSeries = upToSelectedYears.map(y => (byYear[y]?.net_income || 0) / divideFactor);
  const assetSeries = upToSelectedYears.map(y => (byYear[y]?.total_assets || 0) / divideFactor);
  const cashSeries = upToSelectedYears.map(y => (byYear[y]?.operating_cash_flow || 0) / divideFactor);

  const calcChange = (cur: number | null | undefined, prev: number | null | undefined) => {
    if (cur == null || prev == null || prev === 0) return 0;
    return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
  };

  const kpisData = {
    revenue: {
      value: `${formatVal(currentData.revenue)}${unitStr}`,
      change: calcChange(currentData.revenue, prevData.revenue),
      series: revenueSeries.length ? revenueSeries : [0]
    },
    netProfit: {
      value: `${formatVal(currentData.net_income)}${unitStr}`,
      change: calcChange(currentData.net_income, prevData.net_income),
      series: profitSeries.length ? profitSeries : [0]
    },
    totalAssets: {
      value: `${formatVal(currentData.total_assets)}${unitStr}`,
      change: calcChange(currentData.total_assets, prevData.total_assets),
      series: assetSeries.length ? assetSeries : [0]
    },
    cash: {
      value: `${formatVal(currentData.operating_cash_flow)}${unitStr}`,
      change: calcChange(currentData.operating_cash_flow, prevData.operating_cash_flow),
      series: cashSeries.length ? cashSeries : [0]
    }
  };

  const patternsData = (report.analytics.patterns || []).map((pStr: string, idx: number) => ({
    key: `pattern-${idx}`,
    title: "AI Observation",
    subtitle: pStr.length > 25 ? pStr.substring(0, 25) + "..." : pStr,
    delta: "Insight",
    insight: pStr,
    body: `Financial pattern analysis: "${pStr}". This observation is generated dynamically by the rules engine.`,
    confidence: report.confidence?.score ? Math.round(report.confidence.score * 100) : 92,
    impact: "High",
    recommendation: "Review the related statement line items to investigate."
  }));

  const currentRatio = currentData.current_ratio || 0.0;
  const quickRatio = currentData.quick_ratio || 0.0;
  const cashRatio = currentData.cash_ratio || 0.0;
  const debtToEquity = currentData.debt_to_equity || 0.0;
  const interestCoverage = currentData.interest_coverage || 0.0;
  const debtRatio = currentData.debt_ratio || 0.0;
  const roe = currentData.return_on_equity || 0.0;
  const roa = currentData.return_on_assets || 0.0;
  const netMargin = currentData.net_profit_margin || 0.0;
  const revGrowth = currentData.revenue_growth_yoy || 0.0;
  const netProfitGrowth = currentData.net_profit_growth_yoy || 0.0;

  const risksData = [
    {
      key: "liquidity",
      label: "Liquidity Risk",
      level: currentRatio >= 1.5 ? "Low" : currentRatio >= 1.0 ? "Medium" : "High",
      score: currentRatio >= 1.5 ? 20 : currentRatio >= 1.0 ? 50 : 80,
      items: [
        ["Current Ratio", currentRatio ? currentRatio.toFixed(2) : "0.00"],
        ["Quick Ratio", quickRatio ? quickRatio.toFixed(2) : "0.00"],
        ["Cash Ratio", cashRatio ? cashRatio.toFixed(2) : "0.00"]
      ]
    },
    {
      key: "leverage",
      label: "Leverage Risk",
      level: debtRatio <= 0.4 ? "Low" : debtRatio <= 0.6 ? "Medium" : "High",
      score: Math.round(debtRatio * 100) || 30,
      items: [
        ["Debt to Equity", debtToEquity ? debtToEquity.toFixed(2) : "0.00"],
        ["Interest Coverage", interestCoverage ? interestCoverage.toFixed(1) + "x" : "0.0x"],
        ["Debt Ratio", debtRatio ? (debtRatio * 100).toFixed(1) + "%" : "0.0%"]
      ]
    },
    {
      key: "profit",
      label: "Profitability Risk",
      level: roe >= 0.12 ? "Low" : roe >= 0.06 ? "Medium" : "High",
      score: Math.max(0, Math.round(100 - (roe * 300))) || 20,
      items: [
        ["Net Margin", netMargin ? (netMargin * 100).toFixed(1) + "%" : "0.0%"],
        ["ROA", roa ? (roa * 100).toFixed(1) + "%" : "0.0%"],
        ["ROE", roe ? (roe * 100).toFixed(1) + "%" : "0.0%"]
      ]
    },
    {
      key: "growth",
      label: "Growth Sustainability",
      level: revGrowth >= 0.08 ? "Low" : revGrowth >= 0.0 ? "Medium" : "High",
      score: Math.max(0, Math.round(100 - (revGrowth * 200))) || 35,
      items: [
        ["Revenue Growth", revGrowth ? (revGrowth * 100).toFixed(1) + "%" : "0.0%"],
        ["Earnings Growth", netProfitGrowth ? (netProfitGrowth * 100).toFixed(1) + "%" : "0.0%"],
        ["Volatility", "Medium"]
      ]
    }
  ];

  return {
    years: sortedYears,
    companyName,
    kpis: kpisData,
    yearSeries: yearSeriesData,
    patterns: patternsData.length ? patternsData : [
      { key: "revenue", title: "Revenue Trend", subtitle: "Increasing", delta: "+12.4%", insight: "Strong Revenue Acceleration", body: "Revenue has grown consistently over the last 4 years with an average CAGR of 12.4%.", confidence: 96, impact: "High", recommendation: "Reinforce enterprise sales motion." }
    ],
    risks: risksData
  };
}

function Dashboard() {
  const [year, setYear] = useState(2023);
  const [report, setReport] = useState<Record<string, any> | null>(null);
  const [hasActiveReport, setHasActiveReport] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const reportId = getCurrentReportId();
    setHasActiveReport(Boolean(reportId));
    if (!reportId) return;
    setLoading(true);
    getFullReport(reportId).then((data) => {
      setReport(data);
      const years = Object.keys(data?.analytics?.ratios?.by_year || {}).map(Number).filter(Number.isFinite).sort();
      if (years.length) setYear(years[years.length - 1]);
    }).catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, []);

  const dashboardData = useMemo(() => buildDashboardData(report, year), [report, year]);
  const hasRealAnalytics = Object.keys(report?.analytics?.ratios?.by_year || {}).length > 0;
  const dashboardCompanyName = hasActiveReport && !hasRealAnalytics ? (report?.name || "Uploaded Report Batch") : dashboardData.companyName;

  return (
    <Page>
      <DashboardHeader year={year} setYear={setYear} availableYears={dashboardData.years} />

      {hasActiveReport && loading && (
        <div className="mt-8 rounded-xl border border-border bg-white px-5 py-4 text-[13px] text-muted-foreground">
          Loading finalized analysis for the uploaded report batch.
        </div>
      )}

      {hasActiveReport && !loading && !hasRealAnalytics && (
        <div className="mt-8 rounded-xl border border-border bg-white px-5 py-4 text-[13px] text-muted-foreground">
          The uploaded report batch is processing. The dashboard will switch to the finalized analysis charts when extraction, normalization, and analysis are complete.
        </div>
      )}

      {(!hasActiveReport || hasRealAnalytics) && (
        <>

      {/* KPIs */}
      <section className="mt-8">
        <SectionTitle index="1" title="Key Financial Metrics" subtitle={`Latest year · ${year}`} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Revenue" value={dashboardData.kpis.revenue.value} change={dashboardData.kpis.revenue.change} series={dashboardData.kpis.revenue.series} icon={<TrendingUp className="h-4 w-4" />} />
          <Kpi label="Net Profit" value={dashboardData.kpis.netProfit.value} change={dashboardData.kpis.netProfit.change} series={dashboardData.kpis.netProfit.series} icon={<Percent className="h-4 w-4" />} />
          <Kpi label="Total Assets" value={dashboardData.kpis.totalAssets.value} change={dashboardData.kpis.totalAssets.change} series={dashboardData.kpis.totalAssets.series} icon={<Activity className="h-4 w-4" />} />
          <Kpi label="Cash Flow" value={dashboardData.kpis.cash.value} change={dashboardData.kpis.cash.change} series={dashboardData.kpis.cash.series} icon={<Wallet className="h-4 w-4" />} />
        </div>
      </section>

      {/* Year Analysis */}
      <section className="mt-12">
        <SectionTitle index="2" title="Year Analysis" subtitle="Multi-year financial trends" cta={<Link to="/dashboard/year-analysis" className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground">View more →</Link>} />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <ChartCard title="Revenue (M)" delta="+12.4%">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dashboardData.yearSeries} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={navy} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={navy} stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EEF2F6" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTip />} />
                <Bar dataKey="revenue" fill="url(#bg)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Cash Flow (M)" delta="+15.1%">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={dashboardData.yearSeries} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={gold} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={gold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EEF2F6" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTip />} />
                <Area type="monotone" dataKey="cashflow" stroke={gold} strokeWidth={2.2} fill="url(#gold)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Interest Expense (M)" delta="+6.1%">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={dashboardData.yearSeries} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#EEF2F6" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTip />} />
                <Line type="monotone" dataKey="interest" stroke={navy} strokeWidth={2.2} dot={{ r: 3, fill: navy, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Liabilities (M)" delta="+9.6%">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={dashboardData.yearSeries} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#EEF2F6" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTip />} />
                <Line type="monotone" dataKey="liabilities" stroke={gold} strokeWidth={2.2} dot={{ r: 3, fill: gold, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      {/* Patterns */}
      <section className="mt-12">
        <SectionTitle index="3" title="Pattern Analysis" subtitle="AI-generated insights" cta={<Link to="/dashboard/patterns" className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground">View more →</Link>} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {dashboardData.patterns.map((p: any, i: number) => (
            <motion.div key={p.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="card-elevated card-elevated-hover p-5">
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--gold)]/12 text-[var(--navy)]"><TrendingUp className="h-4 w-4" /></span>
                <span className="text-[12px] font-medium text-[color:var(--success)]">{p.delta}</span>
              </div>
              <div className="mt-4 text-[12px] uppercase tracking-wider text-muted-foreground">{p.title}</div>
              <div className="mt-1 text-[15px] font-medium">{p.subtitle}</div>
              <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Confidence {p.confidence}%</span>
                <span>Impact · {p.impact}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Risks */}
      <section className="mt-12 mb-4">
        <SectionTitle index="4" title="Risk Analysis" subtitle="Multi-dimensional risk scoring" cta={<Link to="/dashboard/risk" className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground">View more →</Link>} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {dashboardData.risks.map((r) => <RiskCard key={r.key} label={r.label} level={r.level} score={r.score} items={r.items as [string, string][]} />)}
        </div>
      </section>

      {/* Drilldown nav */}
<section className="mt-12 mb-4">
  <SectionTitle
    index="4"
    title="Calculation & Analytics"
    subtitle="Financial calculations, trend analysis, patterns and risk intelligence"
    cta={
      <Link
        to="/dashboard/risk"
        className="text-sm font-medium text-primary hover:underline"
      >
        View all →
      </Link>
    }
  />

  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {[
      {
        to: "/dashboard/calculations",
        label: "Calculation Details",
        desc: "View calculated financial metrics",
        icon: Calculator,
        accent: "from-white-800 to-white",
      },
      {
        to: "/dashboard/year-analysis",
        label: "Year Analysis",
        desc: "Multi-year performance breakdown",
        icon: CalendarRange,
        accent: "from-white-800 to-white",
      },
      {
        to: "/dashboard/patterns",
        label: "Pattern Insights",
        desc: "Detect recurring financial trends",
        icon: TrendingUp,
        accent: "from-white-800 to-white",
      },
      {
        to: "/dashboard/risk",
        label: "Risk Details",
        desc: "Risk scoring and warning signals",
        icon: ShieldAlert,
        accent: "from-white-800 to-white",
      },
    ].map((item) => {
      const Icon = item.icon;

      return (
        <Link
          key={item.to}
          to={item.to}
          className={`
            group relative overflow-hidden
            rounded-2xl border-2 border-border
            bg-gradient-to-br ${item.accent}
            backdrop-blur-sm
            p-5
            transition-all duration-300
            hover:-translate-y-1
            hover:shadow-xl
            hover:border-primary/30
          `}
        >
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="mb-4 flex h-11 w-11 items-center justify-center  rounded-xl bg-background/80 shadow-sm">
                <Icon className="h-5 w-5" />
              </div>

              <h3 className="text-sm font-semibold">
                {item.label}
              </h3>

              <p className="mt-1 text-xs text-muted-foreground">
                {item.desc}
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end">
              <ArrowRight
                className="
                  h-4 w-4 text-muted-foreground
                  transition-transform duration-300
                  group-hover:translate-x-1
                "
              />
            </div>
          </div>
        </Link>
      );
    })}
  </div>
</section>
        </>
      )}
    </Page>
  );
}

function SectionTitle({ index, title, subtitle, cta }: { index: string; title: string; subtitle?: string; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Section {index}</div>
        <h2 className="mt-1 text-[22px] font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {cta}
    </div>
  );
}

function Kpi({ label, value, change, series, icon }: { label: string; value: string; change: number; series: number[]; icon: React.ReactNode }) {
  const data = series.map((v, i) => ({ i, v }));
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated card-elevated-hover relative overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[var(--gold)]/18 to-[var(--gold-soft)]/10 text-[var(--navy)] ring-1 ring-[var(--gold)]/20">{icon}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/10 px-2 py-0.5 text-[11px] font-medium text-[color:var(--success)]">↑ {change}%</span>
      </div>
      <div className="mt-5 text-[12px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-[28px] font-semibold tracking-tight">{value}</div>
      <div className="mt-3 h-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gold} stopOpacity={0.4} />
                <stop offset="100%" stopColor={gold} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={gold} strokeWidth={1.8} fill={`url(#spark-${label})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

function ChartCard({ title, delta, children }: { title: string; delta: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-5">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-medium">{title}</div>
        <span className="text-[11.5px] font-medium text-[color:var(--success)]">{delta}</span>
      </div>
      <div className="mt-3">{children}</div>
    </motion.div>
  );
}

function CustomTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-[11.5px] shadow-md">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-0.5 tabular-nums text-muted-foreground">{Number(payload[0].value).toLocaleString()}</div>
    </div>
  );
}

function RiskCard({ label, level, score, items }: { label: string; level: string; score: number; items: [string, string][] }) {
  const tone = level === "Low" ? "var(--success)" : level === "Medium" ? "var(--warning)" : "var(--error)";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated card-elevated-hover p-5">
      <div className="flex items-center justify-between">
        <div className="text-[12px] uppercase tracking-wider text-muted-foreground">{label}</div>
        {level === "High" ? <AlertTriangle className="h-4 w-4 text-[color:var(--error)]" /> : <ShieldCheck className="h-4 w-4" style={{ color: `oklch(from ${tone} l c h)` }} />}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Gauge value={score} color={tone} />
        <div>
          <div className="text-[20px] font-semibold tracking-tight">{score}</div>
          <div className="text-[11.5px] font-medium" style={{ color: tone }}>{level}</div>
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        {items.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Gauge({ value, color }: { value: number; color: string }) {
  const r = 22, c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#EEF2F6" strokeWidth="5" />
      <motion.circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: offset }} transition={{ duration: 0.9, ease: "easeOut" }} />
    </svg>
  );
}
