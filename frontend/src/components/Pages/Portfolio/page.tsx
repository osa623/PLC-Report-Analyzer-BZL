"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Search,
  Upload,
  FileSpreadsheet,
  X,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Zap,
  LayoutGrid,
  List,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Lock,
  MoreHorizontal,
  Activity
} from "lucide-react";


// Added 'history' for sparklines
const mockStockData = [
  { symbol: "JKH.N0000", name: "John Keells Holdings", industry: "Diversified", price: 210, qty: 100, avgPrice: 180, totalCost: 18000, sales: 21000, unrealizedGL: 3000, glToday: 250, history: [200, 205, 202, 210, 208, 215, 210] },
  { symbol: "AAIC.N0000", name: "Softlogic Life Insuarance", industry: "Finance", price: 210, qty: 80, avgPrice: 195, totalCost: 15600, sales: 16800, unrealizedGL: 1200, glToday: 90, history: [190, 192, 195, 200, 205, 208, 210] },
  { symbol: "APLA.N0000", name: "ACL Plastic", industry: "Materials", price: 210, qty: 60, avgPrice: 205, totalCost: 12300, sales: 12600, unrealizedGL: 300, glToday: 40, history: [200, 201, 200, 205, 208, 209, 210] },
  { symbol: "HNB.N0000", name: "Hatton National Bank", industry: "Bank", price: 285, qty: 40, avgPrice: 270, totalCost: 10800, sales: 11400, unrealizedGL: 600, glToday: -60, history: [275, 274, 272, 270, 268, 275, 285] },
  { symbol: "HAYC.N0000", name: "Haycarb", industry: "Manufacturing", price: 210, qty: 120, avgPrice: 175, totalCost: 21000, sales: 25200, unrealizedGL: 4200, glToday: 310, history: [170, 175, 180, 190, 200, 205, 210] },
  { symbol: "DIAL.N0000", name: "Dialog Axiata", industry: "Telecommunications", price: 12.50, qty: 1000, avgPrice: 10.20, totalCost: 10200, sales: 12500, unrealizedGL: 2300, glToday: 150, history: [10.10, 10.50, 11.00, 11.80, 12.00, 12.30, 12.50] },
  { symbol: "LIOC.N0000", name: "Lanka IOC", industry: "Energy", price: 115, qty: 250, avgPrice: 130, totalCost: 32500, sales: 28750, unrealizedGL: -3750, glToday: -200, history: [140, 135, 130, 125, 120, 118, 115] },
  { symbol: "SAMP.N0000", name: "Sampath Bank", industry: "Bank", price: 78.40, qty: 500, avgPrice: 72.00, totalCost: 36000, sales: 39200, unrealizedGL: 3200, glToday: -450, history: [70, 71, 73, 75, 76, 77, 78.40] },
  { symbol: "CCS.N0000", name: "Ceylon Cold Stores", industry: "Consumer Goods", price: 62.10, qty: 150, avgPrice: 58.00, totalCost: 8700, sales: 9315, unrealizedGL: -615, glToday: 12, history: [58, 59, 60, 61, 60, 62, 62.10] },
  { symbol: "TILK.N0000", name: "Talawakelle Tea Estates", industry: "Plantations", price: 112, qty: 200, avgPrice: 95, totalCost: 19000, sales: 22400, unrealizedGL: -3400, glToday: 180, history: [92, 95, 98, 102, 105, 108, 112] }
];

/* ---------------- HELPERS ---------------- */
const generateDynamicPalette = (n: number) => {
  return Array.from({ length: n }).map((_, i) => {
    // Golden/Bronze/Teal/Navy range
    const hue = Math.round((360 / n) * i);
    return `hsl(${hue}, 65%, 55%)`;
  });
};

const formatCurrency = (val: number) => `$${val.toLocaleString()}`;

/* ---------------- MAIN COMPONENT ---------------- */
export default function Portfolio() {
  // --- Original State Preservation ---
  const [portfolios, setPortfolios] = useState<string[]>(["Sample Portfolio"]);
  const [selectedPortfolio, setSelectedPortfolio] = useState("Sample Portfolio");
  const [showCreate, setShowCreate] = useState(false);
  const [portfolioName, setPortfolioName] = useState("");
  const [mode, setMode] = useState<"manual" | "excel" | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // --- New UI State ---
  const [activeTab, setActiveTab] = useState<"holdings" | "valuations">("holdings");

  // --- Calculations ---
  const totals = mockStockData.reduce(
    (acc, r) => {
      acc.unrealizedGL += r.unrealizedGL;
      acc.totalGLToday += r.glToday;
      acc.totalCost += r.totalCost;
      acc.sales += r.sales;
      return acc;
    },
    { unrealizedGL: 0, totalGLToday: 0, totalCost: 0, sales: 0 }
  );

  const winRate = Math.round(
    (mockStockData.filter((s) => s.unrealizedGL > 0).length / mockStockData.length) * 100
  );

  const industryAgg = mockStockData.reduce((acc: Record<string, number>, r) => {
    acc[r.industry] = (acc[r.industry] || 0) + r.totalCost;
    return acc;
  }, {});

  const stockAgg = mockStockData.reduce((acc: Record<string, { name: string; value: number }>, r) => {
    const key = r.symbol;
    if (!acc[key]) acc[key] = { name: r.name, value: 0 };
    acc[key].value += r.totalCost;
    return acc;
  }, {});

  const stockItems = Object.entries(stockAgg).map(([k, v], i) => ({
    label: v.name,
    value: v.value,
    color: generateDynamicPalette(Object.keys(stockAgg).length)[i]
  }));

  const industryItems = Object.entries(industryAgg).map(([k, v], i) => ({
    label: k,
    value: v,
    color: generateDynamicPalette(Object.keys(industryAgg).length)[i]
  }));

  // Logic for Valuation Table
  const symbolBase: Record<string, any> = {};
  for (const r of mockStockData) {
    if (!symbolBase[r.symbol]) symbolBase[r.symbol] = r;
  }
  const metricsDataset: Record<string, { pe: number; pb: number; nav: number; dcf: number; target: number; avgPrice?: number }> = {
    'JKH.N0000': { pe: 12.4, pb: 1.8, nav: 150.0, dcf: 220.0, target: 250.0, avgPrice: 190 },
    'HNB.N0000': { pe: 9.6, pb: 0.95, nav: 260.0, dcf: 300.0, target: 330.0, avgPrice: 272 },
    'HAYC.N0000': { pe: 15.2, pb: 2.1, nav: 120.0, dcf: 230.0, target: 260.0, avgPrice: 178 },
  };

  const portfolioStocks = Object.keys(stockAgg).map((symbolKey) => {
    const s = stockAgg[symbolKey];
    const base = symbolBase[symbolKey] || Object.values(symbolBase)[0];
    const price = base?.price ?? 0;
    const dataset = metricsDataset[symbolKey];
    const avgPrice = dataset?.avgPrice ?? base?.avgPrice ?? (base?.totalCost && base?.qty ? base.totalCost / base.qty : 0);
    const pe = dataset?.pe ?? +(price / Math.max(0.01, avgPrice / 10)).toFixed(2);
    const pb = dataset?.pb ?? +(price / Math.max(0.01, avgPrice)).toFixed(2);
    const nav = dataset?.nav ?? +avgPrice.toFixed(2);
    const dcf = dataset?.dcf ?? +(price * 1.05).toFixed(2);
    const target = dataset?.target ?? +(price * 1.15).toFixed(2);
    return { symbol: base?.symbol ?? symbolKey, name: base?.name ?? s.name, avgPrice, pe, pb, nav, dcf, target };
  });

  const addPortfolio = () => {
    if (!portfolioName) return;
    setPortfolios((prev) => [...prev, portfolioName]);
    setSelectedPortfolio(portfolioName);
    setPortfolioName("");
    setMode(null);
    setShowCreate(false);
  };

  return (
    <div className="min-h-screen bg-transparent text-gray-100 font-sans selection:bg-[#DFBD69]/30 pb-20 overflow-x-hidden">

      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#DFBD69]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-[#10b981]/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* --- HEADER --- */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-px w-8 bg-[#DFBD69]" />
              <span className="text-xs font-bold text-[#DFBD69] uppercase tracking-[0.2em]">BUYZONLABS</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#DFBD69] via-[#F7E7CE] to-[#ffffff] font-encode flex items-center gap-3">
              {selectedPortfolio}
            </h1>
            <p className="text-gray-400 mt-2 text-sm max-w-md">
              Real-time performance tracking and advanced valuation metrics.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            {/* DROPDOWN (Original Logic) */}
            <div className="relative group">
              <select
                value={selectedPortfolio}
                onChange={(e) => setSelectedPortfolio(e.target.value)}
                className="appearance-none bg-[#131B2C]/80 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm text-gray-200 outline-none focus:border-[#DFBD69]/50 transition-all backdrop-blur-sm cursor-pointer hover:bg-white/5"
              >
                {portfolios.map((p, i) => (
                  <option key={i} value={p} className="bg-[#0F1729]">
                    {p}
                  </option>
                ))}
              </select>
              <ChevronRight className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>

            {/* CREATE BUTTON (Preserved) */}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 cursor-pointer font-encode font-medium bg-gradient-to-r from-[#B28D41] to-[#E9D37E] text-[#0D1325] rounded-lg hover:shadow-lg hover:shadow-[#B28D41]/30 transition-all duration-300 hover:scale-105 px-4 sm:px-6 py-2 "
            >
              <Plus className="w-4 h-4" /> Create Portfolio
            </button>
          </div>
        </header>

        {/* --- GRID LAYOUT --- */}
        <div className="grid grid-cols-12 gap-10">

          {/* 1. METRICS ROW */}
          <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard label="Unrealized G/L" value={totals.unrealizedGL} type="currency" trend={totals.unrealizedGL >= 0 ? 'up' : 'down'} />
            <MetricCard label="Today's G/L" value={totals.totalGLToday} type="currency" trend={totals.totalGLToday >= 0 ? 'up' : 'down'} />
            <MetricCard label="Total Cost" value={totals.totalCost} type="currency" icon={Lock} />
            <MetricCard label="Total Sales" value={totals.sales} type="currency" icon={CreditCard} />

            {/* GAUGE & WIN RATE */}
            <div className="bg-[#131B2C]/80 backdrop-blur-xl rounded-3xl p-5 border border-white/5 flex flex-col items-center shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 opacity-50" />
              <h3 className="text-xs font-bold text-gray-200 uppercase tracking-widest mb-8 z-10">Win Rate</h3>
              <GlowingGauge value={winRate} />
            </div>



          </div>

          {/* 1.5. TOP GAINERS & LOSERS ROW */}
          <div className="col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Gainers (formerly Movers) */}
            <div className="bg-[#131B2C]/60 backdrop-blur-xl h-auto rounded-3xl p-6 border border-white/5 flex flex-col">
              <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest mb-4">My Gainers</h3>
              <div className="relative space-y-1 flex-1 overflow-y-auto max-h-[300px] pr-2 no-scrollbar">
                {mockStockData
                  .filter(s => s.glToday > 0)
                  .sort((a, b) => b.glToday - a.glToday)

                  .map(s => <MoverCompactRow key={s.symbol} stock={s} />)}
              </div>
            </div>

            {/* Top Losers (formerly Top Gainers) */}
            <div className="bg-[#131B2C]/60 backdrop-blur-xl h-auto rounded-3xl p-6 border border-white/5 flex flex-col">
              <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest mb-4">My Losers</h3>
              <div className="relative space-y-1 flex-1 overflow-y-auto max-h-[300px] pr-2 no-scrollbar">
                {mockStockData
                  .filter(s => s.glToday < 0)
                  .sort((a, b) => a.glToday - b.glToday) // Sort by most negative (ascending)

                  .map(s => <MoverCompactRow key={s.symbol} stock={s} />)}
              </div>
            </div>
          </div>

          {/* 2. MAIN CONTENT (Left - 8 Cols) */}
          <div className="col-span-12 flex flex-col gap-10">

            {/* Current Holdings Tab */}
            <div className="bg-[#131B2C]/60 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden flex flex-col h-[40%] shadow-2xl">
              <div className="flex items-center gap-1 p-2 border-b border-white/5">
                <TabButton active={activeTab === 'holdings'} onClick={() => setActiveTab('holdings')} label="Current Holdings" icon={List} />
                <div className="ml-auto px-4 hidden sm:flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-mono">LIVE</span>
                </div>
              </div>

              <div className="flex-1 p-0 sm:p-2 overflow-x-auto relative hide-scrollbar">
                <AnimatePresence mode="wait">
                  <motion.div key="holdings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    {/* Responsive Table/Card Switch */}
                    <div className="hidden md:block w-full">
                      <HoldingsTable data={mockStockData} />
                    </div>
                    <div className="md:hidden flex flex-col gap-3 p-4">
                      {mockStockData.map((stock) => <StockCardMobile key={stock.symbol} stock={stock} type="holding" />)}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Valuations Tab */}
            <div className="bg-[#131B2C]/60 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden flex flex-col h-[40%] shadow-2xl">
              <div className="flex items-center gap-1 p-2 border-b border-white/5">
                <TabButton active={activeTab === 'valuations'} onClick={() => setActiveTab('valuations')} label="Valuations" icon={List} />
                <div className="ml-auto px-4 hidden sm:flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-mono">LIVE</span>
                </div>
              </div>

              <div className="flex-1 p-0 sm:p-2 overflow-x-auto  relative hide-scrollbar">
                <AnimatePresence mode="wait">
                  <motion.div key="valuations" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    {/* Responsive Table/Card Switch */}
                    <div className="hidden md:block w-full">
                      <ValuationTable data={portfolioStocks} />
                    </div>
                    <div className="md:hidden flex flex-col gap-3 p-4">
                      {portfolioStocks.map((stock) => <StockCardMobile key={stock.symbol} stock={stock} type="valuation" />)}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* 3. GAIN/LOSS CHARTS */}
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT CARD: Total Unrealized Gain/Loss */}
              <GainLossCard
                title="UNREALIZED GAIN / LOSS"
                subtitle="total unrealized gain/loss"
                data={mockStockData}
                dataKey="unrealizedGL"
                maxValue={Math.max(...mockStockData.map(d => Math.abs(d.unrealizedGL)))}
                icon={TrendingUp}
              />

              {/* RIGHT CARD: Today's Unrealized Gain/Loss */}
              <GainLossCard
                title="UNREALIZED GAIN / LOSS TODAY"
                subtitle="gain/loss for today"
                data={mockStockData}
                dataKey="glToday"
                maxValue={Math.max(...mockStockData.map(d => Math.abs(d.glToday)))}
                icon={Activity}
              />
            </div>

          </div>

        </div>


        {/* 3. BOTTOM SECTION (Bar Charts) */}
        <div className="col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6 mt-12">

          {/* BAR CHART 1 (Industry) */}
          <div className="bg-[#131B2C]/60 backdrop-blur-xl rounded-3xl p-6 border border-white/5 flex flex-col">
            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest mb-6 px-1">Allocation (Industry)</h3>
            <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 no-scrollbar">
              <CleanBarChart items={industryItems} totalValue={totals.totalCost} />
            </div>
          </div>

          {/* BAR CHART 2 (Asset) - ALL STOCKS */}
          <div className="bg-[#131B2C]/60 backdrop-blur-xl rounded-3xl p-6 border border-white/5 flex flex-col">
            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest mb-6 px-1">Amount Invested</h3>
            <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 no-scrollbar">
              <CleanBarChart items={stockItems} totalValue={totals.totalCost} />
            </div>
          </div>

        </div>

      </div>

      {/* CREATE PORTFOLIO MODAL (Preserved Logic & Inputs, Upgrade Styles) */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-[#0F1729] rounded-3xl border border-[#DFBD69]/20 p-8 shadow-2xl relative"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#DFBD69] to-[#ffffff] font-encode">Create Portfolio</h2>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
              </div>

              <div className="space-y-6">
                <input
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                  placeholder="Portfolio Name"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-gray-600 focus:border-[#DFBD69] focus:ring-1 focus:ring-[#DFBD69] transition-all outline-none"
                />

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setMode("manual")}
                    className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${mode === "manual" ? "bg-[#DFBD69]/10 border-[#DFBD69] text-[#DFBD69]" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}
                  >
                    <span className="text-sm font-semibold">Manual Entry</span>
                  </button>
                  <button
                    onClick={() => setMode("excel")}
                    className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${mode === "excel" ? "bg-[#DFBD69]/10 border-[#DFBD69] text-[#DFBD69]" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}
                  >
                    <span className="text-sm font-semibold">Upload Excel</span>
                  </button>
                </div>

                {/* Keep Inputs Exactly as requested */}
                {mode === "manual" && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in duration-300">
                    {/* Styled Wrappers for inputs */}
                    {["Symbol", "Company Name", "Industry", "Price", "Quantity", "Average Price", "Total Cost", "Sales"].map((ph) => (
                      <input
                        key={ph}
                        className="bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-sm text-gray-300 focus:border-[#DFBD69]/50 outline-none"
                        placeholder={ph}
                        type={ph === "Company Name" || ph === "Symbol" || ph === "Industry" ? "text" : "number"}
                      />
                    ))}
                  </div>
                )}

                {mode === "excel" && (
                  <div
                    className="border-2 border-dashed border-white/10 rounded-xl h-32 flex flex-col items-center justify-center text-center hover:border-[#DFBD69]/50 hover:bg-[#DFBD69]/5 transition-all cursor-pointer relative"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) setSelectedFile(file);
                    }}
                  >
                    {selectedFile ? (
                      <div className="flex items-center gap-2 text-[#DFBD69]">
                        <FileSpreadsheet className="w-5 h-5" />
                        <span className="text-sm font-medium">{selectedFile.name}</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-300 text-sm font-medium">Click or drag file to upload</p>
                        <p className="text-gray-500 text-xs mt-1">.xlsx or .xls files only</p>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setSelectedFile(file);
                      }}
                    />
                  </div>
                )}

                <button
                  disabled={!portfolioName || !mode}
                  onClick={addPortfolio}
                  className="w-full Cursor-pointer font-encode font-medium bg-gradient-to-r from-[#B28D41] to-[#E9D37E] text-[#0D1325] rounded-lg hover:shadow-lg hover:shadow-[#B28D41]/30 transition-all duration-300 hover:scale-105 px-4 sm:px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Finish Creation
                </button>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div >
  );
}


/* ---------------- REUSABLE UI COMPONENTS ---------------- */

// 1. Metric Card
function MetricCard({ label, value, type, trend, icon: Icon }: any) {
  const isUp = trend === 'up';
  // Use Emerald/Red semantics
  const color = trend ? (isUp ? 'text-emerald-400' : 'text-rose-500') : 'text-white';

  return (
    <div className="bg-[#131B2C]/50 backdrop-blur-xl border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all group relative overflow-hidden">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-gray-600 group-hover:text-[#DFBD69] transition-colors" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold font-mono ${trend ? color : 'text-white'}`}>
          {type === 'currency' ? formatCurrency(value) : value}
        </span>
      </div>
      {trend && (
        <div className={`text-xs font-medium mt-1 flex items-center gap-1 ${color}`}>
          {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {isUp ? "+2.4%" : "-1.2%"} {/* Mock percent */}
        </div>
      )}
    </div>
  )
}

// 2. Tab Button
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TabButton({ active, onClick, label, icon: Icon }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${active ? "bg-white/10 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
    >
      <Icon className={`w-4 h-4 ${active ? "text-[#DFBD69]" : "text-gray-500"}`} />
      {label}
    </button>
  );
}

// 3. Desktop Table with Sparklines
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function HoldingsTable({ data }: { data: any[] }) {
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 bg-white/[0.01]">
          <th className="px-6 py-4 rounded-tl-lg">Symbol</th>
          <th className="px-6 py-4">Industry</th>
          <th className="px-6 py-4 text-right">Price</th>
          <th className="px-6 py-4 text-right">Qty</th>
          <th className="px-6 py-4 text-right">Avg Price</th>
          <th className="px-6 py-4 text-right">Total Cost</th>
          <th className="px-6 py-4 text-right">Sales</th>
          <th className="px-6 py-4 text-right">Today's G/L</th>
          <th className="px-6 py-4 text-right rounded-tr-lg">Unrealized G/L</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        {data.map((row) => (
          <tr key={row.symbol} className="hover:bg-white/[0.02] transition-colors group">
            <td className="px-6 py-4">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white group-hover:text-[#DFBD69] transition-colors">{row.symbol}</span>
                <span className="text-xs text-gray-500">{row.name}</span>
              </div>
            </td>
            <td className="px-6 py-4 text-sm text-white">{row.industry}</td>
            <td className="px-6 py-4 text-right text-sm font-mono text-white">{formatCurrency(row.price)}</td>
            <td className="px-6 py-4 text-right text-sm font-mono text-white">{row.qty}</td>
            <td className="px-6 py-4 text-right text-sm font-mono text-white">{formatCurrency(row.avgPrice)}</td>
            <td className="px-6 py-4 text-right text-sm font-mono text-white">{formatCurrency(row.totalCost)}</td>
            <td className="px-6 py-4 text-right text-sm font-mono text-white">{formatCurrency(row.sales)}</td>
            <td className={`px-6 py-4 text-right text-sm font-mono font-bold ${row.glToday >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
              {row.glToday > 0 ? "+" : ""}{row.glToday.toLocaleString()}
            </td>
            <td className={`px-6 py-4 text-right text-sm font-mono font-bold ${row.unrealizedGL >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
              {row.unrealizedGL > 0 ? "+" : ""}{row.unrealizedGL.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ValuationTable({ data }: { data: any[] }) {
  return (
    <table className="w-full bg-[#131B2C]/60 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden text-left border-collapse">
      <thead>
        <tr className="text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 bg-white/[0.01]">
          <th className="px-6 py-4 rounded-tl-lg">Asset</th>
          <th className="px-6 py-4 text-right">P/E</th>
          <th className="px-6 py-4 text-right">P/B</th>
          <th className="px-6 py-4 text-right">NAV</th>
          <th className="px-6 py-4 text-right">DCF Base</th>
          <th className="px-6 py-4 text-right rounded-tr-lg">Target</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        {data.map((row) => (
          <tr key={row.symbol} className="hover:bg-white/[0.02] transition-colors">
            <td className="px-6 py-4 text-sm font-bold text-white">{row.symbol}</td>
            <td className="px-6 py-4 text-right text-sm font-mono text-white">{row.pe}</td>
            <td className="px-6 py-4 text-right text-sm font-mono text-white">{row.pb}</td>
            <td className="px-6 py-4 text-right text-sm font-mono text-white">{formatCurrency(row.nav)}</td>
            <td className="px-6 py-4 text-right text-sm font-mono text-white font-bold">${row.dcf}</td>
            <td className="px-6 py-4 text-right text-sm font-mono text-white">${row.target}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StockCardMobile({ stock, type }: any) {
  const isProfit = stock.unrealizedGL >= 0;
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-bold text-white">{stock.symbol}</h4>
          <p className="text-xs text-gray-500">{stock.name}</p>
        </div>
        {type === 'holding' && (
          <div className={`text-right font-mono font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-500'}`}>
            {isProfit ? '+' : ''}{formatCurrency(stock.unrealizedGL)}
          </div>
        )}
      </div>
      {/* ... details ... */}
    </div>
  )
}


// 4. Clean Horizontal Bar Chart
function CleanBarChart({ items, totalValue }: { items: any[], totalValue: number }) {
  return (
    <div className="w-full space-y-4">
      {items.map((item, i) => {
        const percentage = (item.value / totalValue) * 100;
        return (
          <div key={i} className="group">
            <div className="flex justify-between items-end mb-1">
              <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">{item.label}</span>
              <span className="text-xs font-mono text-white group-hover:text-emerald-400 transition-colors">
                {formatCurrency(item.value)} <span className="text-gray-400">({percentage.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${percentage}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: i * 0.05 }}
                className="h-full rounded-full"
                style={{ backgroundColor: item.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 5. Glowing Gauge
function GlowingGauge({ value }: { value: number }) {
  const radius = 50;
  const arcLength = Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const offset = arcLength - (pct / 100) * arcLength;

  return (
    <div className="relative w-[200px] h-[80px] flex justify-center">
      <svg width="200" height="80" viewBox="0 0 200 110" className="overflow-visible">
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="10%" stopColor="#b89544" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#DFBD69" />
          </linearGradient>
          <filter id="glow-gauge" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke="#1f2937" strokeWidth="12" strokeLinecap="round" />
        {/* Active Arc */}
        <path
          d="M20,100 A80,80 0 0 1 180,100"
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={offset}
          filter="url(#glow-gauge)"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute bottom-0 text-2xl font-bold text-white drop-shadow-md">{pct}%</div>
    </div>
  )
}

// 6. Sparkline
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d - min) / range) * 100;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-8 overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        points={points}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 7. Promo Card
function PromoCard() {
  return (
    <div className="relative bg-[#DFBD69] rounded-3xl p-6 overflow-hidden shadow-xl flex flex-col justify-center items-start min-h-[180px]">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-multiply" />
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/20 rounded-full blur-2xl" />
      <div className="relative z-10">
        <h3 className="text-black font-black text-xl uppercase tracking-tight mb-2">Stay Ahead.</h3>
        <p className="text-black/80 text-sm font-medium mb-4 max-w-[200px]">
          Upgrade to Premium for real-time order flow and insider activity tracking.
        </p>
        <button className="bg-black text-white px-5 py-2 rounded-lg text-sm font-bold shadow-lg hover:scale-105 transition-transform">
          Upgrade Now
        </button>
      </div>
    </div>
  )
}

function MoverCompactRow({ stock }: any) {
  const isPos = stock.glToday >= 0;
  return (
    <div className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors cursor-pointer group">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${isPos ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-500'}`}>
          {isPos ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
        </div>
        <div>
          <p className="text-sm font-bold text-white">{stock.symbol}</p>
          <p className="text-[10px] text-gray-500">{stock.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-mono font-bold ${isPos ? 'text-emerald-400' : 'text-rose-500'}`}>
          {isPos ? '+' : ''}{stock.glToday}
        </p>
      </div>
    </div>
  )
}

function GainLossCard({ title, subtitle, data, dataKey, maxValue = 10000, icon: Icon }: any) {
  return (
    <div className="bg-[#131B2C]/60 backdrop-blur-xl rounded-3xl p-6 border border-white/5 flex flex-col shadow-lg">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-1">{title}</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
          <Icon className="w-5 h-5 text-[#DFBD69]" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 no-scrollbar space-y-4">
        {data.map((item: any, i: number) => {
          const value = item[dataKey];
          const absValue = Math.abs(value);
          const percentage = (absValue / maxValue) * 100;
          const isPositive = value >= 0;
          const color = isPositive ? '#00ffaaff' : '#e43636ff'; // emerald-500 : red-500

          return (
            <div key={item.symbol} className="group">
              <div className="flex justify-between items-end mb-1">
                <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">{item.symbol}</span>
                <span className={`text-xs font-mono font-bold transition-colors ${isPositive ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {isPositive ? '+' : ''}{formatCurrency(value)}
                </span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex items-center relative">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.min(percentage, 100)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: i * 0.05 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
