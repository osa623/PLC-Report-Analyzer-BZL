import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { STAGES } from "@/lib/mock-data";

export function Pipeline({ stageIndex, progress }: { stageIndex: number; progress: number }) {
  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-3 h-px bg-border" />
      <motion.div
        className="absolute left-0 top-3 h-px bg-gradient-to-r from-[var(--gold)] to-[var(--gold-soft)]"
        initial={{ width: 0 }}
        animate={{ width: `${((stageIndex + progress / 100) / (STAGES.length - 1)) * 100}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ maxWidth: "100%" }}
      />
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(0,1fr))` }}>
        {STAGES.map((s, i) => {
          const done = i < stageIndex;
          const current = i === stageIndex;
          return (
            <div key={s} className="flex flex-col items-center gap-2">
              <div className="relative">
                {current && (
                  <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-[var(--gold)]/40" />
                )}
                <div className={`relative grid h-6 w-6 place-items-center rounded-full text-[10px] font-medium transition-colors ${
                  done ? "bg-[var(--gold)] text-white" :
                  current ? "bg-white ring-2 ring-[var(--gold)] text-[var(--navy)]" :
                  "bg-white ring-1 ring-border text-muted-foreground"
                }`}>
                  {done ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                </div>
              </div>
              <span className={`text-[10.5px] font-medium uppercase tracking-wider ${current || done ? "text-foreground" : "text-muted-foreground"}`}>
                {s}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
