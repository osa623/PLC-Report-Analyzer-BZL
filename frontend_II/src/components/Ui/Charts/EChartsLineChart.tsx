"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";

export interface ChartDataPoint {
    year: string;
    value: number;
}

interface EChartsLineChartProps {
    data: ChartDataPoint[];
    color?: string;
    title?: string;
    height?: number;
    /** Optional: show a gradient fill under the line */
    areaFill?: boolean;
    /** Optional: y-axis label formatter, e.g. "B" for billions */
    yAxisSuffix?: string;
}

export default function EChartsLineChart({
    data,
    color = "#B28D41",
    title,
    height = 320,
    areaFill = true,
    yAxisSuffix = "",
}: EChartsLineChartProps) {
    const option = useMemo(() => {
        const xData = data.map((d) => d.year);
        const yData = data.map((d) => d.value);

        // Build area-fill gradient from the line color
        const hexToRgb = (hex: string) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `${r},${g},${b}`;
        };
        const rgb = color.startsWith("#") ? hexToRgb(color) : "178,141,65";

        return {
            backgroundColor: "transparent",
            grid: {
                left: "4%",
                right: "3%",
                top: title ? "15%" : "8%",
                bottom: "12%",
                containLabel: true,
            },
            tooltip: {
                trigger: "axis",
                backgroundColor: "rgba(10, 17, 40, 0.95)",
                borderColor: color,
                borderWidth: 1,
                textStyle: {
                    color: "#E2E8F0",
                    fontSize: 13,
                    fontFamily: "'Inter', sans-serif",
                },
                formatter: (params: { name: string; value: number }[]) => {
                    const p = params[0];
                    const val =
                        p.value >= 1_000_000_000
                            ? `${(p.value / 1_000_000_000).toFixed(2)}B`
                            : p.value >= 1_000_000
                                ? `${(p.value / 1_000_000).toFixed(2)}M`
                                : p.value >= 1_000
                                    ? `${(p.value / 1_000).toFixed(2)}K`
                                    : `${p.value.toFixed(2)}`;
                    return `
            <div style="display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:11px;color:#94A3B8;font-weight:500;">${p.name}</span>
              <span style="font-size:15px;color:${color};font-weight:700;">${val}${yAxisSuffix}</span>
            </div>
          `;
                },
                axisPointer: {
                    type: "cross",
                    crossStyle: { color: color + "55" },
                    lineStyle: { color: color + "55", width: 1, type: "dashed" },
                },
            },
            xAxis: {
                type: "category",
                data: xData,
                boundaryGap: false,
                axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
                axisTick: { show: false },
                axisLabel: {
                    color: "#64748B",
                    fontSize: 11,
                    fontFamily: "'Inter', sans-serif",
                    interval: 0,
                },
                splitLine: { show: false },
            },
            yAxis: {
                type: "value",
                axisLine: { show: false },
                axisTick: { show: false },
                splitLine: {
                    lineStyle: { color: "rgba(255,255,255,0.05)", type: "dashed" },
                },
                axisLabel: {
                    color: "#64748B",
                    fontSize: 11,
                    fontFamily: "'Inter', sans-serif",
                    formatter: (v: number) => {
                        if (Math.abs(v) >= 1_000_000_000)
                            return `${(v / 1_000_000_000).toFixed(1)}B`;
                        if (Math.abs(v) >= 1_000_000)
                            return `${(v / 1_000_000).toFixed(1)}M`;
                        if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
                        return `${v}${yAxisSuffix}`;
                    },
                },
            },
            dataZoom: [
                {
                    type: "inside",
                    start: 0,
                    end: 100,
                },
            ],
            series: [
                {
                    type: "line",
                    data: yData,
                    smooth: true,
                    symbol: "circle",
                    symbolSize: 8,
                    itemStyle: {
                        color: color,
                        borderColor: "#0A1128",
                        borderWidth: 2,
                    },
                    lineStyle: {
                        color: color,
                        width: 2.5,
                        shadowColor: `rgba(${rgb}, 0.4)`,
                        shadowBlur: 8,
                    },
                    emphasis: {
                        focus: "series",
                        itemStyle: {
                            color: "#fff",
                            borderColor: color,
                            borderWidth: 3,
                            shadowColor: `rgba(${rgb}, 0.8)`,
                            shadowBlur: 12,
                        },
                    },
                    areaStyle: areaFill
                        ? {
                            color: {
                                type: "linear",
                                x: 0,
                                y: 0,
                                x2: 0,
                                y2: 1,
                                colorStops: [
                                    { offset: 0, color: `rgba(${rgb}, 0.25)` },
                                    { offset: 1, color: `rgba(${rgb}, 0.0)` },
                                ],
                            },
                        }
                        : undefined,
                    markLine:
                        yData.length > 0
                            ? {
                                silent: true,
                                symbol: ["none", "none"],
                                lineStyle: {
                                    color: `rgba(${rgb}, 0.35)`,
                                    type: "dashed",
                                    width: 1,
                                },
                                data: [{ type: "average", name: "Avg" }],
                                label: {
                                    show: true,
                                    position: "insideEndTop",
                                    color: `rgba(${rgb}, 0.7)`,
                                    fontSize: 10,
                                    formatter: "avg",
                                },
                            }
                            : undefined,
                },
            ],
        };
    }, [data, color, title, areaFill, yAxisSuffix]);

    return (
        <ReactECharts
            option={option}
            style={{ height: `${height}px`, width: "100%" }}
            opts={{ renderer: "canvas" }}
        />
    );
}
