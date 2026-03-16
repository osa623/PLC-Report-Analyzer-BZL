"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Table, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

export default function IncomeSubNav() {
  const pathname = usePathname() || "";
  const params = useParams();
  const symbol = typeof params?.symbol === "string" ? params.symbol : "";
  const suffix = symbol ? `/${symbol}` : "";

  const items = [
    { name: "Financials", path: `/report_data/income${suffix}/financials`, icon: Table },
    { name: "Graphs", path: `/report_data/income${suffix}/graphs`, icon: BarChart3 },
  ];

  return (
    <nav className="flex justify-center w-full mb-4">
      <div
        className="inline-flex items-center gap-0 p-0"
        style={{
          background: "#0B0F16",
          border: "1px solid rgba(56,189,248,0.1)",
        }}
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || pathname.startsWith(item.path);

          return (
            <Link
              key={item.name}
              href={item.path}
              className="relative flex items-center gap-2 px-5 py-2 transition-all duration-150"
              style={{
                borderRight: index < items.length - 1
                  ? "1px solid rgba(56,189,248,0.08)"
                  : "none",
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="income-sub-toggle"
                  className="absolute inset-0 -z-10"
                  style={{
                    background: "rgba(56,189,248,0.12)",
                    borderBottom: "2px solid #38BDF8",
                    boxShadow: "0 2px 8px rgba(56,189,248,0.15)",
                  }}
                  transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
                />
              )}
              <Icon
                size={13}
                className={`transition-colors duration-150 ${isActive ? "text-[#38BDF8]" : "text-[#475569]"}`}
              />
              <span
                className={`text-xs font-bold tracking-widest uppercase transition-colors duration-150 font-inter ${isActive ? "text-[#38BDF8]" : "text-[#475569] hover:text-[#94A3B8]"
                  }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
