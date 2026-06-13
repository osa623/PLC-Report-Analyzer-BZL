import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { risks as mockRisks } from "@/lib/mock-data";
import { getCurrentReportId, getFullReport } from "@/lib/api";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Line, LineChart, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/dashboard/risk")({
  head: () => ({ meta: [{ title: "Risk Analysis — FDI" }, { name: "description", content: "Comprehensive risk scoring dashboard." }] }),
  component: RiskPage,
});

const navy = "#0B1F3A";
const gold = "#D4A017";

function RiskPage() {
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
      const years = Object.keys(data?.analytics?.ratios?.by_year || {}).map(Number).filter(Number.isFinite).sort();
      if (years.length) setYear(years[years.length - 1]);
    }).catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, []);
  const hasRealAnalytics = Object.keys(report?.analytics?.ratios?.by_year || {}).length > 0;

  const { availableYears, activeRisks, radarData, trendData, companyName } = useMemo(() => {
    if (!report || !report.analytics || !report.analytics.ratios) {
      const radar = mockRisks.map((r) => ({ name: r.label.replace(" Risk", "").replace(" Sustainability", ""), score: r.score }));
      const mockTrend = [2019, 2020, 2021, 2022, 2023].map((y, i) => ({ year: String(y), leverage: 40 + i * 2, liquidity: 45 - i * 3 }));
      return {
        availableYears: [2020, 2021, 2022, 2023],
        companyName: "ABC Corporation",
        activeRisks: mockRisks,
        radarData: radar,
        trendData: mockTrend
      };
    }

    const ratios = report.analytics.ratios;
    const byYear = ratios.by_year || {};
    const yearsList = Object.keys(byYear).map(Number).filter(Number.isFinite).sort();
    
    const yData = byYear[year] || byYear[yearsList[yearsList.length - 1]] || {};
    
    const currentRatio = yData.current_ratio || 0.0;
    const quickRatio = yData.quick_ratio || 0.0;
    const cashRatio = yData.cash_ratio || 0.0;
    
    const debtToEquity = yData.debt_to_equity || 0.0;
    const interestCoverage = yData.interest_coverage || 0.0;
    const debtRatio = yData.debt_ratio || 0.0;

    const netMargin = yData.net_profit_margin || 0.0;
    const roa = yData.return_on_assets || 0.0;
    const roe = yData.return_on_equity || 0.0;

    const revGrowth = yData.revenue_growth_yoy || 0.0;
    const netProfitGrowth = yData.net_profit_growth_yoy || 0.0;

    const liquidityScore = currentRatio >= 1.5 ? 20 : currentRatio >= 1.0 ? 50 : 80;
    const leverageScore = Math.min(100, Math.round(debtRatio * 100)) || 30;
    const profitScore = Math.max(0, Math.min(100, Math.round(100 - (roe * 300)))) || 20;
    const growthScore = Math.max(0, Math.min(100, Math.round(100 - (revGrowth * 200)))) || 35;

    const calculatedRisks = [
      {
        key: "liquidity",
        label: "Liquidity Risk",
        level: liquidityScore < 33 ? "Low" : liquidityScore < 66 ? "Medium" : "High",
        score: liquidityScore,
        items: [
          ["Current Ratio", currentRatio ? currentRatio.toFixed(2) : "0.00"],
          ["Quick Ratio", quickRatio ? quickRatio.toFixed(2) : "0.00"],
          ["Cash Ratio", cashRatio ? cashRatio.toFixed(2) : "0.00"]
        ]
      },
      {
        key: "leverage",
        label: "Leverage Risk",
        level: leverageScore < 33 ? "Low" : leverageScore < 66 ? "Medium" : "High",
        score: leverageScore,
        items: [
          ["Debt to Equity", debtToEquity ? debtToEquity.toFixed(2) : "0.00"],
          ["Interest Coverage", interestCoverage ? interestCoverage.toFixed(1) + "x" : "0.0x"],
          ["Debt Ratio", debtRatio ? (debtRatio * 100).toFixed(1) + "%" : "0.0%"]
        ]
      },
      {
        key: "profit",
        label: "Profitability Risk",
        level: profitScore < 33 ? "Low" : profitScore < 66 ? "Medium" : "High",
        score: profitScore,
        items: [
          ["Net Margin", netMargin ? (netMargin * 100).toFixed(1) + "%" : "0.0%"],
          ["ROA", roa ? (roa * 100).toFixed(1) + "%" : "0.0%"],
          ["ROE", roe ? (roe * 100).toFixed(1) + "%" : "0.0%"]
        ]
      },
      {
        key: "growth",
        label: "Growth Sustainability",
        level: growthScore < 33 ? "Low" : growthScore < 66 ? "Medium" : "High",
        score: growthScore,
        items: [
          ["Revenue Growth", revGrowth ? (revGrowth * 100).toFixed(1) + "%" : "0.0%"],
          ["Earnings Growth", netProfitGrowth ? (netProfitGrowth * 100).toFixed(1) + "%" : "0.0%"],
          ["Volatility", "Medium"]
        ]
      }
    ];

    const radar = calculatedRisks.map((r) => ({
      name: r.label.replace(" Risk", "").replace(" Sustainability", ""),
      score: r.score
    }));

    const trend = yearsList.map(y => {
      const yearData = byYear[y] || {};
      const dRatio = yearData.debt_ratio || 0.0;
      const cRatio = yearData.current_ratio || 0.0;
      return {
        year: String(y),
        leverage: Math.round(dRatio * 100),
        liquidity: Math.min(100, Math.round(cRatio * 35))
      };
    });

    return {
      availableYears: yearsList,
      companyName: report.name || "Company Profile",
      activeRisks: calculatedRisks,
      radarData: radar,
      trendData: trend
    };
  }, [report, year]);

  return (
    <Page>
      <DashboardHeader year={year} setYear={setYear} availableYears={availableYears} companyName={companyName} />
      <div className="mt-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Drill-down D</div>
        <h1 className="mt-1 text-[32px] font-semibold tracking-tight">Risk Analysis</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{companyName} · risk scores & profile</p>
      </div>

      {loading && (
        <div className="mt-6 flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--navy)]" />
        </div>
      )}

      {!loading && hasActiveReport && !hasRealAnalytics && (
        <div className="mt-8 rounded-xl border border-border bg-white px-5 py-4 text-[13px] text-muted-foreground">
          Finalized risk analysis is still processing for the uploaded report batch.
        </div>
      )}

      {!loading && (!hasActiveReport || hasRealAnalytics) && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {activeRisks.map((r, i) => {
              const tone = r.level === "Low" ? "var(--success)" : r.level === "Medium" ? "var(--warning)" : "var(--error)";
              return (
                <motion.div key={r.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-elevated p-5">
                  <div className="text-[12px] uppercase tracking-wider text-muted-foreground">{r.label}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <div className="text-[28px] font-semibold tracking-tight">{r.score}</div>
                    <span className="text-[12px] font-medium" style={{ color: tone }}>{r.level}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--hover)]">
                    <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${r.score}%` }} transition={{ duration: 0.8 }} style={{ background: tone }} />
                  </div>
                  <div className="mt-4 space-y-1.5">
                    {r.items.map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-[12px]">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-medium tabular-nums">{v}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-6">
              <div className="text-[13px] font-medium">Risk Profile</div>
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#E2E8F0" />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} />
                    <Radar dataKey="score" stroke={navy} fill={gold} fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-6">
              <div className="text-[13px] font-medium">Risk Trend (5Y)</div>
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="#EEF2F6" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }} />
                    <Line type="monotone" dataKey="leverage" stroke={gold} strokeWidth={2.2} dot={{ r: 3, fill: gold, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="liquidity" stroke={navy} strokeWidth={2.2} dot={{ r: 3, fill: navy, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated mt-6 p-6">
            <div className="text-[13px] font-medium">Recommendations</div>
            <ul className="mt-3 space-y-2.5 text-[13.5px]">
              {[
                "Refinance long-term debt while rates are favorable to reduce leverage exposure.",
                "Maintain a minimum cash ratio buffer to absorb working-capital swings.",
                "Verify and audit accounting red flags and rule anomalies from validation logs.",
                "Initiate quarterly stress testing covering downside macroeconomic scenarios."
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
                  <span className="text-foreground/85">{t}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </>
      )}
    </Page>
  );
}
