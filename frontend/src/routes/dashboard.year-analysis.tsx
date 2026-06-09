import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { yearSeries } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/dashboard/year-analysis")({
  head: () => ({ meta: [{ title: "Year Analysis — FDI" }, { name: "description", content: "Multi-year financial trends and growth analytics." }] }),
  component: YearPage,
});

const navy = "#0B1F3A";
const gold = "#D4A017";

const series: { key: keyof (typeof yearSeries)[number]; label: string; color: string }[] = [
  { key: "revenue", label: "Revenue Growth", color: navy },
  { key: "profit", label: "Profit Growth", color: gold },
  { key: "assets", label: "Asset Growth", color: navy },
  { key: "cashflow", label: "Cash Flow Growth", color: gold },
];

function YearPage() {
  const [year, setYear] = useState(2023);
  return (
    <Page>
      <DashboardHeader year={year} setYear={setYear} />
      <div className="mt-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Drill-down B</div>
        <h1 className="mt-1 text-[32px] font-semibold tracking-tight">Year Analysis</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Premium charts with full interactivity</p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {series.map((s, i) => (
          <motion.div key={s.key as string} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-elevated p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium">{s.label}</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">2018 — 2023</div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                <span className="text-muted-foreground">{s.label}</span>
              </div>
            </div>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={yearSeries} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`g-${s.key as string}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }} />
                  <Area type="monotone" dataKey={s.key as string} stroke={s.color} strokeWidth={2.2} fill={`url(#g-${s.key as string})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        ))}
      </div>
    </Page>
  );
}
