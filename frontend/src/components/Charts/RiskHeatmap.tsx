"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";

interface RiskHeatmapProps {
  heatmapData: Record<string, Record<number, number>>;
  height?: number;
}

const DISPLAY_NAMES: Record<string, string> = {
  revenue_decline: "Revenue Decline",
  margin_compression: "Margin Compression",
  liquidity_risk: "Liquidity Risk",
  earnings_quality_issue: "Earnings Quality",
  segment_decline: "Segment Decline",
  expense_spike: "Expense Spike",
  cost_increase: "Cost Increase",
  weak_signal: "Weak Signal",
  revenue_growth: "Revenue Growth",
  profit_growth: "Profit Growth",
  consistent_performance: "Consistent Perf.",
};

export default function RiskHeatmap({ heatmapData, height = 350 }: RiskHeatmapProps) {
  const option = useMemo(() => {
    const categories = Object.keys(heatmapData);
    if (categories.length === 0) return {};

    const allYears = Array.from(
      new Set(categories.flatMap((c) => Object.keys(heatmapData[c]).map(Number)))
    ).sort();

    const data: [number, number, number][] = [];
    for (let yIdx = 0; yIdx < categories.length; yIdx++) {
      const cat = categories[yIdx];
      for (let xIdx = 0; xIdx < allYears.length; xIdx++) {
        const year = allYears[xIdx];
        const val = heatmapData[cat][year] ?? 0;
        data.push([xIdx, yIdx, +(val * 100).toFixed(0)]);
      }
    }

    return {
      backgroundColor: "transparent",
      grid: { left: "20%", right: "8%", top: "8%", bottom: "15%", containLabel: false },
      tooltip: {
        backgroundColor: "rgba(10, 17, 40, 0.95)",
        borderColor: "#38BDF8",
        borderWidth: 1,
        textStyle: { color: "#E2E8F0", fontSize: 12, fontFamily: "'Inter', sans-serif" },
        formatter: (params: { value: [number, number, number] }) => {
          const [xIdx, yIdx, val] = params.value;
          const year = allYears[xIdx];
          const cat = categories[yIdx];
          const displayName = DISPLAY_NAMES[cat] || cat.replace(/_/g, " ");
          return `<b>${displayName}</b><br/>Year: ${year}<br/>Confidence: ${val}%`;
        },
      },
      xAxis: {
        type: "category",
        data: allYears.map(String),
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
        axisTick: { show: false },
        axisLabel: { color: "#64748B", fontSize: 11, fontFamily: "'Inter', sans-serif" },
        splitArea: { show: false },
      },
      yAxis: {
        type: "category",
        data: categories.map(
          (c) => DISPLAY_NAMES[c] || c.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())
        ),
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
        axisTick: { show: false },
        axisLabel: { color: "#94A3B8", fontSize: 10, fontFamily: "'Inter', sans-serif" },
        splitArea: { show: false },
      },
      visualMap: {
        min: 0,
        max: 100,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        textStyle: { color: "#64748B", fontSize: 10 },
        inRange: {
          color: ["#0B0F16", "#1E3A5F", "#38BDF8", "#FACC15", "#F87171"],
        },
        itemWidth: 12,
        itemHeight: 120,
      },
      series: [
        {
          name: "Risk Intensity",
          type: "heatmap",
          data,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(56, 189, 248, 0.5)",
            },
          },
          itemStyle: {
            borderColor: "#0B0F16",
            borderWidth: 2,
            borderRadius: 3,
          },
        },
      ],
    };
  }, [heatmapData]);

  if (Object.keys(heatmapData).length === 0) {
    return (
      <div className="flex items-center justify-center text-[#64748B] text-sm" style={{ height }}>
        No risk pattern data available
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: `${height}px`, width: "100%" }}
      opts={{ renderer: "canvas" }}
    />
  );
}
