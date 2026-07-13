/**
 * CSE (Colombo Stock Exchange) API Client
 *
 * All functions hit our Next.js proxy at /api/cse/<endpoint>
 * which in turn calls https://www.cse.lk/api/<endpoint>.
 *
 * Response types match the ACTUAL shapes returned by the CSE API.
 */

import type {
  TradeSummaryResponse,
  SharePriceItem,
  CompanyInfoSummary,
  GainerLoserItem,
  MostActiveItem,
  MarketStatusResponse,
  MarketSummaryResponse,
  IndexDataResponse,
  DetailedTradesResponse,
  SectorItem,
  DailyMarketItem,
  ChartDataRequest,
  CompanyChartDataByStockRequest,
  Announcement,
} from "./cse-types";

// ─── internal helper ────────────────────────────────────────────────

const PROXY_BASE = "/api/cse";

async function csePost<T>(
  endpoint: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(`${PROXY_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error ?? `CSE API error: ${res.status} on /${endpoint}`
    );
  }

  return res.json() as Promise<T>;
}

// ─── Trade & Price Data ─────────────────────────────────────────────

/** Get trade summary — returns { reqTradeSummery: [...] } */
export async function getTradeSummary(): Promise<TradeSummaryResponse> {
  return csePost<TradeSummaryResponse>("tradeSummary");
}

/** Get today's share prices — returns plain array */
export async function getTodaySharePrice(): Promise<SharePriceItem[]> {
  return csePost<SharePriceItem[]>("todaySharePrice");
}

/** Get detailed trades — returns { reqDetailTrades: [...] } */
export async function getDetailedTrades(): Promise<DetailedTradesResponse> {
  return csePost<DetailedTradesResponse>("detailedTrades");
}

// ─── Company Info ───────────────────────────────────────────────────

/** Get detailed info for a single security by symbol */
export async function getCompanyInfo(
  symbol: string
): Promise<CompanyInfoSummary> {
  return csePost<CompanyInfoSummary>("companyInfoSummery", { symbol });
}

// ─── Gainers, Losers & Active Trades ────────────────────────────────

/** Get today's top gainers — returns plain array */
export async function getTopGainers(): Promise<GainerLoserItem[]> {
  return csePost<GainerLoserItem[]>("topGainers");
}

/** Get today's top losers — returns plain array */
export async function getTopLosers(): Promise<GainerLoserItem[]> {
  return csePost<GainerLoserItem[]>("topLooses");
}

/** Get most active trades — returns plain array */
export async function getMostActiveTrades(): Promise<MostActiveItem[]> {
  return csePost<MostActiveItem[]>("mostActiveTrades");
}

// ─── Market Status & Summary ────────────────────────────────────────

/** Get market status — returns flat { status: "..." } */
export async function getMarketStatus(): Promise<MarketStatusResponse> {
  return csePost<MarketStatusResponse>("marketStatus");
}

/** Get market summary — returns flat { id, tradeVolume, shareVolume, tradeDate, trades } */
export async function getMarketSummary(): Promise<MarketSummaryResponse> {
  return csePost<MarketSummaryResponse>("marketSummery");
}

/** Get daily market summary — returns array of arrays */
export async function getDailyMarketSummary(): Promise<DailyMarketItem[][]> {
  return csePost<DailyMarketItem[][]>("dailyMarketSummery");
}

// ─── Index Data ─────────────────────────────────────────────────────

/** Get ASPI data — returns flat object */
export async function getAspiData(): Promise<IndexDataResponse> {
  return csePost<IndexDataResponse>("aspiData");
}

/** Get S&P SL20 data — returns flat object */
export async function getSnpData(): Promise<IndexDataResponse> {
  return csePost<IndexDataResponse>("snpData");
}

// ─── Chart Data ─────────────────────────────────────────────────────

/** Get chart data for a stock */
export async function getChartData(
  params: ChartDataRequest
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  return csePost("chartData", params as unknown as Record<string, unknown>);
}

/** Get company chart data by stock ID */
export async function getCompanyChartDataByStock(
  params: CompanyChartDataByStockRequest
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  return csePost(
    "companyChartDataByStock",
    params as unknown as Record<string, unknown>
  );
}

// ─── Sectors ────────────────────────────────────────────────────────

/** Get all sectors — returns plain array */
export async function getAllSectors(): Promise<SectorItem[]> {
  return csePost<SectorItem[]>("allSectors");
}

// ─── Announcements ──────────────────────────────────────────────────

/** New listings and related announcements */
export async function getNewListingsAnnouncements(): Promise<Announcement[]> {
  return csePost<Announcement[]>("getNewListingsRelatedNoticesAnnouncements");
}

/** Buy-in board announcements */
export async function getBuyInBoardAnnouncements(): Promise<Announcement[]> {
  return csePost<Announcement[]>("getBuyInBoardAnnouncements");
}

/** Approved announcements */
export async function getApprovedAnnouncements(): Promise<Announcement[]> {
  return csePost<Announcement[]>("approvedAnnouncement");
}

/** COVID-related announcements */
export async function getCovidAnnouncements(): Promise<Announcement[]> {
  return csePost<Announcement[]>("getCOVIDAnnouncements");
}

/** Financial announcements */
export async function getFinancialAnnouncements(): Promise<Announcement[]> {
  return csePost<Announcement[]>("getFinancialAnnouncement");
}

/** Circular announcements */
export async function getCircularAnnouncements(): Promise<Announcement[]> {
  return csePost<Announcement[]>("circularAnnouncement");
}

/** Directive announcements */
export async function getDirectiveAnnouncements(): Promise<Announcement[]> {
  return csePost<Announcement[]>("directiveAnnouncement");
}

/** Non-compliance announcements */
export async function getNonComplianceAnnouncements(): Promise<Announcement[]> {
  return csePost<Announcement[]>("getNonComplianceAnnouncements");
}
