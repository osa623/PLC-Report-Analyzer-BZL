import { Link } from "@tanstack/react-router";

import {
  UploadCloud,
  Activity,
  Shield,
  LayoutGrid,
} from "lucide-react";

export function ProgressPanel() {
  const pathname = usePathname();

  const getActiveIndex = () => {
    if (pathname === "/") return 0;
    if (pathname.startsWith("/processing")) return 1;
    if (pathname.startsWith("/validation")) return 2;
    if (pathname.startsWith("/dashboard")) return 3;

    return -1;
  };

  const activeIndex = getActiveIndex();

  const items = [
    { label: "Upload", href: "/", icon: UploadCloud },
    { label: "Processing", href: "/", icon: Activity },
    { label: "Validation", href: "/", icon: Shield },
    { label: "Dashboard", href: "/", icon: LayoutGrid },
  ] as const;

  return (
    <div className="flex z-50 items-center bg-white/90 backdrop-blur-md border-double border-4 border-slate-500 rounded-full px-5 py-2 shadow-[0_10px_35px_-5px_rgba(15,23,42,0.1),0_4px_12px_-2px_rgba(15,23,42,0.05)] transition-all">
     {/* {items.map((item, idx) => {
        const Icon = item.icon;
        const isActive = idx === activeIndex;

        return (
          <div key={item.label} className="flex items-center">
            <Link
              href={item.href}
              className={`relative flex items-center gap-2 rounded-full   transition-all text-xs font-semibold ${
                isActive
                  ? "bg-[#0D1325] text-white"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
              }`}
            >
              {isActive && (
                <div className="absolute -top-[11px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-blue-600 drop-shadow-sm" />
              )}

 

              <span className="hidden p-2 px-4 sm:inline">
                {item.label}
              </span>
            </Link>

            {idx < items.length - 1 && (
              <div className="h-px w-4 bg-slate-200 mx-1 shrink-0" />
            )}
          </div>
        );
      })} */}

     <div className="relative items-center min-w-lg py-1 gap-4">
                          <Link
                            href={''}
                            className="px-4 py-2 flex top-0 relative rounded-full w-[10.8rem] text-nowrap  text-sm cursor-pointer z-40 font-encode font-medium bg-white"
                          >
                           Company Analyzer
                          </Link>
                           <Link
                            href={''}
                            className="px-4 py-2 absolute top-1 rounded-full w-full  flex text-sm cursor-pointer z-30 font-encode font-medium bg-gradient-to-r from-[#0D1325] via-[#2d4373] to-[#0D1325]"
                          >
                           Company Analyzer
                          </Link>
                          <h2 className="text-xs font-encode font-medium text-[#0D1325]">
                            </h2>
                           <Link
                            href={''}
                            className="px-4 py-2 absolute top-1 text-sm z-50 cursor-pointer  font-encode font-medium bg-gradient-to-r from-[#0D1325] via-[#2d4373] to-[#0D1325] text-white rounded-full hover:shadow-lg hover:shadow-[#B28D41]/30 transition-all duration-300 hover:scale-105"
                          >
                           Company Analyzer
                          </Link>
                          <h2 className="text-xs font-encode font-medium text-[#0D1325]">
                            </h2>
     </div>   
    </div>
  );
}