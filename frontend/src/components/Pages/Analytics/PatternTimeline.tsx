"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, TrendingUp, AlertTriangle, Activity, Clock } from "lucide-react";

interface PatternItem {
  pattern_type: string;
  description: string;
  confidence: number;
  year?: number;
}

interface PatternTimelineProps {
  patterns: PatternItem[];
}

const TYPE_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  revenue_growth: { color: "#4ADE80", icon: TrendingUp },
  profit_growth: { color: "#4ADE80", icon: TrendingUp },
  consistent_performance: { color: "#4ADE80", icon: TrendingUp },
  revenue_decline: { color: "#F87171", icon: AlertTriangle },
  margin_compression: { color: "#F87171", icon: AlertTriangle },
  liquidity_risk: { color: "#F87171", icon: AlertTriangle },
  earnings_quality_issue: { color: "#F87171", icon: AlertTriangle },
  segment_decline: { color: "#F87171", icon: AlertTriangle },
  expense_spike: { color: "#FB923C", icon: AlertTriangle },
  cost_increase: { color: "#FB923C", icon: AlertTriangle },
  weak_signal: { color: "#FACC15", icon: Activity },
};

const DEFAULT_CONFIG = { color: "#38BDF8", icon: Activity };

export default function PatternTimeline({ patterns }: PatternTimelineProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (patterns.length === 0) {
    return (
      <div className="text-center text-[#64748B] text-sm py-8">
        No patterns detected
      </div>
    );
  }

  // Sort by confidence descending
  const sorted = [...patterns].sort((a, b) => b.confidence - a.confidence);

  return (
    <div className="relative pl-8">
      {/* Vertical line */}
      <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gradient-to-b from-[#38BDF8]/30 via-[#38BDF8]/10 to-transparent" />

      <div className="space-y-4">
        {sorted.map((pattern, idx) => {
          const config = TYPE_CONFIG[pattern.pattern_type] || DEFAULT_CONFIG;
          const Icon = config.icon;
          const isExpanded = expandedIdx === idx;

          return (
            <motion.div
              key={`${pattern.pattern_type}-${idx}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.35 }}
              className="relative"
            >
              {/* Timeline dot */}
              <div
                className="absolute -left-8 top-4 w-[11px] h-[11px] rounded-full border-2"
                style={{
                  borderColor: config.color,
                  backgroundColor: isExpanded ? config.color : "#0B0F16",
                  boxShadow: `0 0 8px ${config.color}40`,
                }}
              />

              {/* Card */}
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                className="w-full text-left rounded-lg border transition-all duration-300 hover:border-opacity-30"
                style={{
                  background: isExpanded ? `${config.color}08` : "rgba(11, 15, 22, 0.4)",
                  borderColor: isExpanded ? `${config.color}30` : "rgba(56, 189, 248, 0.06)",
                }}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0" style={{ color: config.color }} />
                      <span className="text-sm font-medium text-gray-200">
                        {pattern.pattern_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {pattern.year && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {pattern.year}
                        </span>
                      )}
                      <span
                        className="text-xs font-bold font-jetbrains px-2 py-0.5 rounded"
                        style={{
                          color: config.color,
                          background: `${config.color}15`,
                        }}
                      >
                        {(pattern.confidence * 100).toFixed(0)}%
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <p className="text-xs text-gray-400 leading-relaxed mt-3 pt-3 border-t border-[#38BDF8]/5">
                          {pattern.description}
                        </p>

                        {/* Confidence bar */}
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider text-gray-500">Confidence</span>
                          <div className="flex-1 h-1 rounded-full bg-[#131B2C] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pattern.confidence * 100}%`,
                                backgroundColor: config.color,
                              }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
