"use client";

import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Shield, DollarSign, BarChart3, Wallet, PiggyBank } from "lucide-react";
import type { InvestmentSignalData } from "@/lib/api";

interface InvestmentSignalsProps {
  signals: InvestmentSignalData[];
}

const SIGNAL_CONFIG = {
  BULLISH: {
    color: "#4ADE80",
    bg: "rgba(74, 222, 128, 0.06)",
    border: "rgba(74, 222, 128, 0.15)",
    icon: TrendingUp,
    glow: "rgba(74, 222, 128, 0.2)",
  },
  BEARISH: {
    color: "#F87171",
    bg: "rgba(248, 113, 113, 0.06)",
    border: "rgba(248, 113, 113, 0.15)",
    icon: TrendingDown,
    glow: "rgba(248, 113, 113, 0.2)",
  },
  NEUTRAL: {
    color: "#FACC15",
    bg: "rgba(250, 204, 21, 0.06)",
    border: "rgba(250, 204, 21, 0.15)",
    icon: Minus,
    glow: "rgba(250, 204, 21, 0.2)",
  },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Revenue Momentum": BarChart3,
  "Margin Quality": DollarSign,
  "Cash Flow Health": Wallet,
  "Debt Position": Shield,
  "Dividend Signal": PiggyBank,
};

export default function InvestmentSignals({ signals }: InvestmentSignalsProps) {
  if (signals.length === 0) {
    return (
      <div className="text-center text-[#64748B] text-sm py-8">
        No investment signals available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {signals.map((signal, idx) => {
        const config = SIGNAL_CONFIG[signal.signal];
        const SignalIcon = config.icon;
        const CategoryIcon = CATEGORY_ICONS[signal.category] || BarChart3;

        return (
          <motion.div
            key={signal.category}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative group rounded-xl overflow-hidden"
            style={{
              background: config.bg,
              border: `1px solid ${config.border}`,
            }}
          >
            {/* Glow on hover */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{
                boxShadow: `inset 0 0 30px ${config.glow}`,
              }}
            />

            <div className="relative p-5 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: config.bg, border: `1px solid ${config.border}` }}
                  >
                    <CategoryIcon className="w-4 h-4" style={{ color: config.color }} />
                  </div>
                  <span className="text-sm font-medium text-gray-300">{signal.category}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <SignalIcon className="w-4 h-4" style={{ color: config.color }} />
                  <span
                    className="text-xs font-bold tracking-wider uppercase"
                    style={{ color: config.color }}
                  >
                    {signal.signal}
                  </span>
                </div>
              </div>

              {/* Strength meter */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">Strength</span>
                  <span
                    className="text-xs font-bold font-jetbrains"
                    style={{ color: config.color }}
                  >
                    {(signal.strength * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#0B0F16]/80 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: config.color }}
                    initial={{ width: "0%" }}
                    animate={{ width: `${signal.strength * 100}%` }}
                    transition={{ delay: idx * 0.08 + 0.3, duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-gray-400 leading-relaxed">{signal.description}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
