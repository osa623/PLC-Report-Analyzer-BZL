/**
 * Type Definitions for the Colombo Stock Exchange (CSE) API
 *
 * Based on ACTUAL tested responses from https://www.cse.lk/api/
 * All endpoints use HTTP POST.
 */

// ─── Trade Summary (POST /tradeSummary) ─────────────────────────────
// Response: { reqTradeSummery: TradeSummaryItem[] }

export interface TradeSummaryItem {
  id: number;
  name: string;
  symbol: string;
  logoUrl: string;
  quantity: number;
  percentageChange: number;
  change: number;
  price: number;
  previousClose: number;
  high: number;
  low: number;
  lastTradedTime: number;
  issueDate: string;
  turnover: number;
  sharevolume: number;
  tradevolume: number;
  marketCap: number;
  marketCapPercentage: number;
  open: number;
  closingPrice: number;
  crossingVolume: number;
  crossingTradeVol: number;
  status: number;
}

export interface TradeSummaryResponse {
  reqTradeSummery: TradeSummaryItem[];
}

// ─── Today Share Price (POST /todaySharePrice) ──────────────────────
// Response: SharePriceItem[]  (plain array — no wrapper)

export interface SharePriceItem {
  id: number;
  symbol: string;
  open: number;
  high: number;
  low: number;
  lastTradedPrice: number;
  change: number;
  changePercentage: number;
  crossingVolume: number;
  tradesTime: number;
  quantity: number;
}

// ─── Top Gainers / Losers (POST /topGainers, /topLooses) ────────────
// Response: GainerLoserItem[]  (plain array — no wrapper)

export interface GainerLoserItem {
  id: number;
  securityId: number;
  symbol: string;
  price: number;
  change: number;
  changePercentage: number;
  tradeDate: number;
}

// ─── Most Active Trades (POST /mostActiveTrades) ────────────────────
// Response: MostActiveItem[]  (plain array — no wrapper)

export interface MostActiveItem {
  id: number;
  securityId: number;
  symbol: string;
  tradeVolume: number;
  shareVolume: number;
  turnover: number;
  percentageShareVolume: number;
}

// ─── Market Status (POST /marketStatus) ─────────────────────────────
// Response: { status: string }  (flat object — no wrapper)

export interface MarketStatusResponse {
  status: string; // e.g. "Regular Trading", "Close", "Pre-Open"
}

// ─── Market Summary (POST /marketSummery) ───────────────────────────
// Response: flat object { id, tradeVolume, shareVolume, tradeDate, trades }

export interface MarketSummaryResponse {
  id: number;
  tradeVolume: number;   // Total turnover
  shareVolume: number;   // Total share volume
  tradeDate: number;     // Timestamp
  trades: number;        // Number of trades
}

// ─── Index Data (POST /aspiData, /snpData) ──────────────────────────
// Response: flat object { id, value, lowValue, highValue, change, percentage, sectorId, timestamp }

export interface IndexDataResponse {
  id: number;
  value: number;
  lowValue: number;
  highValue: number;
  change: number;
  percentage: number;
  sectorId: number;
  timestamp: number;
}

// ─── Detailed Trades (POST /detailedTrades) ─────────────────────────
// Response: { reqDetailTrades: DetailedTradeItem[] }

export interface DetailedTradeItem {
  id: number;
  securityId: number | null;
  name: string;
  symbol: string;
  price: number;
  qty: number;
  trades: number;
  change: number;
  changePercentage: number;
  logoUrl: string;
}

export interface DetailedTradesResponse {
  reqDetailTrades: DetailedTradeItem[];
}

// ─── All Sectors (POST /allSectors) ─────────────────────────────────
// Response: SectorItem[]  (plain array — no wrapper)

export interface SectorItem {
  id: number;
  sectorId: number;
  symbol: string;
  indexCode: string;
  indexCodeSp: string;
  indexName: string;
  name: string;
  indexValue: number;
  change: number;
  percentage: number;
  sectorTradeToday: number;
  sectorVolumeToday: number;
  sectorTurnoverToday: number;
  sectorPreviousClose: number;
  transactionTime: number;
}

// ─── Daily Market Summary (POST /dailyMarketSummery) ────────────────
// Response: DailyMarketItem[][]  (array of arrays)

export interface DailyMarketItem {
  id: number;
  tradeDate: number;
  marketTurnover: number;
  marketTrades: number;
  marketDomestic: number;
  marketForeign: number;
  equityTurnover: number;
  equityDomesticPurchase: number;
  equityDomesticSales: number;
  equityForeignPurchase: number;
  equityForeignSales: number;
  volumeOfTurnOverNumber: number;
  volumeOfTurnoverDomestic: number;
  volumeOfTurnoverForeign: number;
  tradesNo: number;
  tradesNoDomestic: number;
}

// ─── Chart Data ─────────────────────────────────────────────────────

export interface ChartDataRequest {
  symbol: string;
  chartId: string;
  period: string;
}

export interface CompanyChartDataByStockRequest {
  stockId: string;
  period: number;
}

// ─── Company Info (POST /companyInfoSummery) ────────────────────────
// Response shape varies — typed loosely

export interface CompanyInfoSummary {
  [key: string]: unknown;
}

// ─── Announcements ──────────────────────────────────────────────────

export interface Announcement {
  [key: string]: unknown;
  id?: number;
  title?: string;
  description?: string;
  date?: string;
  symbol?: string;
  company?: string;
}

// ─── Generic CSE API error ──────────────────────────────────────────

export interface CseApiError {
  message: string;
  status: number;
  endpoint: string;
}
