"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { YearMetricPoint } from "@/lib/api";

interface RatioRadarChartProps {
  ratioComparison: Record<string, YearMetricPoint[]>;
  height?: number;
}

const COLORS = ["#38BDF8", "#FACC15", "#4ADE80", "#F87171", "#A78BFA", "#FB923C"];

const DISPLAY_NAMES: Record<string, string> = {
  gross_margin: "Gross Margin",
  net_margin: "Net Margin",
  current_ratio: "Current Ratio",
  operating_cashflow_ratio: "Op. CF Ratio",
  roe: "ROE",
  roa: "ROA",
  debt_to_equity: "D/E Ratio",
  asset_turnover: "Asset Turnover",
  interest_coverage: "Interest Cover",
};

export default function RatioRadarChart({ ratioComparison, height = 400 }: RatioRadarChartProps) {
  const option = useMemo(() => {
    const ratioNames = Object.keys(ratioComparison);
    if (ratioNames.length === 0) return {};

    // Collect all years across all ratios
    const allYears = Array.from(
      new Set(
        Object.values(ratioComparison).flatMap((pts) => pts.map((p) => p.year))
      )
    ).sort();

    // Compute max value per ratio for indicator scaling
    const indicators = ratioNames.map((name) => {
      const values = ratioComparison[name].map((p) => Math.abs(p.value));
      const maxVal = values.length > 0 ? Math.max(...values) : 1;
      return {
        name: DISPLAY_NAMES[name] || name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        max: maxVal * 1.3 || 1,
      };
    });

    // Build one series per year
    const series = allYears.map((year, idx) => {
      const values = ratioNames.map((name) => {
        const point = ratioComparison[name].find((p) => p.year === year);
        return point ? Math.abs(point.value) : 0;
      });

      return {
        name: String(year),
        type: "radar" as const,
        symbol: "circle",
        symbolSize: 5,
        data: [
          {
            value: values,
            name: String(year),
            areaStyle: { color: COLORS[idx % COLORS.length] + "20" },
            lineStyle: { color: COLORS[idx % COLORS.length], width: 2 },
            itemStyle: { color: COLORS[idx % COLORS.length] },
          },
        ],
      };
    });

    return {
      backgroundColor: "transparent",
      legend: {
        top: 0,
        textStyle: { color: "#94A3B8", fontSize: 11, fontFamily: "'Inter', sans-serif" },
        icon: "circle",
        itemWidth: 10,
        itemHeight: 10,
      },
      tooltip: {
        backgroundColor: "rgba(10, 17, 40, 0.95)",
        borderColor: "#38BDF8",
        borderWidth: 1,
        textStyle: { color: "#E2E8F0", fontSize: 12, fontFamily: "'Inter', sans-serif" },
      },
      radar: {
        indicator: indicators,
        shape: "polygon",
        splitNumber: 4,
        axisName: {
          color: "#94A3B8",
          fontSize: 10,
          fontFamily: "'Inter', sans-serif",
        },
        splitArea: {
          areaStyle: {
            color: ["rgba(56,189,248,0.02)", "rgba(56,189,248,0.04)"],
          },
        },
        splitLine: {
          lineStyle: { color: "rgba(255,255,255,0.06)" },
        },
        axisLine: {
          lineStyle: { color: "rgba(255,255,255,0.08)" },
        },
      },
      series,
    };
  }, [ratioComparison]);

  if (Object.keys(ratioComparison).length === 0) {
    return (
      <div className="flex items-center justify-center text-[#64748B] text-sm" style={{ height }}>
        No ratio data available
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
