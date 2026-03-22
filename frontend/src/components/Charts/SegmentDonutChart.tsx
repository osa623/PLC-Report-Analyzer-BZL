"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";

interface SegmentItem {
  name: string;
  value: number;
}

interface SegmentDonutChartProps {
  segments: SegmentItem[];
  title?: string;
  height?: number;
}

const COLORS = [
  "#38BDF8", "#FACC15", "#4ADE80", "#F87171",
  "#A78BFA", "#FB923C", "#22D3EE", "#E879F9",
];

export default function SegmentDonutChart({ segments, title, height = 350 }: SegmentDonutChartProps) {
  const option = useMemo(() => {
    if (segments.length === 0) return {};

    const total = segments.reduce((sum, s) => sum + Math.abs(s.value), 0);

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(10, 17, 40, 0.95)",
        borderColor: "#38BDF8",
        borderWidth: 1,
        textStyle: { color: "#E2E8F0", fontSize: 12, fontFamily: "'Inter', sans-serif" },
        formatter: (params: { name: string; value: number; percent: number; color: string }) =>
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color};margin-right:6px;"></span>${params.name}<br/>Value: <b>${params.value.toLocaleString()}</b><br/>Share: <b>${params.percent.toFixed(1)}%</b>`,
      },
      legend: {
        orient: "vertical",
        right: "5%",
        top: "center",
        textStyle: { color: "#94A3B8", fontSize: 11, fontFamily: "'Inter', sans-serif" },
        icon: "circle",
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          name: title || "Segments",
          type: "pie",
          radius: ["45%", "72%"],
          center: ["40%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: "#0B0F16",
            borderWidth: 3,
            borderRadius: 6,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 13,
              fontWeight: "bold",
              color: "#F1F5F9",
              fontFamily: "'Inter', sans-serif",
              formatter: "{b}\n{d}%",
            },
            itemStyle: {
              shadowBlur: 15,
              shadowColor: "rgba(56, 189, 248, 0.4)",
            },
          },
          data: segments.map((s, i) => ({
            name: s.name,
            value: Math.abs(s.value),
            itemStyle: { color: COLORS[i % COLORS.length] },
          })),
        },
        // Inner ring label
        {
          name: "Center",
          type: "pie",
          radius: [0, "30%"],
          center: ["40%", "50%"],
          silent: true,
          label: {
            show: true,
            position: "center",
            formatter: `{total|${total >= 1_000_000 ? `${(total / 1_000_000).toFixed(1)}M` : total.toLocaleString()}}\n{label|Total}`,
            rich: {
              total: {
                fontSize: 20,
                fontWeight: "bold",
                color: "#F1F5F9",
                fontFamily: "'JetBrains Mono', monospace",
                padding: [0, 0, 4, 0],
              },
              label: {
                fontSize: 11,
                color: "#64748B",
                fontFamily: "'Inter', sans-serif",
              },
            },
          },
          data: [{ value: 1, itemStyle: { color: "transparent" } }],
        },
      ],
    };
  }, [segments, title]);

  if (segments.length === 0) {
    return (
      <div className="flex items-center justify-center text-[#64748B] text-sm" style={{ height }}>
        No segment data available
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
