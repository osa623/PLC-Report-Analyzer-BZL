"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { motion } from "framer-motion";

export default function RatioNav() {
  const pathname = usePathname();
  const params = useParams();
  const symbol = typeof params?.symbol === "string" ? params.symbol : "";

  const navItems = [
    { name: "Income Statement", base: "/ratios/income" },
    { name: "Financial Position", base: "/ratios/financial_position" },
    { name: "Cash Flow", base: "/ratios/cash_flow" },
  ];

  return (
    <nav className="flex justify-center w-full mb-8 sm:mb-10 relative z-20">
      <div className="w-full max-w-[95vw] sm:max-w-fit overflow-x-auto hide-scrollbar px-2">
        <div
          className="flex items-center p-0 mx-auto min-w-max"
          style={{
            background: "#0D131A",
            border: "1px solid rgba(56,189,248,0.1)",
          }}
        >
          {navItems.map((item, index) => {
            const href = symbol ? `${item.base}/${symbol}` : item.base;
            const isActive = pathname.includes(item.base);

            return (
              <Link
                key={item.base}
                href={href}
                className="relative flex items-center gap-2 px-6 py-3 transition-all duration-150"
                style={{
                  borderRight: index < navItems.length - 1
                    ? "1px solid rgba(56,189,248,0.08)"
                    : "none",
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="ratio-nav-segment"
                    className="absolute inset-0 -z-10"
                    style={{
                      background: "rgba(56,189,248,0.08)",
                    }}
                    transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
                  />
                )}
                {isActive && (
                  <motion.div
                    layoutId="ratio-nav-accent"
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{
                      background: "#38BDF8",
                      boxShadow: "0 0 10px rgba(56,189,248,0.5)",
                    }}
                    transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
                  />
                )}
                <span
                  className={`text-[11px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-150 font-inter ${isActive ? "text-[#F1F5F9]" : "text-[#475569] hover:text-[#94A3B8]"
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
