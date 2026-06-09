import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { risks, yearSeries } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { useState } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Line, LineChart, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/dashboard/risk")({
  head: () => ({ meta: [{ title: "Risk Analysis — FDI" }, { name: "description", content: "Comprehensive risk scoring dashboard." }] }),
  component: RiskPage,
});

const navy = "#0B1F3A";
const gold = "#D4A017";

function RiskPage() {
  const [year, setYear] = useState(2023);
  const radarData = risks.map((r) => ({ name: r.label.replace(" Risk", "").replace(" Sustainability", ""), score: r.score }));
  const trend = yearSeries.map((y) => ({ year: y.year, leverage: Math.round(40 + (y.liabilities / y.assets) * 30), liquidity: Math.round(40 - (y.cashflow / 12)) }));

  return (
    <Page>
      <DashboardHeader year={year} setYear={setYear} />
      <div className="mt-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Drill-down D</div>
        <h1 className="mt-1 text-[32px] font-semibold tracking-tight">Risk Analysis</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Multi-dimensional risk scoring · trends · recommendations</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {risks.map((r, i) => {
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
              <LineChart data={trend} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
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
            "Maintain a minimum 0.7 cash ratio buffer through Q3 to absorb working-capital swings.",
            "Diversify revenue concentration: top-5 customers represent 42% of total revenue.",
            "Initiate quarterly stress testing covering 15% revenue downside scenarios.",
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
              <span className="text-foreground/85">{t}</span>
            </li>
          ))}
        </ul>
      </motion.div>
    </Page>
  );
}
