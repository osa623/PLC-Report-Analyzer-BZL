import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { calculationRows } from "@/lib/mock-data";
import { getCurrentReportId, getFullReport, type NormalizedReportGroup } from "@/lib/api";
import { Download, ArrowUpDown, Loader2, Table2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/dashboard/calculations")({
  head: () => ({ meta: [{ title: "Calculation Details — FDI" }, { name: "description", content: "Advanced financial metrics across multiple years." }] }),
  component: CalculationsPage,
});

function CalculationsPage() {
  const [report, setReport] = useState<any>(null);
  const [hasActiveReport, setHasActiveReport] = useState(false);
  const [year, setYear] = useState(2023);
  const [loading, setLoading] = useState(false);
  const [normalizedReports, setNormalizedReports] = useState<NormalizedReportGroup[]>([]);
  const [view, setView] = useState<"statements" | "ratios">("statements");

  useEffect(() => {
    const reportId = getCurrentReportId();
    setHasActiveReport(Boolean(reportId));
    if (!reportId) return;
    setLoading(true);
    getFullReport(reportId)
      .then((data) => {
        setReport(data);
        setNormalizedReports(Array.isArray(data?.data_views?.normalized_grouped_results) ? data.data_views.normalized_grouped_results : []);
        const yearsList = Object.keys(data?.analytics?.ratios?.by_year || {}).map(Number).filter(Number.isFinite).sort();
        if (yearsList.length) setYear(yearsList[yearsList.length - 1]);
      })
      .catch(() => {
        setReport(null);
        setNormalizedReports([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const { availableYears, rows, companyName, hasRealRatios } = useMemo(() => {
    const normalizedYears = Array.from(new Set(normalizedReports.flatMap((normalizedReport) => normalizedReport.years.map((item) => Number(item.year)).filter(Number.isFinite)))).sort();

    if (!report || !report.analytics || !report.analytics.ratios) {
      return {
        availableYears: hasActiveReport ? normalizedYears : [2020, 2021, 2022, 2023],
        companyName: hasActiveReport ? "Uploaded Report Batch" : "ABC Corporation",
        rows: hasActiveReport ? [] : calculationRows,
        hasRealRatios: false,
      };
    }
    const ratios = report.analytics.ratios;
    const byYear = ratios.by_year || {};
    const yearsList = Object.keys(byYear).map(Number).filter(Number.isFinite).sort();
    
    let maxRev = 0;
    yearsList.forEach(y => {
      const r = byYear[y]?.revenue || 0;
      if (r > maxRev) maxRev = r;
    });
    const scale = maxRev > 1e6 ? 1e6 : (maxRev > 1e3 ? 1e3 : 1);
    const scaleStr = maxRev > 1e6 ? " (M)" : (maxRev > 1e3 ? " (K)" : "");

    const metricsDef = [
      { label: `Revenue${scaleStr}`, key: "revenue", isRatio: false },
      { label: `Net Profit${scaleStr}`, key: "net_income", isRatio: false },
      { label: `Total Assets${scaleStr}`, key: "total_assets", isRatio: false },
      { label: `Equity${scaleStr}`, key: "total_equity", isRatio: false },
      { label: "Current Ratio", key: "current_ratio", isRatio: true },
      { label: "ROE (%)", key: "return_on_equity", isRatio: true, multiplier: 100 },
      { label: "ROA (%)", key: "return_on_assets", isRatio: true, multiplier: 100 },
      { label: "Debt Ratio (%)", key: "debt_ratio", isRatio: true, multiplier: 100 }
    ];

    const mappedRows = metricsDef.map(def => {
      const vals = yearsList.map(y => {
        const val = byYear[y]?.[def.key];
        if (val == null) return 0;
        if (def.isRatio) {
          return Math.round(val * (def.multiplier || 1) * 100) / 100;
        } else {
          return Math.round((val / scale) * 10) / 10;
        }
      });

      let growth = 0;
      if (vals.length >= 2) {
        const last = vals[vals.length - 1];
        const prev = vals[vals.length - 2];
        if (prev !== 0) {
          growth = Math.round(((last - prev) / Math.abs(prev)) * 1000) / 10;
        }
      }

      return {
        metric: def.label,
        v: vals,
        growth: growth
      };
    });

    return {
      availableYears: yearsList,
      companyName: report.name || "Company Profile",
      rows: mappedRows,
      hasRealRatios: yearsList.length > 0,
    };
  }, [hasActiveReport, normalizedReports, report]);

  return (
    <Page>
      <DashboardHeader year={year} setYear={setYear} availableYears={availableYears} companyName={companyName} />

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Drill-down A</div>
          <h1 className="mt-1 text-[32px] font-semibold tracking-tight">Calculation Details</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{companyName} · audited financial metrics</p>
        </div>
        <button className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-[13px] font-medium hover:bg-[var(--hover)]">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      {loading && (
        <div className="mt-6 flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--navy)]" />
        </div>
      )}

      {!loading && hasActiveReport && !normalizedReports.length && !hasRealRatios && (
        <div className="mt-6 rounded-xl border border-border bg-white px-5 py-4 text-[13px] text-muted-foreground">
          The uploaded report batch is still processing. Refresh this page after extraction and analysis complete.
        </div>
      )}

      {!loading && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-border bg-white p-1">
            <button
              type="button"
              onClick={() => setView("statements")}
              className={`rounded-full px-4 py-1.5 text-[12.5px] font-medium ${view === "statements" ? "bg-[var(--navy)] text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              Statement-wise Extracted Data
            </button>
            <button
              type="button"
              onClick={() => setView("ratios")}
              className={`rounded-full px-4 py-1.5 text-[12.5px] font-medium ${view === "ratios" ? "bg-[var(--navy)] text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              Final Calculations
            </button>
          </div>
          <div className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
            <Table2 className="h-3.5 w-3.5" />
            {normalizedReports.length} normalized files
          </div>
        </div>
      )}

      {!loading && view === "statements" && (
        <div className="mt-6 grid gap-8">
          {normalizedReports.map((normalizedReport) => (
            <motion.section key={normalizedReport.source_pdf} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Annual Report</div>
                <h2 className="mt-1 text-[22px] font-semibold tracking-tight">{normalizedReport.source_pdf}</h2>
              </div>
              {normalizedReport.years.map((yearGroup) => (
                <div key={`${normalizedReport.source_pdf}-${yearGroup.year}`} className="space-y-5">
                  <h3 className="text-[17px] font-semibold tracking-tight">{yearGroup.year} Annual Report</h3>
                  {yearGroup.entities.map((entity) => (
                    <div key={`${normalizedReport.source_pdf}-${yearGroup.year}-${entity.entity}`} className="space-y-4">
                      <div className="text-[12px] uppercase tracking-wider text-muted-foreground">{entity.entity}</div>
                      {entity.statements.map((statement) => (
                        <div key={`${normalizedReport.source_pdf}-${yearGroup.year}-${entity.entity}-${statement.statement_type}`} className="card-elevated overflow-hidden">
                          <div className="border-b border-border px-5 py-3.5">
                            <div className="text-[15px] font-semibold">{statement.label}</div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[13px]">
                              <thead className="bg-[var(--surface)] text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                <tr>
                                  <th className="px-5 py-3 font-medium">Label</th>
                                  <th className="px-5 py-3 text-right font-medium">Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {statement.rows.map((row) => (
                                  <tr key={row.label} className="border-t border-border hover:bg-[var(--hover)]">
                                    <td className="px-5 py-3.5 font-mono text-[12px]">{row.label}</td>
                                    <td className="px-5 py-3.5 text-right font-medium tabular-nums">{row.display_value ?? String(row.value ?? "-")}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </motion.section>
          ))}
        </div>
      )}

      {!loading && view === "ratios" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--surface)] sticky top-0 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">Metric <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  {availableYears.map((y) => (
                    <th key={y} className={`px-5 py-3 text-right font-medium ${y === year ? "text-foreground" : ""}`}>{y}</th>
                  ))}
                  <th className="px-5 py-3 text-right font-medium">Growth (%)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.metric} className="border-t border-border hover:bg-[var(--hover)]">
                    <td className="px-5 py-3.5 font-medium">{r.metric}</td>
                    {r.v.map((val, i) => (
                      <td key={i} className={`px-5 py-3.5 text-right tabular-nums ${availableYears[i] === year ? "font-semibold" : "text-foreground/80"}`}>
                        {val.toLocaleString()}
                      </td>
                    ))}
                    <td className="px-5 py-3.5 text-right">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium ${
                        r.growth >= 0 
                          ? "bg-[var(--success)]/10 text-[color:var(--success)]" 
                          : "bg-[var(--error)]/10 text-[color:var(--error)]"
                      }`}>
                        {r.growth >= 0 ? "↑" : "↓"} {Math.abs(r.growth)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </Page>
  );
}
