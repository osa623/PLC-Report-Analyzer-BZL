import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { patterns } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { useState } from "react";
import { Sparkles, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/dashboard/patterns")({
  head: () => ({ meta: [{ title: "Pattern Insights — FDI" }, { name: "description", content: "AI-generated financial pattern insights." }] }),
  component: PatternsPage,
});

function PatternsPage() {
  const [year, setYear] = useState(2023);
  return (
    <Page>
      <DashboardHeader year={year} setYear={setYear} />
      <div className="mt-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Drill-down C</div>
        <h1 className="mt-1 text-[32px] font-semibold tracking-tight">Pattern Analysis</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">AI insights · observations, impact and recommendations</p>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {patterns.map((p, i) => (
          <motion.article
            key={p.key}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="card-elevated card-elevated-hover relative overflow-hidden p-7"
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(212,160,23,0.18),transparent_70%)]" />
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)]/15 px-2.5 py-1 text-[11px] font-medium text-[color:var(--navy)]">
                <Sparkles className="h-3 w-3 text-[var(--gold)]" /> AI Insight
              </span>
              <span className="text-[11px] text-muted-foreground">Confidence {p.confidence}%</span>
            </div>
            <h3 className="mt-4 text-[22px] font-semibold tracking-tight">{p.insight}</h3>
            <p className="mt-2 max-w-prose text-[13.5px] leading-relaxed text-muted-foreground">{p.body}</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Block title="Observation" body={`${p.title}: ${p.subtitle} (${p.delta})`} />
              <Block title="Business Impact" body={`${p.impact} — directly affects valuation and capital allocation.`} />
              <Block title="Trend Score" body={`${(80 + i * 3)}/100 strength signal`} />
              <Block title="Recommendation" body={p.recommendation} />
            </div>
          </motion.article>
        ))}
      </div>
    </Page>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <TrendingUp className="h-3 w-3" /> {title}
      </div>
      <div className="mt-1.5 text-[13px] text-foreground">{body}</div>
    </div>
  );
}
