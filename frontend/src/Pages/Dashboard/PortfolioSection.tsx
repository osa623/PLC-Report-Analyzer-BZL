"use client";

// Ui imports
import ScrollVelocity from "@/components/Ui/ScrollVelocity";

interface Stock {
  symbol: string;
  name: string;
  quantity: number;
  quantityPct: number; // percentage of portfolio
  avgPrice: number;
  totalCost: number;
  salesProceeds: number;
  price: number;
  unrealizedGL: number;
  unrealizedGLToday: number;
}

interface MarketData {
  symbol: string;
  name: string;
  price: string;
  change: string;
  percentage: number;
}

//calling api to fetch sectors
import {
  useAllSectors,
} from "@/hooks/useCseApi";


const sampleStocks: Stock[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', quantity: 50, quantityPct: 15, avgPrice: 180.00, totalCost: 9000, salesProceeds: 9500, price: 185.92, unrealizedGL: 500, unrealizedGLToday: 60 },
  { symbol: 'TSLA', name: 'Tesla Inc.', quantity: 20, quantityPct: 10, avgPrice: 230.00, totalCost: 4600, salesProceeds: 4800, price: 240.50, unrealizedGL: 200, unrealizedGLToday: -50 },
  { symbol: 'NVDA', name: 'Nvidia Corp.', quantity: 10, quantityPct: 12, avgPrice: 450.00, totalCost: 4500, salesProceeds: 4600, price: 460.15, unrealizedGL: 100, unrealizedGLToday: 35 },
  { symbol: 'JPM', name: 'JPMorgan Chase', quantity: 40, quantityPct: 8, avgPrice: 140.00, totalCost: 5600, salesProceeds: 5800, price: 145.20, unrealizedGL: 200, unrealizedGLToday: 20 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', quantity: 30, quantityPct: 14, avgPrice: 370.00, totalCost: 11100, salesProceeds: 11350, price: 378.85, unrealizedGL: 250, unrealizedGLToday: 40 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', quantity: 15, quantityPct: 7, avgPrice: 135.00, totalCost: 2025, salesProceeds: 2104, price: 140.25, unrealizedGL: 79, unrealizedGLToday: -11 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', quantity: 25, quantityPct: 6, avgPrice: 150.00, totalCost: 3750, salesProceeds: 3807, price: 152.30, unrealizedGL: 57, unrealizedGLToday: 12 },
  { symbol: 'META', name: 'Meta Platforms Inc.', quantity: 18, quantityPct: 5, avgPrice: 470.00, totalCost: 8460, salesProceeds: 8740, price: 485.60, unrealizedGL: 280, unrealizedGLToday: 45 },
  { symbol: 'BAC', name: 'Bank of America', quantity: 60, quantityPct: 4, avgPrice: 32.00, totalCost: 1920, salesProceeds: 1965, price: 32.75, unrealizedGL: 45, unrealizedGLToday: -5 },
  { symbol: 'WMT', name: 'Walmart Inc.', quantity: 12, quantityPct: 3, avgPrice: 160.00, totalCost: 1920, salesProceeds: 1985, price: 165.40, unrealizedGL: 65, unrealizedGLToday: 10 },
];




//mock data for the ASPI and S&P SL20

const MOCK_GAINERS: MarketData[] = [
  { symbol: 'NVDA', name: 'NVIDIA Corp', price: '485.09', change: '+4.2%', percentage: 4.2 },
  { symbol: 'AMD', name: 'Adv. Micro Devices', price: '120.50', change: '+3.5%', percentage: 3.5 },
  { symbol: 'COIN', name: 'Coinbase Global', price: '152.10', change: '+2.8%', percentage: 2.8 },
  { symbol: 'PLTR', name: 'Palantir Tech', price: '17.40', change: '+2.1%', percentage: 2.1 },
  { symbol: 'MARA', name: 'Marathon Digital', price: '23.65', change: '+1.9%', percentage: 1.9 },
  { symbol: 'RIOT', name: 'Riot Platforms', price: '15.80', change: '+1.5%', percentage: 1.5 },
  { symbol: 'MSTR', name: 'MicroStrategy', price: '590.20', change: '+1.2%', percentage: 1.2 },
  { symbol: 'TSLA', name: 'Tesla Inc', price: '245.30', change: '+0.9%', percentage: 0.9 },
  { symbol: 'META', name: 'Meta Platforms', price: '350.15', change: '+0.8%', percentage: 0.8 },
  { symbol: 'MSFT', name: 'Microsoft', price: '375.00', change: '+0.5%', percentage: 0.5 },
];

const MOCK_LOSERS: MarketData[] = [
  { symbol: 'PYPL', name: 'PayPal Holdings', price: '58.20', change: '-3.4%', percentage: -3.4 },
  { symbol: 'ZM', name: 'Zoom Video', price: '68.50', change: '-2.8%', percentage: -2.8 },
  { symbol: 'BABA', name: 'Alibaba Group', price: '72.10', change: '-2.1%', percentage: -2.1 },
  { symbol: 'JD', name: 'JD.com Inc', price: '25.30', change: '-1.9%', percentage: -1.9 },
  { symbol: 'DIS', name: 'Walt Disney', price: '90.50', change: '-1.5%', percentage: -1.5 },
  { symbol: 'PFE', name: 'Pfizer Inc', price: '28.40', change: '-1.2%', percentage: -1.2 },
  { symbol: 'KO', name: 'Coca-Cola', price: '58.10', change: '-0.9%', percentage: -0.9 },
  { symbol: 'VZ', name: 'Verizon', price: '37.80', change: '-0.8%', percentage: -0.8 },
  { symbol: 'T', name: 'AT&T Inc', price: '16.50', change: '-0.6%', percentage: -0.6 },
  { symbol: 'INTC', name: 'Intel Corp', price: '45.20', change: '-0.5%', percentage: -0.5 },
];

// icons

// --- Inline Icons (No Dependencies) ---
const Icons = {
  TrendingUp: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
  ),
  TrendingDown: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
  ),
  ArrowUp: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
  ),
  ArrowDown: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m7 7 10 10"/><path d="M17 7v10H7"/></svg>
  )
};



const currency = "LKR - ";

// Define shared column widths to ensure Header and Body align perfectly
const colWidths = {
  stock: "w-[28%]",
  price: "w-[15%]",
  pe: "w-[12%]",
  dcf: "w-[12%]",
  nav: "w-[12%]",
  pv: "w-[10%]",
  target: "w-[11%]",
};

export default function PortfolioSection() {
  return (
    <section className="relative flex w-full min-h-screen p-4 sm:p-6 md:p-8 lg:p-10 bg-gradient-to-br from-[#0A0E1A] via-[#0D1425] to-[#182039]">
      
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* LEFT PANEL - Main Stocks Table (100%) */}
      <div className="relative min-h-screen h-auto w-full border-r overflow-hidden border-white/5">
        <div className="h-full w-full flex flex-col">
          
          {/* UPPER SECTION */}
          <div className="relative px-1 py-1">
            <div className="w-full relative flex flex-col bg-[#090C1A] min-h-[120px] sm:h-[15vh] md:h-[18vh] lg:h-[20vh]">
              
              {/* Title Section */}
              <div className="flex top-0 flex-col p-2 sm:p-3 md:p-4">
          <div>
               {/* Label */}
              <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-4 bg-linear-to-b froky-400 to-amber-500 rounded-fullm-s" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B28D41] ">
                Market Intelligence
              </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Portfolio Overview
              </h2>
           
          </div>
              </div>

               {/* Search Bar Section */}
                <div className="flex w-full h-[80px] sm:h-[8vh] py-2 left-0 overflow-hidden">
                <div className='relative w-full h-10 items-center  bg-transparent border-t-2 border-gray-800 overflow-hidden top-0 flex items-center px-2 sm:px-4 gap-2'>
                  <input
                  type="text"
                  placeholder="Search stocks..."
                  className="flex-1 h-full bg-transparent text-white font-encode text-sm sm:text-[15px] font-thin outline-none placeholder:text-gray-500"
                  />
                  <button
                  className="flex items-center cursor-pointer gap-1 sm:gap-2 px-4 sm:px-8 lg:px-12 py-1.5 bg-[#B28D41] hover:bg-[#9a7835] text-white rounded-md transition-colors duration-200 text-xs sm:text-sm font-medium"
                  >
                  <svg 
                    className="w-3 h-3 sm:w-4 sm:h-4" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="hidden sm:inline">Search Stocks</span>
                  <span className="sm:hidden">Search</span>
                  </button>
                </div>
                </div>


            </div>
          </div>

          {/* TABLE SECTION */}
          <div className="px-1 sm:px-2 w-full mx-auto mt-2 sm:mt-4">
            
          {/* TABLE HEADER - OPTION 1: Minimalist Dark with Actions */}
          <div className="overflow-x-auto">
          <div className="relative flex w-full min-w-[800px] sm:min-w-0 border-b border-gray-800/60 px-2 sm:px-4 py-2 sm:py-3 mb-2 items-center">

            {/* Column Headers */}
            <div className={`${colWidths.stock} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Stock</div>
            <div className={`${colWidths.price} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Quantity</div>
            <div className={`${colWidths.pe} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Quantity (%)</div>
            <div className={`${colWidths.dcf} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Avg Price</div>
            <div className={`${colWidths.nav} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Total Cost</div>
            <div className={`${colWidths.pv} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Sales Proceeds</div>
            <div className={`${colWidths.nav} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Price</div>
            <div className={`${colWidths.pv} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Unrealized Gain/Loss</div>
            <div className={`${colWidths.target} text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider`}>Unrealized Gain/Loss Today</div>

          </div>
        </div>


            {/* SCROLLABLE BODY */}
            <div className="overflow-x-auto">
              <div className="h-[350px] sm:h-[400px] md:h-[450px] overflow-y-auto hide-scrollbar flex flex-col gap-1 sm:gap-2 mt-2 min-w-[800px] sm:min-w-0">
                {sampleStocks.map((stock) => (
                  <div
                    key={stock.symbol}
                    className="flex w-full items-center bg-[#121C33] rounded-lg px-2 sm:px-4 py-2 sm:py-3 hover:bg-gray-800/70 text-[10px] sm:text-xs transition border border-transparent hover:border-gray-600"
                  >
                    {/* Stock Symbol/Name */}
                    <div className={`${colWidths.stock} flex flex-col font-encode text-gray-200`}>
                      <span className="text-xs sm:text-sm font-bold">{stock.symbol}</span>
                      <span className="text-[0.6rem] sm:text-[0.65rem] text-gray-400 font-thin truncate pr-1 sm:pr-2">{stock.name}</span>
                    </div>

                    {/* Quantity */}
                    <div className={`${colWidths.price} text-gray-200 font-mono`}>{stock.quantity}</div>

                    {/* Quantity (%) */}
                    <div className={`${colWidths.pe} text-gray-300`}>{stock.quantityPct}%</div>

                    {/* Avg Price */}
                    <div className={`${colWidths.dcf} text-gray-300`}>{currency}{stock.avgPrice.toFixed(2)}</div>

                    {/* Total Cost */}
                    <div className={`${colWidths.nav} text-gray-300`}>{currency}{stock.totalCost.toFixed(2)}</div>

                    {/* Sales Proceeds */}
                    <div className={`${colWidths.pv} text-gray-300`}>{currency}{stock.salesProceeds.toFixed(2)}</div>

                    {/* Current Price */}
                    <div className={`${colWidths.nav} text-gray-300`}>{currency}{stock.price.toFixed(2)}</div>

                    {/* Unrealized Gain/Loss */}
                    <div className={`${colWidths.pv} text-gray-300`}>{currency}{stock.unrealizedGL.toFixed(2)}</div>

                    {/* Unrealized Gain/Loss Today */}
                    <div className={`${colWidths.target} text-gray-300`}>{currency}{stock.unrealizedGLToday.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>


        </div>
      </div>
      </div>



    </section>
  );
}