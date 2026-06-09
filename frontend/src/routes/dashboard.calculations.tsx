import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { calculationRows, years } from "@/lib/mock-data";
import { Download, ArrowUpDown } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/calculations")({
  head: () => ({ meta: [{ title: "Calculation Details — FDI" }, { name: "description", content: "Advanced financial metrics across multiple years." }] }),
  component: CalculationsPage,
});

function CalculationsPage() {
  const [year, setYear] = useState(2023);
  return (
    <Page>
      <DashboardHeader year={year} setYear={setYear} />

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Drill-down A</div>
          <h1 className="mt-1 text-[32px] font-semibold tracking-tight">Calculation Details</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">ABC Corporation · audited financial metrics</p>
        </div>
        <button className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-[13px] font-medium hover:bg-[var(--hover)]">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--surface)] sticky top-0 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">
                  <span className="inline-flex items-center gap-1.5">Metric <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                {years.map((y) => (
                  <th key={y} className={`px-5 py-3 text-right font-medium ${y === year ? "text-foreground" : ""}`}>{y}</th>
                ))}
                <th className="px-5 py-3 text-right font-medium">Growth (%)</th>
              </tr>
            </thead>
            <tbody>
              {calculationRows.map((r) => (
                <tr key={r.metric} className="border-t border-border hover:bg-[var(--hover)]">
                  <td className="px-5 py-3.5 font-medium">{r.metric}</td>
                  {r.v.map((val, i) => (
                    <td key={i} className={`px-5 py-3.5 text-right tabular-nums ${years[i] === year ? "font-semibold" : "text-foreground/80"}`}>
                      {val.toLocaleString()}
                    </td>
                  ))}
                  <td className="px-5 py-3.5 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/10 px-2 py-0.5 text-[11.5px] font-medium text-[color:var(--success)]">↑ {r.growth}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </Page>
  );
}
