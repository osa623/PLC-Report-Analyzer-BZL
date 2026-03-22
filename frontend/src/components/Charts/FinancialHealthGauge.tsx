"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { FinancialHealthScore } from "@/lib/api";

interface FinancialHealthGaugeProps {
  healthScore: FinancialHealthScore;
  height?: number;
}

export default function FinancialHealthGauge({ healthScore, height = 320 }: FinancialHealthGaugeProps) {
  const option = useMemo(() => {
    const score = healthScore.overall_score;

    return {
      backgroundColor: "transparent",
      series: [
        // Main gauge
        {
          type: "gauge",
          center: ["50%", "60%"],
          radius: "85%",
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          splitNumber: 10,
          itemStyle: {
            color: {
              type: "linear",
              x: 0, y: 1, x2: 1, y2: 1,
              colorStops: [
                { offset: 0, color: "#F87171" },
                { offset: 0.4, color: "#FACC15" },
                { offset: 0.7, color: "#4ADE80" },
                { offset: 1, color: "#22D3EE" },
              ],
            },
          },
          progress: {
            show: true,
            width: 18,
            roundCap: true,
          },
          pointer: {
            show: true,
            length: "60%",
            width: 5,
            itemStyle: {
              color: "#F1F5F9",
              shadowColor: "rgba(56, 189, 248, 0.5)",
              shadowBlur: 8,
            },
          },
          axisLine: {
            lineStyle: {
              width: 18,
              color: [[1, "rgba(255,255,255,0.06)"]],
            },
            roundCap: true,
          },
          axisTick: {
            distance: -28,
            splitNumber: 5,
            lineStyle: { width: 1, color: "rgba(255,255,255,0.1)" },
          },
          splitLine: {
            distance: -32,
            length: 10,
            lineStyle: { width: 2, color: "rgba(255,255,255,0.15)" },
          },
          axisLabel: {
            distance: -18,
            color: "#475569",
            fontSize: 9,
            fontFamily: "'Inter', sans-serif",
            formatter: (v: number) => {
              if (v === 0) return "0";
              if (v === 25) return "25";
              if (v === 50) return "50";
              if (v === 75) return "75";
              if (v === 100) return "100";
              return "";
            },
          },
          detail: {
            valueAnimation: true,
            width: "60%",
            lineHeight: 40,
            borderRadius: 8,
            offsetCenter: [0, "5%"],
            fontSize: 32,
            fontWeight: "bold",
            fontFamily: "'JetBrains Mono', monospace",
            formatter: `{value}`,
            color: score >= 70 ? "#4ADE80" : score >= 40 ? "#FACC15" : "#F87171",
          },
          data: [{ value: Math.round(score) }],
          title: {
            offsetCenter: [0, "35%"],
            fontSize: 12,
            color: "#64748B",
            fontFamily: "'Inter', sans-serif",
          },
          anchor: {
            show: true,
            size: 12,
            itemStyle: {
              color: "#131B2C",
              borderColor: "#38BDF8",
              borderWidth: 2,
            },
          },
        },
      ],
    };
  }, [healthScore]);

  // Sub-scores display
  const subScores = [
    { label: "Profitability", value: healthScore.profitability_score, color: "#4ADE80" },
    { label: "Growth", value: healthScore.growth_score, color: "#38BDF8" },
    { label: "Liquidity", value: healthScore.liquidity_score, color: "#FACC15" },
    { label: "Efficiency", value: healthScore.efficiency_score, color: "#A78BFA" },
    { label: "Stability", value: healthScore.stability_score, color: "#22D3EE" },
  ];

  return (
    <div>
      <ReactECharts
        option={option}
        style={{ height: `${height}px`, width: "100%" }}
        opts={{ renderer: "canvas" }}
      />
      <div className="grid grid-cols-5 gap-2 px-4 -mt-4">
        {subScores.map((s) => (
          <div key={s.label} className="text-center">
            <div
              className="text-sm font-bold font-jetbrains"
              style={{ color: s.color }}
            >
              {Math.round(s.value)}
            </div>
            <div className="text-[10px] text-[#64748B] mt-0.5">{s.label}</div>
            <div className="mt-1 h-1 rounded-full bg-[#131B2C] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(s.value, 100)}%`,
                  backgroundColor: s.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
