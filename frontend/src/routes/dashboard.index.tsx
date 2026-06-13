import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { kpis, yearSeries, patterns, risks } from "@/lib/mock-data";
import { getCurrentReportId, getFullReport } from "@/lib/api";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, Percent, Activity, Wallet, ArrowRight, AlertTriangle, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({ meta: [{ title: "Dashboard — FDI" }, { name: "description", content: "ABC Corporation financial dashboard." }] }),
  component: Dashboard,
});

const navy = "#0B1F3A";
const gold = "#D4A017";

function Dashboard() {
  const [year, setYear] = useState(2023);
  const [report, setReport] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    const reportId = getCurrentReportId();
    if (!reportId) return;
    getFullReport(reportId).then((data) => {
      setReport(data);
      const years = Object.keys(data?.analytics?.ratios?.by_year || {}).map(Number).filter(Number.isFinite).sort();
      if (years.length) setYear(years[years.length - 1]);
    }).catch(() => setReport(null));
  }, []);

  const dashboardData = useMemo(() => buildDashboardData(report), [report]);

  return (
    <Page>
      <DashboardHeader year={year} setYear={setYear} availableYears={dashboardData.years} companyName={dashboardData.companyName} />

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
          {dashboardData.patterns.map((p, i) => (
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
      <div className="mt-10 grid gap-3 md:grid-cols-4">
        {[
          { to: "/dashboard/calculations", label: "Calculation Details" },
          { to: "/dashboard/year-analysis", label: "Year Analysis" },
          { to: "/dashboard/patterns", label: "Pattern Insights" },
          { to: "/dashboard/risk", label: "Risk Details" },
        ].map((l) => (
          <Link key={l.to} to={l.to} className="card-elevated card-elevated-hover flex items-center justify-between p-4 text-[13.5px] font-medium">
            {l.label} <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
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
