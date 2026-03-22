"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { CashflowBreakdownItem } from "@/lib/api";

interface CashflowWaterfallChartProps {
  breakdowns: CashflowBreakdownItem[];
  height?: number;
}

function formatCurrency(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

export default function CashflowWaterfallChart({ breakdowns, height = 380 }: CashflowWaterfallChartProps) {
  const option = useMemo(() => {
    if (breakdowns.length === 0) return {};

    // Use the latest year's breakdown for waterfall
    const latest = breakdowns[breakdowns.length - 1];
    const categories = ["Operating", "Investing", "Financing", "Net Cash Flow"];
    const values = [
      latest.operating ?? 0,
      latest.investing ?? 0,
      latest.financing ?? 0,
      latest.net ?? 0,
    ];

    // Waterfall: invisible base bar + visible bar
    const baseValues: number[] = [];
    let running = 0;
    for (let i = 0; i < 3; i++) {
      if (values[i] >= 0) {
        baseValues.push(running);
        running += values[i];
      } else {
        running += values[i];
        baseValues.push(Math.max(running, 0));
      }
    }
    baseValues.push(0); // Net bar starts from 0

    const barColors = values.map((v, i) => {
      if (i === 3) return "#38BDF8"; // Net = blue
      return v >= 0 ? "#4ADE80" : "#F87171";
    });

    return {
      backgroundColor: "transparent",
      grid: { left: "3%", right: "4%", top: "10%", bottom: "10%", containLabel: true },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(10, 17, 40, 0.95)",
        borderColor: "#38BDF8",
        borderWidth: 1,
        textStyle: { color: "#E2E8F0", fontSize: 12, fontFamily: "'Inter', sans-serif" },
        formatter: (params: { name: string; value: number; seriesIndex: number }[]) => {
          const actual = params.find((p) => p.seriesIndex === 1);
          if (!actual) return "";
          return `${actual.name}: <b>${formatCurrency(actual.value)}</b>`;
        },
      },
      xAxis: {
        type: "category",
        data: categories,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
        axisTick: { show: false },
        axisLabel: { color: "#94A3B8", fontSize: 11, fontFamily: "'Inter', sans-serif" },
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
          formatter: (v: number) => formatCurrency(v),
        },
      },
      series: [
        {
          name: "Base",
          type: "bar",
          stack: "waterfall",
          data: baseValues.map((v) => ({
            value: v,
            itemStyle: { color: "transparent" },
          })),
          emphasis: { disabled: true },
        },
        {
          name: "Cash Flow",
          type: "bar",
          stack: "waterfall",
          data: values.map((v, i) => ({
            value: Math.abs(v),
            itemStyle: {
              color: barColors[i],
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barWidth: "40%",
          label: {
            show: true,
            position: "top",
            color: "#94A3B8",
            fontSize: 10,
            fontFamily: "'Inter', sans-serif",
            formatter: (params: { dataIndex: number }) => formatCurrency(values[params.dataIndex]),
          },
        },
      ],
    };
  }, [breakdowns]);

  if (breakdowns.length === 0) {
    return (
      <div className="flex items-center justify-center text-[#64748B] text-sm" style={{ height }}>
        No cash flow data available
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
