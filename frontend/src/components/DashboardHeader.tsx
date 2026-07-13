import { ChevronDown , DownloadCloudIcon } from "lucide-react";
import { useState } from "react";
import { years } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { useCompanyStore } from "@/lib/store/company-store";

export function DashboardHeader({
  year,
  setYear,
  availableYears = years as unknown as number[],
  companyName,
}: {
  year: number;
  setYear: (y: number) => void;
  availableYears?: number[];
  companyName?: string;
}) {
  const [open, setOpen] = useState(false);
  const company = useCompanyStore((s) => s.company);

  return (
    <div className="sticky top-20 z-40 rounded-3xl bg-white border-2 min-h-32">
      <div className="relative flex flex-col lg:flex-row w-full lg:justify-between items-start gap-6 px-4 md:px-8 py-4">
        
        {/* LEFT SECTION */}
        <div className="flex flex-col sm:flex-row items-start gap-3 w-full lg:w-auto">
          
          <div className="h-16 w-24 md:h-20 md:w-32 overflow-hidden relative border-3 bg-white flex items-center justify-center">
            <img
              src={company.logo}
              className="h-full w-full object-contain scale-105"
              alt={company.companyName}
            />
          </div>

          <div className="hidden sm:flex bg-black/40 mx-2 h-20 w-0.5" />

          <div className="relative min-w-0">
            <h2 className="text-lg md:text-2xl font-bold break-words">
              {company.companyName}
            </h2>

            <h2 className="text-sm md:text-base font-thin">
              {company.ticker}
            </h2>

            <h2 className="inline-block text-xs md:text-sm px-4 rounded-r-xl bg-black/70 text-white">
              {company.sector}
            </h2>
          </div>
        </div>

        {/* RIGHT SECTION */}
        <div className="flex w-full lg:w-auto items-start justify-start lg:justify-end gap-2">
          
          <div className="relative w-full items-end lg:flex flex-col lg:w-auto">
            <div className="flex gap-2  items-endw-full">
                <button className="flex items-center gap-1 cursor-pointer px-4 py-2 text-white/60 bg-black rounded-2xl text-sm  hover:text-white transition-colors">
                    <DownloadCloudIcon className="h-3 w-3" /> Download Report
                </button>  
                <h2 className="text-xs md:text-sm px-4 py-2 object-right rounded-l-full bg-black/70 text-white inline-block">
                  Available Years
                </h2>
            </div>
            <div className="mt-3 overflow-x-auto">
              <div className="inline-flex flex-nowrap rounded-l-full border border-border bg-white p-1 min-w-max">
                {availableYears.map((y) => (
                  <button
                    key={y}
                    onClick={() => setYear(y)}
                    className={`relative rounded-full px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                      year === y
                        ? "text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {year === y && (
                      <motion.span
                        layoutId="year-pill"
                        className="absolute inset-0 rounded-full bg-gradient-to-b from-[var(--navy-2)] to-[var(--navy)]"
                      />
                    )}

                    <span className="relative">{y}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden lg:flex bg-black/40 mx-1 h-20 w-0.5" />
        </div>

        {open && (
          <div className="absolute left-0 top-12 z-50 w-56 rounded-xl border border-border bg-white p-1 shadow-lg">
            {[company.companyName].map((c) => (
              <button
                key={c}
                onClick={() => setOpen(false)}
                className="block w-full rounded-lg px-3 py-2 text-lefAt text-[13px] hover:bg-[var(--hover)]"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}