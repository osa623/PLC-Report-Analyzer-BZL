import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { years } from "@/lib/mock-data";
import { motion } from "framer-motion";

export function DashboardHeader({ year, setYear }: { year: number; setYear: (y: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-[15px] font-medium hover:bg-[var(--hover)]">
          ABC Corporation <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
        {open && (
          <div className="absolute left-0 top-12 z-10 w-56 rounded-xl border border-border bg-white p-1 shadow-lg">
            {["ABC Corporation", "Helios Industries", "Northwind Capital"].map((c) => (
              <button key={c} onClick={() => setOpen(false)} className="block w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-[var(--hover)]">{c}</button>
            ))}
          </div>
        )}
      </div>
      <div className="inline-flex rounded-full border border-border bg-white p-1">
        {years.map((y) => (
          <button key={y} onClick={() => setYear(y)} className={`relative rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${year === y ? "text-white" : "text-muted-foreground hover:text-foreground"}`}>
            {year === y && <motion.span layoutId="year-pill" className="absolute inset-0 rounded-full bg-gradient-to-b from-[var(--navy-2)] to-[var(--navy)]" />}
            <span className="relative">{y}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
