'use client'

import Link from "next/link";
import Image from "next/image";

//imports for images
import heroImage from "../../assets/Landing Page/hero1.jpg";
import heroImageI from "../../assets/Landing Page/hero2.jpg";


//imports for Uis
import Waves from '../../Ui/Waves';
import { use } from "react";
import CardSwap, { Card } from '../../Ui/CardSwap';
import ScrollVelocity from '@/components/Ui/ScrollVelocity';
import { useEffect, useRef, useState } from "react";
import AnnualReportWidget from "@/components/Ui/AnnualReportWidget";


//widjet sample data sets
 const rows = [
    { sym: "AAPL", name: "Apple Inc.", shares: "42.0", avg: "$168.20", pl: "+$812", plPct: "+1.9%", pos: true },
    { sym: "MSFT", name: "Microsoft", shares: "18.5", avg: "$312.10", pl: "+$1,104", plPct: "+2.6%", pos: true },
    { sym: "NVDA", name: "NVIDIA", shares: "9.0", avg: "$498.40", pl: "+$1,872", plPct: "+4.1%", pos: true },
    { sym: "TSLA", name: "Tesla", shares: "11.0", avg: "$221.70", pl: "-$294", plPct: "-1.2%", pos: false },
    { sym: "JNJ", name: "Johnson & Johnson", shares: "15.0", avg: "$156.30", pl: "+$190", plPct: "+0.5%", pos: true },
    { sym: "AMZN", name: "Amazon", shares: "6.0", avg: "$141.25", pl: "+$244", plPct: "+1.1%", pos: true },
    { sym: "META", name: "Meta Platforms", shares: "5.0", avg: "$302.80", pl: "+$318", plPct: "+2.0%", pos: true },
  ];

  const pills = [
    { label: "S&P 500", value: "+0.64%", good: true },
    { label: "NASDAQ", value: "+0.92%", good: true },
    { label: "VIX", value: "-1.10%", good: false },
  ];

  const kpis = [
    { title: "Total Value", value: "$128,430.25", badge: "+2.38%", sub: "today", good: true },
    { title: "Day P/L", value: "+$2,981.14", badge: "+1.42%", sub: "since open", good: true },
    { title: "Cash Available", value: "$9,250.00", badge: "Buying power $18,500", sub: "", good: null },
    { title: "Risk Score", value: "6.8", badge: "Moderate", sub: "", good: null },
  ];


//data sets
const serviceDetails = [

  {
    tag: "In-Depth Financial Report Analysis",
    desc: "Unlock the full potential of corporate filings with our sophisticated analysis engine. We go beyond surface-level numbers to dissect complex balance sheets, income statements, and cash flow reports. By identifying underlying trends and accounting nuances, we provide investors with a crystal-clear understanding of a company's operational efficiency and long-term financial health.",
    features: [
      "Complex Statement Dissection",
      "Trend Identification",
      "Accounting Nuance Detection",
      "Operational Efficiency Metrics"
    ]
  },
  {
    tag: "Interactive Financial Charts & Visuals",
    desc: "Transform raw data into actionable insights through our suite of high-performance interactive visualizations. Our charting tools allow you to overlay multiple technical indicators, compare historical price movements, and visualize volume patterns with precision. Whether you are performing trend analysis or volatility checks, these dynamic visuals make complex market movements intuitive and easy.",
    features: [
      "Multi-Indicator Overlays",
      "Historical Price Comparison",
      "Volume Pattern Visualization",
      "Dynamic Trend Analysis"
    ]
  },
  {
    tag: "100+ Automated Financial Calculations",
    desc: "Eliminate the risk of manual entry errors and drastically reduce your research time with our comprehensive calculation suite. We automatically process over one hundred critical financial metrics, including specialized margin analysis and growth rates. This automation ensures that you spend less time on spreadsheets and more time making high-level strategic investment decisions.",
    features: [
      "Critical Metric Processing",
      "Margin & Growth Analysis",
      "Risk Verification Automation",
      "Strategic Decision Support"
    ]
  },
  {
    tag: "Intrinsic Company Valuations",
    desc: "Determine the true worth of any asset using our institutional-grade valuation models. By utilizing Advanced Discounted Cash Flow (DCF) analysis and Multi-Stage Growth models, we calculate the intrinsic value of a business based on its future earning potential. This helps you identify undervalued opportunities and maintain a strict margin of safety in your portfolio.",
    features: [
      "Advanced DCF Models",
      "Multi-Stage Growth Analysis",
      "Earning Potential Calculation",
      "Undervalued Opportunity Scanner"
    ]
  },
  {
    tag: "Advanced Ratio Analysis",
    desc: "Gain a competitive edge by deep-diving into the core ratios that drive market performance. Our platform calculates advanced profitability, liquidity, solvency, and efficiency ratios in real-time. By comparing these figures against industry benchmarks and historical averages, you can pinpoint a company's competitive advantages or uncover hidden red flags before they impact the market.",
    features: [
      "Profitability & Liquidity Checks",
      "Solvency & Efficiency Ratios",
      "Industry Benchmark Comparison",
      "Red Flag Detection"
    ]
  }, {
    tag: "Comprehensive Company Profiles",
    desc: "Access a centralized intelligence hub for every company in your watch list. Our profiles aggregate everything from executive leadership data and ownership structures to historical performance and sector positioning. This holistic view provides the context necessary to understand not just where a company is today, but where it is strategically headed in the future.",
    features: [
      "Executive Leadership & Ownership",
      "Historical Performance Data",
      "Sector & Industry Positioning",
      "Strategic Direction Insights"
    ]
  }
];




const videoSections = [
  { src: "/heroSection.mp4" },
  { src: "/heroSection.mp4" },
  { src: "/heroSection.mp4" },
  { src: "/heroSection.mp4" }
];

export default function HeroSection() {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);

  // Create an extended array with the first slide duplicated at the end for the loop effect
  const extendedVideoSections = [...videoSections, videoSections[0]];


  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % serviceDetails.length);
    }, 50000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentVideoIndex((prevIndex) => prevIndex + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handle the infinite loop reset
  useEffect(() => {
    if (currentVideoIndex === videoSections.length) {
      // We are on the cloned last slide (visually the first slide)
      // Wait for the transition to complete, then snap back to the true first slide
      const timer = setTimeout(() => {
        setIsTransitioning(false); // Disable transition
        setCurrentVideoIndex(0); // Snap to index 0

        // Re-enable transition after a brief delay to allow the snap to render
        setTimeout(() => {
          setIsTransitioning(true);
        }, 50);
      }, 1000); // 1000ms matches the duration-1000 class

      return () => clearTimeout(timer);
    }
  }, [currentVideoIndex]);

  return (

    /* Main Section */
    <div className="relative h-screen sm:h-[130vh] md:h-[200vh] lg:h-[200vh] w-full bg-transparent">

      {/* Lower div Section for 2 sections */}

      <div className="absolute flex-col flex z-40 h-auto w-full overflow-hidden">
        <div className="group relative  flex  inset-0 h-[50vh] sm:h-[60vh] md:h-[65vh] lg:h-[70vh]">
          <div
            className={`flex w-full h-full ${isTransitioning ? 'transition-transform duration-1000 ease-in-out' : ''}`}
            style={{ transform: `translateX(-${currentVideoIndex * 100}%)` }}
          >
            {extendedVideoSections.map((video, index) => {
              // Determine the logical index for content (mod the original length so the clone maps to 0)
              const logicalIndex = index % videoSections.length;

              return (
                <div key={index} className="relative min-w-full overflow-hidden h-full shrink-0">
                  <video
                    className="absolute z-10 inset-0 w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  >
                    <source src={video.src} type="video/mp4" />
                  </video>
                  {/* Dynamic indicator dots */}
                  <div className="absolute z-30 bottom-4 sm:bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3">
                    {videoSections.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setIsTransitioning(true);
                          setCurrentVideoIndex(idx);
                        }}
                        className={`transition-all duration-500 rounded-full ${idx === (currentVideoIndex % videoSections.length)
                          ? 'w-8 sm:w-10 md:w-12 h-2 sm:h-2.5 md:h-3 bg-[#B28D41]'
                          : 'w-2 sm:w-2.5 md:w-3 h-2 sm:h-2.5 md:h-3 bg-white/40 hover:bg-white/60'
                          }`}
                        aria-label={`Go to slide ${idx + 1}`}
                      />
                    ))}
                  </div>

                  {/* Animated particles overlay */}
                  <div className="absolute z-40 inset-0 pointer-events-none">
                    {[...Array(15)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-1 h-1 bg-[#E9D37E] rounded-full animate-pulse"
                        style={{
                          top: `${Math.random() * 100}%`,
                          left: `${Math.random() * 100}%`,
                          animationDelay: `${Math.random() * 3}s`,
                          animationDuration: `${2 + Math.random() * 3}s`,
                          opacity: 0.3 + Math.random() * 0.4
                        }}
                      />
                    ))}
                  </div>
                  {/* Gradient overlay for better text readability */}
                  <div className="absolute z-20 inset-0 bg-gradient-to-br backdrop-blur-xs from-[#0D1325]/90 via-[#182847]/80 to-[#306B99]/90" />

                  {/* Accent geometric shapes */}
                  <div
                    className={`absolute z-30 w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-full blur-2xl sm:blur-3xl transition-all duration-1000 ${logicalIndex === 0 ? 'bg-[#B28D41]/20 -top-10 sm:-top-16 md:-top-20 -right-10 sm:-right-16 md:-right-20' :
                      logicalIndex === 1 ? 'bg-[#E9D37E]/20 -bottom-10 sm:-bottom-16 md:-bottom-20 -left-10 sm:-left-16 md:-left-20' :
                        'bg-[#306B99]/20 top-0 left-1/2 -translate-x-1/2 -translate-y-1/2'
                      }`}
                  />

                  {/* Content positioning */}
                  <div className={`absolute z-50 inset-0 flex-col flex p-4 sm:p-6 md:p-8 lg:p-12 transition-all duration-1000 
                   ${logicalIndex === 0 ? 'items-end justify-start' :
                    logicalIndex === 1 ? 'items-end justify-start' :
                      logicalIndex === 2 ? 'items-end justify-start' :
                        logicalIndex === 3 ? 'items-end justify-start' :
                          'items-center justify-start'
                    }`}>

                    {/* 1st Content positioning - Text/heading Section */}
                    <div className={`max-w-5xl z-40 ${logicalIndex === 2 || logicalIndex === 3 ? 'text-center' : 'text-start'}`}>
                      {/* Main headline */}
                      <div className="">
                        <h2 className={`text-3xl sm:text-5xl ${logicalIndex === 0 ? 'md:text-6xl lg:text-9xl' : logicalIndex === 1 ? 'md:text-5xl lg:text-9xl' : logicalIndex === 2 ? 'md:text-5xl lg:text-9xl' : 'md:text-5xl lg:text-9xl'} font-fugaz font-normal  ${logicalIndex === 0 ? 'text-[#e6c029]' :
                          logicalIndex === 1 ? 'text-[#B28D41]' :
                            logicalIndex === 2 ? 'text-[#e6c029]' :
                              'text-[#E3E4E6]'
                          }`}>
                          {logicalIndex === 0 && "COMPLETE"}
                          {logicalIndex === 1 && "MASTER"}
                          {logicalIndex === 2 && "TIMING"}
                          {logicalIndex === 3 && "MASTER"}

                        </h2>
                      </div>

                      {/* Sub headline with accent line */}
                      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 mb-2 sm:mb-3">
                        <div className="h-0.5 sm:h-1 w-6 sm:w-8 md:w-12 bg-[#B28D41]" />
                        <h3 className={`flex text-sm sm:text-lg ${logicalIndex === 0 ? 'md:text-3xl lg:text-4xl' : logicalIndex === 1 ? 'md:text-2xl lg:text-4xl' : logicalIndex === 2 ? 'md:text-2xl lg:text-4xl' : 'md:text-2xl lg:text-4xl'} bg-[#0D1325] rounded-lg sm:rounded-xl md:rounded-2xl p-1 px-2 sm:p-2 sm:px-3 md:px-4 border sm:border-2 font-bowlby text-[#BBC0C7]`}>
                          {logicalIndex === 0 && "MARKET"}
                          {logicalIndex === 1 && "THE"}
                          {logicalIndex === 2 && "IS"}
                          {logicalIndex === 3 && "THE"}
                        </h3> <h2 className={`text-lg sm:text-2xl ${logicalIndex === 0 ? 'md:text-4xl lg:text-6xl' : logicalIndex === 1 ? 'md:text-3xl lg:text-6xl' : logicalIndex === 2 ? 'md:text-3xl lg:text-6xl' : 'md:text-3xl lg:text-6xl'} font-fugaz font-bold text-[#E3E4E6] font-normal`}>
                          {logicalIndex === 0 && "INTELLIGENCE"}
                          {logicalIndex === 1 && "FUNDAMENTALS"}
                          {logicalIndex === 2 && "EVERYTHING"}
                          {logicalIndex === 3 && "FUNDAMENTALS"}
                        </h2>
                      </div>

                      {/* Secondary headline */}


                      {/* Description text */}
                      <div className={`${logicalIndex === 2 ? 'flex justify-center' : ''}`}>
                        <p className={`text-xs sm:text-sm md:text-base lg:text-lg font-encode font-light text-[#ffffff] leading-relaxed ${logicalIndex === 2 ? 'max-w-xs sm:max-w-md md:max-w-xl lg:max-w-2xl' : 'max-w-xs sm:max-w-sm md:max-w-md lg:max-w-xl'
                          } border-l sm:border-l-2 border-[#306B99] pl-2 sm:pl-3 md:pl-4`}>
                          {logicalIndex === 0 && "Don't rely on guesswork. Access professional-grade fundamental data and advanced technical indicators in one place."}
                          {logicalIndex === 1 && "See the true picture behind the ticker. Instantly visualize balance sheets, cash flow, and intrinsic value to determine if a company is truly a healthy business."}
                          {logicalIndex === 2 && "Know exactly when to look. Our proprietary Buy & Sell Sensors analyze momentum and technical patterns to highlight potential entry and exit points on the chart."}
                          {logicalIndex === 3 && "See the true picture behind the ticker. Instantly visualize balance sheets, cash flow, and intrinsic value to determine if a company is truly a healthy business."}

                        </p>
                      </div>

                    </div>


                  </div>


                </div>
              )
            }
            )}
          </div>

            {/* Annual Report Extractor Widget */}
            <div className={`absolute left-4 sm:right-6 md:right-8 bottom-0 sm:bottom-12 md:top-4 w-80 z-50`}>
                  <AnnualReportWidget/>
            </div>

       {/* Sample Widget */}    
      <div className="absolute z-50 w-full top-96 h-[50vh] bg-transparent overflow-hidden">
      <div className="absolute flex z-50 w-[90%] sm:w-[85%] md:w-[85%] lg:w-[85%] bg-black/90 bottom-8 sm:bottom-16 md:bottom-8 rounded-xl sm:rounded-3xl left-1/2 -translate-x-1/2 h-[40vh] sm:h-[35vh] md:h-[40vh] border border-white/10 shadow-[inset_0px_19px_20px_rgba(255,255,255,0.18)] backdrop-blur overflow-hidden">
        {/* Everything stays inside */}
        <div className="w-full h-full flex flex-col min-h-0 text-white overflow-hidden">
          {/* Header */}
          <div className="shrink-0 px-4 sm:px-6 md:px-7 pt-4 sm:pt-5 md:pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs tracking-widest text-white/60 uppercase">
          Portfolio Overview
            </p>
            <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="text-lg sm:text-xl md:text-2xl font-semibold truncate">
            Growth Account
          </h3>
          <span className="text-xs text-white/45">• Updated just now</span>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {["1D", "1W", "1M", "1Y"].map((t) => (
          <button
            key={t}
            type="button"
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition
              ${
            t === "1M"
              ? "bg-white/20 border-white/15"
              : "bg-white/10 hover:bg-white/15 border-white/10"
              }`}
          >
            {t}
          </button>
            ))}
          </div>
        </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 px-4 sm:px-6 md:px-7 pb-4 sm:pb-5 md:pb-4 mt-3 overflow-hidden">
        <div className="h-full min-h-0 grid grid-cols-12 gap-2 sm:gap-3 md:gap-4">
          {/* LEFT */}
          <div className="col-span-12 lg:col-span-5 h-full min-h-0 flex flex-col gap-2 sm:gap-3 md:gap-4 overflow-hidden">
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 shrink-0">
          {kpis.map((k) => (
            <div
              key={k.title}
              className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-3 sm:p-4"
            >
              <p className="text-xs text-white/60">{k.title}</p>
              <p
            className={`mt-1 text-lg sm:text-xl md:text-2xl font-semibold truncate ${
              k.title === "Day P/L" ? "text-emerald-300" : ""
            }`}
              >
            {k.value}
              </p>

              <div className="mt-2 flex items-center gap-2 flex-wrap">
            {k.good === true && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">
                {k.badge}
              </span>
            )}
            {k.good === null && k.title === "Cash Available" && (
              <span className="text-[11px] text-white/50">{k.badge}</span>
            )}
            {k.good === null && k.title === "Risk Score" && (
              <span className="text-[11px] text-white/50">{k.badge}</span>
            )}
            {k.sub ? <span className="text-xs text-white/50">{k.sub}</span> : null}
              </div>

              {k.title === "Risk Score" && (
            <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-emerald-400/80 via-amber-300/70 to-rose-400/70" />
            </div>
              )}
            </div>
          ))}
            </div>

            {/* Allocation (fills leftover on left) */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between shrink-0">
            <p className="text-sm font-semibold">Allocation</p>
            <p className="text-xs text-white/50">Diversification</p>
          </div>

          <div className="mt-3 h-3 rounded-full bg-white/10 overflow-hidden shrink-0">
            <div className="h-full w-[42%] bg-sky-400/70 float-left" />
            <div className="h-full w-[28%] bg-emerald-400/70 float-left" />
            <div className="h-full w-[18%] bg-amber-300/70 float-left" />
            <div className="h-full w-[12%] bg-fuchsia-400/70 float-left" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs shrink-0">
            {[
              ["Tech", "42%"],
              ["Healthcare", "28%"],
              ["Energy", "18%"],
              ["Cash & Bonds", "12%"],
            ].map(([label, val]) => (
              <div
            key={label}
            className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-2 py-1.5"
              >
            <span className="text-white/60 truncate">{label}</span>
            <span className="font-medium shrink-0">{val}</span>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-3 flex gap-2 shrink-0">
            <button type="button" className="flex-1 rounded-xl bg-white text-black text-xs font-semibold py-2 hover:bg-white/90">
              Add Position
            </button>
            <button type="button" className="flex-1 rounded-xl bg-white/10 border border-white/10 text-xs font-semibold py-2 hover:bg-white/15">
              Rebalance
            </button>
          </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="col-span-12 lg:col-span-7 h-full min-h-0 rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-3 sm:p-4 md:p-5 flex flex-col overflow-hidden">
            {/* Market header */}
            <div className="shrink-0 flex flex-wrap items-center gap-2 justify-between">
          <p className="text-sm font-semibold">Market Snapshot</p>
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs">
            {pills.map((p) => (
              <span
            key={p.label}
            className="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-white/70 whitespace-nowrap"
              >
            {p.label}{" "}
            <span className={p.good ? "text-emerald-300" : "text-rose-300"}>
              {p.value}
            </span>
              </span>
            ))}
          </div>
            </div>

            {/* Equity curve */}
            <div className="shrink-0 mt-2 sm:mt-3 rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/60">Equity Curve</p>
              <p className="text-sm text-white/80">Last 30 days performance</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/60">Return</p>
              <p className="text-sm font-semibold text-emerald-300">+6.12%</p>
            </div>
          </div>

          <div className="mt-3 h-12 sm:h-16 rounded-xl bg-gradient-to-r from-white/5 via-white/10 to-white/5 border border-white/10 relative overflow-hidden">
            <div className="absolute inset-0 opacity-70">
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-emerald-400/15 to-transparent" />
              <div className="absolute -bottom-6 -left-6 w-40 h-40 rounded-full bg-sky-400/10 blur-2xl" />
              <div className="absolute -top-10 right-0 w-40 h-40 rounded-full bg-fuchsia-400/10 blur-2xl" />
            </div>
          </div>

          <p className="mt-2 text-[11px] text-white/45">
            Tip: Keep positions under 12% each for a smoother risk profile.
          </p>
            </div>

            {/* Holdings (scroll area) */}
            <div className="mt-3 flex-1 min-h-0 rounded-2xl border border-white/10 bg-black/25 overflow-hidden flex flex-col">
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
            <p className="text-sm font-semibold">Top Holdings</p>
            <p className="text-xs text-white/50">{rows.length} positions</p>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] text-white/50 shrink-0">
              <div className="col-span-5">Symbol</div>
              <div className="col-span-2 text-right">Shares</div>
              <div className="col-span-3 text-right">Avg Cost</div>
              <div className="col-span-2 text-right">P/L</div>
            </div>

            {rows.map((r) => (
              <div
            key={r.sym}
            className="grid grid-cols-12 gap-2 px-4 py-2 text-sm border-t border-white/10 hover:bg-white/5 transition"
              >
            <div className="col-span-5">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-xs font-semibold shrink-0">
              {r.sym.charAt(0)}
                </div>
                <div className="leading-tight min-w-0">
              <p className="text-sm font-semibold truncate">{r.sym}</p>
              <p className="text-[10px] text-white/50 truncate">{r.name}</p>
                </div>
              </div>
            </div>

            <div className="col-span-2 text-right text-xs text-white/80 self-center">
              {r.shares}
            </div>

            <div className="col-span-3 text-right text-xs text-white/80 self-center">
              {r.avg}
            </div>

            <div
              className={`col-span-2 text-right text-xs font-semibold self-center ${
                r.pos ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {r.pl}
            </div>
              </div>
            ))}
          </div>

          <div className="shrink-0 px-4 py-3 border-t border-white/10 flex items-center justify-between">
            <p className="text-xs text-white/50">
              Realized gains: <span className="text-white/75">$1,240</span>
            </p>
            <button type="button" className="text-xs font-semibold px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15">
              View all
            </button>
          </div>
            </div>
          </div>
          {/* END RIGHT */}
        </div>
          </div>
        </div>
      </div>
      </div>
  


        </div>


        <div className="relative z-40 flex inset-0 h-[50vh] sm:h-[70vh] md:h-[130vh]">
          {/* Wave Patterns */}

          <div className="absolute z-50 w-full h-full">
            <Waves
              lineColor="#fff"
              backgroundColor="transparent"
              waveSpeedX={0.07}
              waveSpeedY={0.01}
              waveAmpX={40}
              waveAmpY={20}
              friction={0.9}
              tension={0.01}
              maxCursorMove={120}
              xGap={12}
              yGap={36}
            />
          </div>
          <div className="absolute z-50 w-full h-full">
            <Waves
              lineColor="#fff"
              backgroundColor="transparent"
              waveSpeedX={0.02}
              waveSpeedY={0.01}
              waveAmpX={40}
              waveAmpY={20}
              friction={0.9}
              tension={0.01}
              maxCursorMove={120}
              xGap={12}
              yGap={36}
            />
          </div>

          {/* black background*/}
          <div className="absolute bg-gradient-to-t py-20 from-[#0b1534] via-[#0D1425] to-transparent z-50 w-full h-full" />
          <div className="absolute bg-gradient-to-b from-black via-black/45 to-transparent z-50 w-full h-full" />

          {/* Sliding Menu for the Services */}
          <div className="hidden md:block absolute z-50 w-full h-full">
            <div className=" sm:mt-32 md:mt-40 lg:mt-96" style={{ height: '400px', position: 'relative' }}>
              <CardSwap
                cardDistance={60}
                verticalDistance={70}
                delay={5000}
                pauseOnHover={false}
              >
                <Card>
                  <div className="relative h-full bg-[#121C33] backdrop-blur-sm rounded-xl overflow-hidden border border-blue-500/30 hover:border-blue-400/60 transition-all duration-500 group">

                    <div className="absolute z-10 flex w-auto h-12 bg-blue-600 top-0 left-0">
                      <div className="flex text-xs font-encode font-semibold items-center ml-2 px-4 text-white">
                        BUYZONLABS - Features
                      </div>
                    </div>

                    <div className="absolute z-40 inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10 flex items-center justify-between h-full p-8 space-x-6">

                      <div className="flex flex-col w-full sm:w-auto">
                        <div className="flex-1 relative space-y-1 sm:space-y-2 md:space-y-3 transform group-hover:translate-x-2 transition-transform duration-500">
                          <div className="absolute bg-amber-600 -top-2 sm:-top-3 md:-top-4 rounded-full w-[40%] h-2 sm:h-3 md:h-2" />
                          <h3 className="text-base sm:text-xl md:text-2xl lg:text-3xl flex flex-col font-normal font-fugaz text-white group-hover:text-blue-300 transition-colors duration-300">COMPREHENSIVE
                            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white group-hover:text-blue-200 transition-colors duration-300">COMPANY</span>
                            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white group-hover:text-blue-200 transition-colors duration-300">PROFILES</span>
                          </h3>
                          <div className="absolute bg-amber-600 -bottom-1 right-6 sm:right-8 md:right-12 rounded-full w-[50%] h-2 sm:h-3 md:h-2" />
                        </div>
                      </div>
                      <div className="relative sm:w-40 md:w-52 lg:w-[40%]  sm:h-40 md:h-52 lg:h-[80%] rounded-xl sm:rounded-2xl overflow-hidden transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-2xl shadow-blue-900/50">
                        <Image src={heroImage} alt="Stock Market Analysis" className="object-cover border-2 border-blue-400/50 h-full" />
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="relative h-full bg-[#121C33] backdrop-blur-sm rounded-lg sm:rounded-xl overflow-hidden border border-blue-500/30 hover:border-blue-400/60 transition-all duration-500 group">

                    <div className="absolute z-10 flex w-auto h-8 sm:h-10 md:h-12 bg-blue-600 top-0 left-0">
                      <div className="flex text-[10px] sm:text-xs font-encode font-semibold items-center ml-1 sm:ml-2 px-2 sm:px-3 md:px-4 text-white">
                        BUYZONLABS - Features
                      </div>
                    </div>

                    <div className="absolute z-40 inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10 flex flex-col sm:flex-row justify-between items-center h-full p-4 sm:p-6 md:p-8 space-y-3 sm:space-y-0 sm:space-x-4 md:space-x-6">

                      <div className="flex flex-col w-full sm:w-auto">
                        <div className="flex-1 relative space-y-1 sm:space-y-2 md:space-y-3 transform group-hover:translate-x-2 transition-transform duration-500">
                          <div className="absolute bg-amber-600 -top-2 sm:-top-3 md:-top-4 rounded-full w-[40%] h-2 sm:h-3 md:h-2" />
                          <h3 className="text-base sm:text-xl md:text-2xl lg:text-3xl flex flex-col font-normal font-fugaz text-white group-hover:text-blue-300 transition-colors duration-300">IN-DEPTH
                            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white group-hover:text-blue-200 transition-colors duration-300">FINANCIAL</span>
                            <span className="text-base sm:text-xl md:text-2xl lg:text-3xl text-white group-hover:text-blue-300 transition-colors duration-300">REPORT_ANALYSIS</span>
                          </h3>
                          <div className="absolute bg-amber-600 -bottom-1 right-6 sm:right-8 md:right-12 rounded-full w-[50%] h-2 sm:h-3 md:h-2" />
                        </div>
                      </div>
                      <div className="relative lg:w-[40%] sm:w-40 md:w-52 h-32 sm:h-40 md:h-52 lg:h-[80%] rounded-xl sm:rounded-2xl overflow-hidden transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-2xl shadow-blue-900/50">
                        <Image src={heroImage} alt="Stock Market Analysis" className="object-cover border sm:border-2 border-blue-400/50 h-full" />
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="relative h-full bg-[#121C33] backdrop-blur-sm rounded-lg sm:rounded-xl overflow-hidden border border-blue-500/30 hover:border-blue-400/60 transition-all duration-500 group">

                    <div className="absolute z-10 flex w-auto h-8 sm:h-10 md:h-12 bg-blue-600 top-0 left-0">
                      <div className="flex text-[10px] sm:text-xs font-encode font-semibold items-center ml-1 sm:ml-2 px-2 sm:px-3 md:px-4 text-white">
                        BUYZONLABS - Features
                      </div>
                    </div>

                    <div className="absolute z-40 inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10 flex flex-col sm:flex-row justify-between items-center h-full p-4 sm:p-6 md:p-8 space-y-3 sm:space-y-0 sm:space-x-4 md:space-x-6">

                      <div className="flex flex-col w-full sm:w-auto">
                        <div className="flex-1 relative space-y-1 sm:space-y-2 md:space-y-3 transform group-hover:translate-x-2 transition-transform duration-500">
                          <div className="absolute bg-amber-600 -top-2 sm:-top-3 md:-top-4 rounded-full w-[40%] h-2 sm:h-3 md:h-2" />
                          <h3 className="text-base sm:text-xl md:text-2xl lg:text-3xl flex flex-col font-normal font-fugaz text-white group-hover:text-blue-300 transition-colors duration-300">INTERACTIVE
                            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white group-hover:text-blue-200 transition-colors duration-300">FINANCIAL</span>
                            <span className="text-base sm:text-xl md:text-2xl lg:text-3xl text-white group-hover:text-blue-300 transition-colors duration-300">CHARTS_VISUALS</span>
                          </h3>
                          <div className="absolute bg-amber-600 -bottom-1 right-6 sm:right-8 md:right-12 rounded-full w-[50%] h-2 sm:h-3 md:h-2" />
                        </div>
                      </div>
                      <div className="relative  sm:w-40 md:w-52 lg:w-[40%] h-32 sm:h-40 md:h-52 lg:h-[80%] rounded-xl sm:rounded-2xl overflow-hidden transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-2xl shadow-blue-900/50">
                        <Image src={heroImage} alt="Stock Market Analysis" className="object-cover border sm:border-2 border-blue-400/50 h-full" />
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="relative h-full bg-[#121C33] backdrop-blur-sm rounded-lg sm:rounded-xl overflow-hidden border border-blue-500/30 hover:border-blue-400/60 transition-all duration-500 group">

                    <div className="absolute z-10 flex w-auto h-8 sm:h-10 md:h-12 bg-blue-600 top-0 left-0">
                      <div className="flex text-[10px] sm:text-xs font-encode font-semibold items-center ml-1 sm:ml-2 px-2 sm:px-3 md:px-4 text-white">
                        BUYZONLABS - Features
                      </div>
                    </div>

                    <div className="absolute z-40 inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10 flex flex-col sm:flex-row justify-between items-center h-full p-4 sm:p-6 md:p-8 space-y-3 sm:space-y-0 sm:space-x-4 md:space-x-6">

                      <div className="flex flex-col w-full sm:w-auto">
                        <div className="flex-1 relative space-y-1 sm:space-y-2 md:space-y-3 transform group-hover:translate-x-2 transition-transform duration-500">
                          <div className="absolute bg-amber-600 -top-2 sm:-top-3 md:-top-4 rounded-full w-[40%] h-2 sm:h-3 md:h-2" />
                          <h3 className="text-base sm:text-xl md:text-2xl lg:text-3xl flex flex-col font-normal font-fugaz text-white group-hover:text-blue-300 transition-colors duration-300">100+_AUTOMATED
                            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white group-hover:text-blue-200 transition-colors duration-300">FINANCIAL</span>
                            <span className="text-base sm:text-xl md:text-2xl lg:text-3xl text-white group-hover:text-blue-300 transition-colors duration-300">CALCULATIONS</span>
                          </h3>
                          <div className="absolute bg-amber-600 -bottom-1 right-6 sm:right-8 md:right-12 rounded-full w-[50%] h-2 sm:h-3 md:h-2" />
                        </div>
                      </div>
                      <div className="relative sm:w-40 md:w-52 lg:w-[40%] h-32 sm:h-40 md:h-52 lg:h-[80%] rounded-xl sm:rounded-2xl overflow-hidden transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-2xl shadow-blue-900/50">
                        <Image src={heroImage} alt="Stock Market Analysis" className="object-cover border sm:border-2 border-blue-400/50 h-full" />
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="relative h-full bg-[#121C33] backdrop-blur-sm rounded-lg sm:rounded-xl overflow-hidden border border-blue-500/30 hover:border-blue-400/60 transition-all duration-500 group">

                    <div className="absolute z-10 flex w-auto h-8 sm:h-10 md:h-12 bg-blue-600 top-0 left-0">
                      <div className="flex text-[10px] sm:text-xs font-encode font-semibold items-center ml-1 sm:ml-2 px-2 sm:px-3 md:px-4 text-white">
                        BUYZONLABS - Features
                      </div>
                    </div>

                    <div className="absolute z-40 inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10 flex flex-col sm:flex-row justify-between items-center h-full p-4 sm:p-6 md:p-8 space-y-3 sm:space-y-0 sm:space-x-4 md:space-x-6">

                      <div className="flex flex-col w-full sm:w-auto">
                        <div className="flex-1 relative space-y-1 sm:space-y-2 md:space-y-3 transform group-hover:translate-x-2 transition-transform duration-500">
                          <div className="absolute bg-amber-600 -top-2 sm:-top-3 md:-top-4 rounded-full w-[40%] h-2 sm:h-3 md:h-2" />
                          <h3 className="text-base sm:text-xl md:text-2xl lg:text-3xl flex flex-col font-normal font-fugaz text-white group-hover:text-blue-300 transition-colors duration-300">INTRINSIC
                            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white group-hover:text-blue-200 transition-colors duration-300">COMPANY</span>
                            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white group-hover:text-blue-200 transition-colors duration-300">VALUATIONS</span>
                          </h3>
                          <div className="absolute bg-amber-600 -bottom-1 right-6 sm:right-8 md:right-12 rounded-full w-[50%] h-2 sm:h-3 md:h-2" />
                        </div>
                      </div>
                      <div className="relative  sm:w-40 md:w-52 lg:w-[40%] h-32 sm:h-40 md:h-52 lg:h-[80%] rounded-xl sm:rounded-2xl overflow-hidden transform group-hover:scale-100 group-hover:rotate-3 transition-all duration-500 shadow-2xl shadow-blue-900/50">
                        <Image src={heroImage} alt="Stock Market Analysis" className="object-cover border sm:border-2 border-blue-400/50 h-full" />
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="relative h-full bg-[#121C33] backdrop-blur-sm rounded-lg sm:rounded-xl overflow-hidden border border-blue-500/30 hover:border-blue-400/60 transition-all duration-500 group">

                    <div className="absolute z-10 flex w-auto h-8 sm:h-10 md:h-12 bg-blue-600 top-0 left-0">
                      <div className="flex text-[10px] sm:text-xs font-encode font-semibold items-center ml-1 sm:ml-2 px-2 sm:px-3 md:px-4 text-white">
                        BUYZONLABS - Features
                      </div>
                    </div>

                    <div className="absolute z-40 inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10 flex flex-col sm:flex-row justify-between items-center h-full p-4 sm:p-6 md:p-8 space-y-3 sm:space-y-0 sm:space-x-4 md:space-x-6">

                      <div className="flex flex-col w-full sm:w-auto">
                        <div className="flex-1 relative space-y-1 sm:space-y-2 md:space-y-3 transform group-hover:translate-x-2 transition-transform duration-500">
                          <div className="absolute bg-amber-600 -top-2 sm:-top-3 md:-top-4 rounded-full w-[40%] h-2 sm:h-3 md:h-2" />
                          <h3 className="text-base sm:text-xl md:text-2xl lg:text-3xl flex flex-col font-normal font-fugaz text-white group-hover:text-blue-300 transition-colors duration-300">ADVANCED
                            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white group-hover:text-blue-200 transition-colors duration-300">RATIOS</span>
                            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white group-hover:text-blue-200 transition-colors duration-300">ANALYSIS</span>
                          </h3>
                          <div className="absolute bg-amber-600 -bottom-1 right-6 sm:right-8 md:right-12 rounded-full w-[50%] h-2 sm:h-3 md:h-2" />
                        </div>
                      </div>
                      <div className="relative  sm:w-40 md:w-52 lg:w-[40%] h-32 sm:h-40 md:h-52 lg:h-[80%] rounded-xl sm:rounded-2xl overflow-hidden transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-2xl shadow-blue-900/50">
                        <Image src={heroImage} alt="Stock Market Analysis" className="object-cover border sm:border-2 border-blue-400/50 h-full" />
                      </div>
                    </div>
                  </div>
                </Card>

              </CardSwap>
            </div>

          </div>

          {/* texting area for the Feature section */}
          <div className="absolute z-50 lg:-top-12 border-white h-full hidden md:flex items-center bg-transparent w-full md:w-[50%] lg:w-[50%] h-f">

            <div className="relative flex h-auto w-auto">
              <div className="absolute">
                <h2 className="absolute flex font-bowlby bottom-16 sm:bottom-20 md:bottom-24 text-xl sm:text-2xl md:text-[2rem] lg:text-[3rem] ml-6 sm:ml-8 md:ml-12 font-white">
                  OUR||||||||||||||||||||||||||||||||||||<div className="relative flex bg-white w-full" />
                </h2>
              </div>
              <h2 className="absolute font-bowlby text-3xl sm:text-4xl md:text-[4rem] lg:text-[6rem] bottom-0 ml-6 sm:ml-8 md:ml-12 font-white">
                FEATURES
              </h2>
            </div>

            <div className="relative flex mt-8 sm:mt-10 md:mt-20 h-auto w-[85%] sm:w-[82%] md:w-[80%]">
              <h2 className="flex font-encode bottom-16 sm:bottom-20 md:bottom-24 text-sm sm:text-base md:text-lg lg:text-2xl mt-12 sm:mt-16 md:mt-20 ml-6 sm:ml-8 md:ml-12 font-white"
                style={{
                  fontWeight: '100'
                }}>
                Everything you need to analyze companies, visualize data, and make smarter investment decisions.Everything you need to analyze companies, visualize data, and make smarter investment decisions.
              </h2>
            </div>




          </div>



          {/* detail preview section */}

          <div className="absolute z-50 bottom-0 left-12 h-full md:p-0 hidden md:flex justify-center items-start bg-transparent md:w-[50%] lg:w-[50%] lg:h-[50vh]">
            <div
              className="relative backdrop-blur-sm flex flex-col h-full w-full p-8 transition-all duration-500"
              style={{ boxShadow: 'inset 0px 10px 20px rgba(0,0,0,0.0)' }}
            >

              {/* Dynamic Content Container */}
              <div
                key={activeIndex}
                className="relative h-full animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out"
              >

                {/* 1. The Decorative Line (The border) 
            Changed generic border to a glowing blue accent bar */}
                <div className="absolute left-0 top-2 bottom-1/3 w-[3px] bg-gradient-to-b from-blue-500 via-blue-400/50 to-transparent rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]" />

                {/* 2. The Tag 
            Added glassmorphism, a subtle border, and a glow effect */}
                <div className="absolute left-6 -top-1">
                  <span className="inline-block px-4 py-1.5 rounded-full bg-blue-900/40 border border-blue-400/30 backdrop-blur-md text-white font-normal font-fugaz text-[10px] tracking-[0.2em] uppercase shadow-[0_0_20px_-5px_rgba(37,99,235,0.5)]">
                    {serviceDetails[activeIndex].tag}
                  </span>
                </div>


                <div className="pl-6 pt-12 lg:pt-12">
                  <p className="font-encode font-light text-sm text-blue-50/90 leading-relaxed tracking-wide drop-shadow-sm text-pretty mb-6">
                    {serviceDetails[activeIndex].desc}
                  </p>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {serviceDetails[activeIndex].features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2 group">
                        <div className="mt-1.5 w-1 h-1 rounded-full bg-blue-400/80 group-hover:bg-amber-400 transition-colors duration-300 shadow-[0_0_5px_rgba(96,165,250,0.6)]" />
                        <span className="text-[11px] sm:text-xs font-encode text-blue-200/80 group-hover:text-blue-100 transition-colors duration-300">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>


                  <div className="mt-6 w-12 h-0.5 bg-blue-500/30 rounded-full" />
                </div>

              </div>

            </div>
          </div>
        </div>

      </div>

      




      {/* Below Line Section */}
      <div className="absolute z-40  bottom-0 w-full h-2 bg-gradient-to-l from-blue-500 via-blue-400/50 to-transparent shadow-[0_0_15px_rgba(59,130,246,0.9)]" />



    </div>
  );
}
