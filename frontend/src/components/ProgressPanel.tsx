import { Link, useRouterState } from "@tanstack/react-router";
import { UploadCloud, Activity, Shield, LayoutGrid } from "lucide-react";

export function ProgressPanel() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Map pathways to current active step index
  const getActiveIndex = () => {
    if (pathname === "/") return 0;
    if (pathname.startsWith("/processing")) return 1;
    if (pathname.startsWith("/validation")) return 2;
    if (pathname.startsWith("/dashboard")) return 3;
    return -1; // Fallback for other pages
  };

  const activeIndex = getActiveIndex();

  const items = [
    { label: "Upload", to: "/", icon: UploadCloud },
    { label: "Processing", to: "/processing", icon: Activity },
    { label: "Validation", to: "/validation", icon: Shield },
    { label: "Dashboard", to: "/dashboard", icon: LayoutGrid },
  ] as const;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex drop-shadow-black drop-shadow-md  items-center bg-white/90 backdrop-blur-md border border-slate-500 rounded-full px-5 py-2 shadow-[0_10px_35px_-5px_rgba(15,23,42,0.1),0_4px_12px_-2px_rgba(15,23,42,0.05)] transition-all">
      {items.map((item, idx) => {
        const Icon = item.icon;
        const isActive = idx === activeIndex;

        return (
          <div key={item.label} className="flex items-center">
            {/* Nav Link Item */}
            <Link
              to={item.to}
              className={`relative flex items-center gap-2 rounded-full py-1.5 px-3.5 transition-all text-xs font-semibold ${
                isActive
                  ? "bg-black text-white"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
              }`}
            >
              {/* Blue arrow above the active pill pointing down */}
              {isActive && (
                <div className="absolute -top-[11px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-blue-600 drop-shadow-sm" />
              )}

              {/* Icon Container */}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all border ${
                  isActive
                    ? "bg-black text-white border-black"
                    : "bg-slate-50 border-slate-100 text-slate-400"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>

              {/* Label - hidden on extra-small screens */}
              <span className="hidden sm:inline transition-colors">
                {item.label}
              </span>
            </Link>

            {/* Divider lines between adjacent items */}
            {idx < items.length - 1 && (
              <div className="h-px w-6 bg-slate-150 mx-1 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
