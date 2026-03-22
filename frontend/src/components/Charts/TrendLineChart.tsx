"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { MetricTrendData } from "@/lib/api";

interface TrendLineChartProps {
  trends: MetricTrendData[];
  height?: number;
}

const COLORS = [
  "#38BDF8", "#FACC15", "#4ADE80", "#F87171",
  "#A78BFA", "#FB923C", "#22D3EE", "#E879F9", "#34D399",
];

function formatValue(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(1);
}

export default function TrendLineChart({ trends, height = 400 }: TrendLineChartProps) {
  const option = useMemo(() => {
    const allYears = Array.from(
      new Set(trends.flatMap((t) => t.values.map((v) => v.year)))
    ).sort();

    const series = trends.map((trend, idx) => {
      const yearMap = new Map(trend.values.map((v) => [v.year, v.value]));
      return {
        name: trend.display_name,
        type: "line" as const,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        data: allYears.map((y) => yearMap.get(y) ?? null),
        itemStyle: { color: COLORS[idx % COLORS.length] },
        lineStyle: {
          color: COLORS[idx % COLORS.length],
          width: 2.5,
        },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: COLORS[idx % COLORS.length] + "30" },
              { offset: 1, color: COLORS[idx % COLORS.length] + "05" },
            ],
          },
        },
        emphasis: {
          focus: "series" as const,
          itemStyle: {
            borderColor: "#fff",
            borderWidth: 2,
            shadowColor: COLORS[idx % COLORS.length] + "80",
            shadowBlur: 10,
          },
        },
      };
    });

    return {
      backgroundColor: "transparent",
      grid: { left: "3%", right: "4%", top: "15%", bottom: "12%", containLabel: true },
      legend: {
        top: 0,
        textStyle: { color: "#94A3B8", fontSize: 11, fontFamily: "'Inter', sans-serif" },
        icon: "roundRect",
        itemWidth: 14,
        itemHeight: 8,
        itemGap: 16,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(10, 17, 40, 0.95)",
        borderColor: "#38BDF8",
        borderWidth: 1,
        textStyle: { color: "#E2E8F0", fontSize: 12, fontFamily: "'Inter', sans-serif" },
        formatter: (params: { seriesName: string; value: number; color: string }[]) => {
          const lines = params
            .filter((p) => p.value !== null && p.value !== undefined)
            .map(
              (p) =>
                `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;"></span>${p.seriesName}: <b>${formatValue(p.value)}</b>`
            );
          return lines.join("<br/>");
        },
        axisPointer: {
          type: "cross",
          crossStyle: { color: "#38BDF855" },
          lineStyle: { color: "#38BDF855", type: "dashed" },
        },
      },
      xAxis: {
        type: "category",
        data: allYears.map(String),
        boundaryGap: false,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
        axisTick: { show: false },
        axisLabel: { color: "#64748B", fontSize: 11, fontFamily: "'Inter', sans-serif" },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)", type: "dashed" } },
        axisLabel: {
          color: "#64748B",
          fontSize: 11,
          fontFamily: "'Inter', sans-serif",
          formatter: (v: number) => formatValue(v),
        },
      },
      dataZoom: [{ type: "inside", start: 0, end: 100 }],
      series,
    };
  }, [trends]);

  return (
    <ReactECharts
      option={option}
      style={{ height: `${height}px`, width: "100%" }}
      opts={{ renderer: "canvas" }}
    />
  );
}
