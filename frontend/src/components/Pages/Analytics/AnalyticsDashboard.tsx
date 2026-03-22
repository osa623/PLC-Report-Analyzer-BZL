"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, LineChart, Target, Activity, Shield, PieChart, Gauge, Flame, Layers } from "lucide-react";

import TrendLineChart from "@/components/Charts/TrendLineChart";
import GrowthBarChart from "@/components/Charts/GrowthBarChart";
import RatioRadarChart from "@/components/Charts/RatioRadarChart";
import CashflowWaterfallChart from "@/components/Charts/CashflowWaterfallChart";
import RiskHeatmap from "@/components/Charts/RiskHeatmap";
import SegmentDonutChart from "@/components/Charts/SegmentDonutChart";
import FinancialHealthGauge from "@/components/Charts/FinancialHealthGauge";
import InvestmentSignals from "@/components/Pages/Analytics/InvestmentSignals";
import PatternTimeline from "@/components/Pages/Analytics/PatternTimeline";
import BatchUploadWidget from "@/components/Ui/BatchUploadWidget";

import type {
  ComparativeAnalysisResult,
  BatchUploadResponse,
  MetricTrendData,
  GrowthAnalysisData,
  InvestmentSignalData,
  DuPontDecomposition,
  FinancialHealthScore,
  CashflowBreakdownItem,
  YearMetricPoint,
} from "@/lib/api";

// ── Sample / mock data for when no real data is loaded ──────────────────────

const SAMPLE_TRENDS: MetricTrendData[] = [
  {
    metric_name: "revenue",
    display_name: "Total Revenue",
    values: [
      { year: 2020, value: 12_500_000_000 },
      { year: 2021, value: 14_200_000_000 },
      { year: 2022, value: 15_800_000_000 },
      { year: 2023, value: 17_100_000_000 },
    ],
    cagr: 0.1101,
    latest_yoy_change: 0.0823,
  },
  {
    metric_name: "net_profit",
    display_name: "Net Profit",
    values: [
      { year: 2020, value: 1_800_000_000 },
      { year: 2021, value: 2_100_000_000 },
      { year: 2022, value: 1_950_000_000 },
      { year: 2023, value: 2_400_000_000 },
    ],
    cagr: 0.1006,
    latest_yoy_change: 0.2308,
  },
  {
    metric_name: "total_assets",
    display_name: "Total Assets",
    values: [
      { year: 2020, value: 45_000_000_000 },
      { year: 2021, value: 48_500_000_000 },
      { year: 2022, value: 52_000_000_000 },
      { year: 2023, value: 55_300_000_000 },
    ],
    cagr: 0.0711,
    latest_yoy_change: 0.0635,
  },
];

const SAMPLE_GROWTH: GrowthAnalysisData = {
  revenue_growth_rates: [
    { year: 2021, value: 0.136 },
    { year: 2022, value: 0.1127 },
    { year: 2023, value: 0.0823 },
  ],
  profit_growth_rates: [
    { year: 2021, value: 0.1667 },
    { year: 2022, value: -0.0714 },
    { year: 2023, value: 0.2308 },
  ],
  asset_growth_rates: [
    { year: 2021, value: 0.0778 },
    { year: 2022, value: 0.0722 },
    { year: 2023, value: 0.0635 },
  ],
  margin_trends: [
    { year: 2021, value: 0.1479 },
    { year: 2022, value: 0.1234 },
    { year: 2023, value: 0.1404 },
  ],
};

const SAMPLE_SIGNALS: InvestmentSignalData[] = [
  {
    category: "Revenue Momentum",
    signal: "BULLISH",
    strength: 0.82,
    description: "3/3 years of revenue growth. Avg YoY: 11.0%",
    supporting_data: { growth_count: 3, avg_growth: 0.1103 },
  },
  {
    category: "Margin Quality",
    signal: "NEUTRAL",
    strength: 0.5,
    description: "Net margin: 14.0%. Improving in 1/2 years.",
    supporting_data: { latest_margin: 0.1404, improving_years: 1 },
  },
  {
    category: "Cash Flow Health",
    signal: "BULLISH",
    strength: 0.9,
    description: "Positive operating CF in 4/4 years. Cash conversion: 1.3x",
    supporting_data: { positive_years: 4, total_years: 4 },
  },
  {
    category: "Debt Position",
    signal: "NEUTRAL",
    strength: 0.5,
    description: "Debt-to-equity: 1.85x",
    supporting_data: { debt_to_equity: 1.85 },
  },
  {
    category: "Dividend Signal",
    signal: "BULLISH",
    strength: 0.75,
    description: "Dividends paid in 3/4 years analyzed.",
    supporting_data: { dividend_years: 3 },
  },
];

const SAMPLE_HEALTH: FinancialHealthScore = {
  overall_score: 67.5,
  profitability_score: 72,
  liquidity_score: 60,
  growth_score: 75,
  efficiency_score: 55,
  stability_score: 62,
};

const SAMPLE_CASHFLOW: CashflowBreakdownItem[] = [
  { year: 2023, operating: 3_200_000_000, investing: -1_800_000_000, financing: -900_000_000, net: 500_000_000 },
];

const SAMPLE_RATIOS: Record<string, YearMetricPoint[]> = {
  gross_margin: [{ year: 2022, value: 0.38 }, { year: 2023, value: 0.41 }],
  net_margin: [{ year: 2022, value: 0.12 }, { year: 2023, value: 0.14 }],
  current_ratio: [{ year: 2022, value: 1.5 }, { year: 2023, value: 1.6 }],
  debt_to_equity: [{ year: 2022, value: 1.9 }, { year: 2023, value: 1.85 }],
  asset_turnover: [{ year: 2022, value: 0.3 }, { year: 2023, value: 0.31 }],
};

const SAMPLE_RISK_HEATMAP: Record<string, Record<number, number>> = {
  revenue_growth: { 2021: 0.8, 2022: 0.7, 2023: 0.65 },
  margin_compression: { 2022: 0.6 },
  liquidity_risk: { 2021: 0.3, 2023: 0.4 },
};

const SAMPLE_PATTERNS = [
  { pattern_type: "revenue_growth", description: "Consistent revenue growth observed across analyzed periods.", confidence: 0.85 },
  { pattern_type: "margin_compression", description: "Net profit margin fluctuation detected between periods.", confidence: 0.6 },
  { pattern_type: "consistent_performance", description: "Total assets show steady growth year-over-year.", confidence: 0.78 },
];

const SAMPLE_SEGMENTS = [
  { name: "Financial Services", value: 8_500_000_000 },
  { name: "Leisure & Hotels", value: 3_200_000_000 },
  { name: "Consumer Foods", value: 2_800_000_000 },
  { name: "Retail", value: 1_600_000_000 },
  { name: "Other", value: 1_000_000_000 },
];

// ── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  delay = 0,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl bg-[#131B2C]/60 backdrop-blur-xl border border-[#38BDF8]/8 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-[#38BDF8]/6 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#38BDF8]/8 border border-[#38BDF8]/15 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-[#38BDF8]" />
        </div>
        <h3 className="text-sm font-semibold text-gray-200 tracking-wide">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [analysisData, setAnalysisData] = useState<ComparativeAnalysisResult | null>(null);

  const handleUploadComplete = (result: BatchUploadResponse) => {
    if (result.comparativeAnalysis && result.comparativeAnalysis.status === "completed") {
      setAnalysisData(result.comparativeAnalysis);
    }
  };

  // Use real data if available, otherwise use sample data
  const trends = analysisData?.metric_trends ?? SAMPLE_TRENDS;
  const growth = analysisData?.growth_analysis ?? SAMPLE_GROWTH;
  const signals = analysisData?.investment_signals ?? SAMPLE_SIGNALS;
  const health = analysisData?.financial_health ?? SAMPLE_HEALTH;
  const cashflow = analysisData?.cashflow_breakdown ?? SAMPLE_CASHFLOW;
  const ratios = analysisData?.ratio_comparison ?? SAMPLE_RATIOS;
  const riskHeatmap = analysisData?.risk_heatmap ?? SAMPLE_RISK_HEATMAP;
  const companyName = analysisData?.company?.name || "Sample Company";

  return (
    <div className="min-h-screen bg-[#0B0F16] text-[#F1F5F9]">
      {/* Header */}
      <div className="border-b border-[#38BDF8]/8 bg-[#0B0F16]/95 backdrop-blur-lg sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Analytics Dashboard
              </h1>
              <p className="text-sm text-[#64748B] mt-0.5">
                {analysisData
                  ? `${companyName} — ${analysisData.years_analyzed.join(", ")}`
                  : "Sample data — upload reports for live analysis"}
              </p>
            </div>
            {analysisData && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
                <span className="text-xs text-[#4ADE80] font-medium">Live Data</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-8">
        {/* Upload Widget */}
        {!analysisData && (
          <div className="max-w-xl mx-auto mb-4">
            <BatchUploadWidget onUploadComplete={handleUploadComplete} />
          </div>
        )}

        {/* Investment Signals */}
        <Section title="Investment Signals" icon={Target} delay={0.1}>
          <InvestmentSignals signals={signals} />
        </Section>

        {/* Financial Health + Trends - 2 column */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Financial Health Score" icon={Gauge} delay={0.15}>
            <FinancialHealthGauge healthScore={health} height={280} />
          </Section>

          <Section title="Multi-Year Trends" icon={LineChart} delay={0.2}>
            <TrendLineChart trends={trends} height={340} />
          </Section>
        </div>

        {/* Growth Analysis + Cash Flow - 2 column */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Growth Analysis" icon={BarChart3} delay={0.25}>
            <GrowthBarChart
              revenueGrowth={growth.revenue_growth_rates}
              profitGrowth={growth.profit_growth_rates}
              marginTrends={growth.margin_trends}
              height={340}
            />
          </Section>

          <Section title="Cash Flow Breakdown" icon={Layers} delay={0.3}>
            <CashflowWaterfallChart breakdowns={cashflow} height={340} />
          </Section>
        </div>

        {/* Ratio Radar + Segment Donut - 2 column */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Financial Ratios" icon={Activity} delay={0.35}>
            <RatioRadarChart ratioComparison={ratios} height={360} />
          </Section>

          <Section title="Segment Contribution" icon={PieChart} delay={0.4}>
            <SegmentDonutChart segments={SAMPLE_SEGMENTS} title="Revenue by Segment" height={340} />
          </Section>
        </div>

        {/* Risk Heatmap - full width */}
        <Section title="Risk & Pattern Heatmap" icon={Flame} delay={0.45}>
          <RiskHeatmap heatmapData={riskHeatmap} height={320} />
        </Section>

        {/* Pattern Timeline - full width */}
        <Section title="Detected Patterns" icon={Shield} delay={0.5}>
          <PatternTimeline patterns={SAMPLE_PATTERNS} />
        </Section>
      </div>
    </div>
  );
}
