"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { YearMetricPoint } from "@/lib/api";

interface GrowthBarChartProps {
  revenueGrowth: YearMetricPoint[];
  profitGrowth: YearMetricPoint[];
  marginTrends: YearMetricPoint[];
  height?: number;
}

export default function GrowthBarChart({
  revenueGrowth,
  profitGrowth,
  marginTrends,
  height = 380,
}: GrowthBarChartProps) {
  const option = useMemo(() => {
    const allYears = Array.from(
      new Set([
        ...revenueGrowth.map((d) => d.year),
        ...profitGrowth.map((d) => d.year),
        ...marginTrends.map((d) => d.year),
      ])
    ).sort();

    const buildSeries = (data: YearMetricPoint[]) => {
      const map = new Map(data.map((d) => [d.year, d.value]));
      return allYears.map((y) => {
        const val = map.get(y) ?? null;
        return val !== null ? +(val * 100).toFixed(2) : null;
      });
    };

    const revData = buildSeries(revenueGrowth);
    const profData = buildSeries(profitGrowth);
    const marginData = buildSeries(marginTrends);

    return {
      backgroundColor: "transparent",
      grid: { left: "3%", right: "4%", top: "15%", bottom: "12%", containLabel: true },
      legend: {
        top: 0,
        textStyle: { color: "#94A3B8", fontSize: 11, fontFamily: "'Inter', sans-serif" },
        icon: "roundRect",
        itemWidth: 14,
        itemHeight: 8,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(10, 17, 40, 0.95)",
        borderColor: "#38BDF8",
        borderWidth: 1,
        textStyle: { color: "#E2E8F0", fontSize: 12, fontFamily: "'Inter', sans-serif" },
        formatter: (params: { seriesName: string; value: number | null; color: string }[]) =>
          params
            .filter((p) => p.value !== null)
            .map(
              (p) =>
                `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin-right:6px;"></span>${p.seriesName}: <b>${p.value!.toFixed(1)}%</b>`
            )
            .join("<br/>"),
      },
      xAxis: {
        type: "category",
        data: allYears.map(String),
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
          formatter: (v: number) => `${v}%`,
        },
      },
      series: [
        {
          name: "Revenue Growth",
          type: "bar",
          data: revData.map((v) => ({
            value: v,
            itemStyle: {
              color: v !== null && v >= 0 ? "#4ADE80" : "#F87171",
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barWidth: "20%",
        },
        {
          name: "Profit Growth",
          type: "bar",
          data: profData.map((v) => ({
            value: v,
            itemStyle: {
              color: v !== null && v >= 0 ? "#38BDF8" : "#FB923C",
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barWidth: "20%",
        },
        {
          name: "Net Margin",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          data: marginData,
          itemStyle: { color: "#FACC15" },
          lineStyle: { color: "#FACC15", width: 2, type: "dashed" },
        },
      ],
      dataZoom: [{ type: "inside", start: 0, end: 100 }],
    };
  }, [revenueGrowth, profitGrowth, marginTrends]);

  return (
    <ReactECharts
      option={option}
      style={{ height: `${height}px`, width: "100%" }}
      opts={{ renderer: "canvas" }}
    />
  );
}
