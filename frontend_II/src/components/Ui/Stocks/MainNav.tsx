"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  FileText,
  Calculator,
  PieChart,
  TrendingUp,
} from "lucide-react";

const navSections = [
  { name: "Stock Details", base: "/stocks", icon: BarChart3, symbolPath: false },
  { name: "Report Data", base: "/report_data/income/financials", icon: FileText, symbolPath: true },
  { name: "Calculations", base: "/calculations/income", icon: Calculator, symbolPath: true },
  { name: "Ratios", base: "/ratios/income", icon: PieChart, symbolPath: true },
  { name: "Valuations", base: "/valuations", icon: TrendingUp, symbolPath: true },
];

export default function MainNav() {
  const pathname = usePathname();
  const params = useParams();
  const symbol = typeof params?.symbol === "string" ? params.symbol : "";

  return (
    <nav className="flex justify-center w-full mb-10 sm:mb-14 relative z-30">
      <div className="w-full max-w-[95vw] overflow-x-auto hide-scrollbar">
        <div
          className="flex items-center justify-center gap-0 px-0 py-0 mx-auto min-w-max"
          style={{
            background: "#0B0F16",
            border: "1px solid rgba(56,189,248,0.12)",
            boxShadow:
              "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(56,189,248,0.05)",
          }}
        >
          {navSections.map((item, index) => {
            const Icon = item.icon;
            const href =
              item.symbolPath && symbol
                ? `${item.base}/${symbol}`
                : item.base;

            const sectionRoot = item.base.split("/").slice(0, 2).join("/");
            const isActive =
              item.base === "/stocks"
                ? pathname === "/stocks"
                : pathname.startsWith(sectionRoot);

            return (
              <Link
                key={item.base}
                href={href}
                className="relative flex items-center gap-2.5 px-6 py-3.5 transition-all duration-150 group"
                style={{
                  borderRight: index < navSections.length - 1
                    ? "1px solid rgba(56,189,248,0.08)"
                    : "none",
                }}
              >
                {/* Active neon bottom bar */}
                {isActive && (
                  <motion.div
                    layoutId="main-nav-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{
                      background: "#38BDF8",
                      boxShadow: "0 0 12px rgba(56,189,248,0.6), 0 0 4px rgba(56,189,248,0.9)",
                    }}
                    transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
                  />
                )}
                {/* Active subtle bg */}
                {isActive && (
                  <motion.div
                    layoutId="main-nav-bg"
                    className="absolute inset-0 -z-10"
                    style={{
                      background: "rgba(56,189,248,0.06)",
                    }}
                    transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
                  />
                )}
                <Icon
                  size={15}
                  className={`transition-colors duration-150 ${isActive ? "text-[#38BDF8]" : "text-[#475569] group-hover:text-[#94A3B8]"
                    }`}
                />
                <span
                  className={`text-xs sm:text-[13px] font-bold tracking-widest uppercase whitespace-nowrap transition-colors duration-150 font-inter ${isActive ? "text-[#F1F5F9]" : "text-[#64748B] group-hover:text-[#94A3B8]"
                    }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
