"use client";

import React from "react";

interface GraphCardProps {
    title: string;
    color: string;
    /** Optional: span full width on 2-col grids */
    fullWidth?: boolean;
    loading?: boolean;
    children: React.ReactNode;
}

/** Skeleton placeholder that mimics a chart */
function ChartSkeleton() {
    return (
        <div className="flex items-end gap-1.5 h-[200px] px-4 pb-4 pt-8">
            {Array.from({ length: 8 }).map((_, i) => (
                <div
                    key={i}
                    className="flex-1 rounded-t animate-pulse"
                    style={{
                        height: `${30 + Math.random() * 60}%`,
                        background:
                            "linear-gradient(180deg, rgba(56,189,248,0.15) 0%, rgba(56,189,248,0.03) 100%)",
                        animationDelay: `${i * 80}ms`,
                    }}
                />
            ))}
        </div>
    );
}

export default function GraphCard({
    title,
    color,
    fullWidth = false,
    loading = false,
    children,
}: GraphCardProps) {
    return (
        <div
            className={`group relative rounded-2xl overflow-hidden transition-all duration-300 ${fullWidth ? "xl:col-span-2" : ""
                }`}
            style={{
                background: "linear-gradient(135deg, rgba(10,17,40,0.9) 0%, rgba(13,20,37,0.95) 100%)",
                border: "1px solid rgba(255,255,255,0.04)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.02)",
            }}
        >
            {/* Hover glow effect */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse at 50% 0%, ${color}08 0%, transparent 70%)`,
                    border: `1px solid ${color}15`,
                }}
            />

            {/* Header */}
            <div className="relative flex items-center justify-between px-5 pt-5 pb-2">
                <div className="flex items-center gap-3">
                    {/* Glowing dot */}
                    <span
                        className="relative inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{
                            backgroundColor: color,
                            boxShadow: `0 0 8px ${color}66, 0 0 16px ${color}33`,
                        }}
                    >
                        <span
                            className="absolute inset-0 rounded-full animate-ping"
                            style={{
                                backgroundColor: color,
                                opacity: 0.3,
                                animationDuration: "2s",
                            }}
                        />
                    </span>

                    <h3 className="text-sm font-semibold text-slate-200 tracking-wide font-inter">
                        {title}
                    </h3>
                </div>

                {/* Live data badge */}
                <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                    style={{
                        background: "rgba(74,222,128,0.08)",
                        border: "1px solid rgba(74,222,128,0.15)",
                        color: "#4ADE80",
                    }}
                >
                    <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ backgroundColor: "#4ADE80" }}
                    />
                    Live
                </div>
            </div>

            {/* Chart area */}
            <div className="relative px-3 pb-4">
                {loading ? <ChartSkeleton /> : children}
            </div>
        </div>
    );
}
