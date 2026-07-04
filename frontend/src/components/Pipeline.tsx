import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

export function Pipeline({
  stageIndex,
  progress,
  stages = ["Upload", "Parsing", "Structure", "Extraction"],
  status = "running"
}: {
  stageIndex: number;
  progress: number;
  stages?: string[];
  status?: string;
}) {
  const safeIndex = Math.max(0, Math.min(stageIndex, stages.length - 1));
  const isFailed = status.toLowerCase() === "failed";
  const isCompleted = status.toLowerCase() === "completed";

  return (
    <div className="relative w-full">
      {/* Connector lines segments background */}
      <div className="absolute left-[12.5%] right-[12.5%] top-4 h-[2px] bg-slate-150" style={{ zIndex: 1 }} />

      {/* Colored active segments */}
      <div className="absolute left-[12.5%] right-[12.5%] top-4 h-[2px]" style={{ zIndex: 2 }}>
        <div className="relative w-full h-full">
          {stages.slice(0, -1).map((_, i) => {
            // Segment connects circle i to circle i+1
            // Segment is active (green) if the next stage (i+1) is completed or is current (and not failed)
            const nextStageDone = i < safeIndex;
            const nextStageCurrent = i === safeIndex && !isFailed;
            const active = nextStageDone || nextStageCurrent;

            const width = 100 / (stages.length - 1);
            const left = i * width;

            return (
              <div
                key={i}
                className={`absolute top-0 h-full transition-colors duration-500 ${
                  active ? "bg-green-500" : "bg-slate-150"
                }`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0,1fr))`, zIndex: 10 }}>
        {stages.map((s, i) => {
          const isStageDone = i < safeIndex || (isCompleted && i === safeIndex);
          const isStageFailed = isFailed && i === safeIndex;
          const isStageCurrent = i === safeIndex && !isFailed && !isCompleted;
          const isStagePending = i > safeIndex;

          let circleStyle = "";
          let labelText = "";
          let labelStyle = "";

          if (isStageDone) {
            circleStyle = "bg-green-500 text-white border-green-500";
            labelText = "Completed";
            labelStyle = "text-green-600 font-semibold";
          } else if (isStageFailed) {
            circleStyle = "bg-red-500 text-white border-red-500";
            labelText = "Failed";
            labelStyle = "text-red-500 font-semibold";
          } else if (isStageCurrent) {
            circleStyle = "bg-white border-2 border-orange-500 text-orange-600 font-semibold";
            labelText = "In Progress";
            labelStyle = "text-orange-600 font-semibold";
          } else {
            // Pending
            circleStyle = "bg-white border border-slate-200 text-slate-400";
            labelText = "Pending";
            labelStyle = "text-slate-400";
          }

          return (
            <div key={s} className="flex flex-col items-center gap-1.5">
              <div className="relative">
                {isStageCurrent && (
                  <span className="absolute inset-0 -m-1.5 animate-ping rounded-full bg-orange-500/25" />
                )}
                <div
                  className={`relative grid h-8 w-8 place-items-center rounded-full text-xs transition-all duration-300 border ${circleStyle}`}
                >
                  {isStageDone ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : isStageFailed ? (
                    <X className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="text-[11.5px] font-bold text-slate-800 tracking-tight">
                  {s}
                </span>
                <span className={`text-[10px] ${labelStyle}`}>
                  {labelText}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
