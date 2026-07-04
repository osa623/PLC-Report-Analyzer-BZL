/**
 * React Hooks for CSE (Colombo Stock Exchange) API
 *
 * Types match the ACTUAL CSE API response shapes.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useTradeSummary();
 *   const { data } = useTopGainers();
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
} from "../lib/cse-types";

import {
  getTradeSummary,
  getTodaySharePrice,
  getDetailedTrades,
  getCompanyInfo,
  getTopGainers,
  getTopLosers,
  getMostActiveTrades,
  getMarketStatus,
  getMarketSummary,
  getDailyMarketSummary,
  getAspiData,
  getSnpData,
  getChartData,
  getCompanyChartDataByStock,
  getAllSectors,
  getNewListingsAnnouncements,
  getBuyInBoardAnnouncements,
  getApprovedAnnouncements,
  getCovidAnnouncements,
  getFinancialAnnouncements,
  getCircularAnnouncements,
  getDirectiveAnnouncements,
  getNonComplianceAnnouncements,
} from "../lib/cse-api";

// ─── Generic hook ───────────────────────────────────────────────────

export interface UseCseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseCseQueryOptions {
  /** Auto-refetch interval in ms (0 = disabled). Default 0. */
  refetchInterval?: number;
  /** Skip the initial fetch (useful when a param is not yet available). */
  enabled?: boolean;
}

function useCseQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: UseCseQueryOptions = {}
): UseCseQueryResult<T> {
  const { refetchInterval = 0, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) setData(result);
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    mountedRef.current = true;
    execute();
    return () => {
      mountedRef.current = false;
    };
  }, [execute]);

  useEffect(() => {
    if (refetchInterval <= 0 || !enabled) return;
    const id = setInterval(execute, refetchInterval);
    return () => clearInterval(id);
  }, [refetchInterval, enabled, execute]);

  return { data, loading, error, refetch: execute };
}

// ─── Trade & Price Hooks ────────────────────────────────────────────

/** { reqTradeSummery: TradeSummaryItem[] } */
export function useTradeSummary(options?: UseCseQueryOptions) {
  return useCseQuery<TradeSummaryResponse>(getTradeSummary, [], options);
}

/** Returns plain SharePriceItem[] */
export function useTodaySharePrice(options?: UseCseQueryOptions) {
  return useCseQuery<SharePriceItem[]>(getTodaySharePrice, [], options);
}

/** { reqDetailTrades: DetailedTradeItem[] } */
export function useDetailedTrades(options?: UseCseQueryOptions) {
  return useCseQuery<DetailedTradesResponse>(getDetailedTrades, [], options);
}

// ─── Company Info ───────────────────────────────────────────────────

export function useCompanyInfo(
  symbol: string | null | undefined,
  options?: UseCseQueryOptions
) {
  return useCseQuery<CompanyInfoSummary>(
    () => getCompanyInfo(symbol!),
    [symbol],
    { ...options, enabled: !!symbol && (options?.enabled ?? true) }
  );
}

// ─── Gainers / Losers / Active ──────────────────────────────────────

/** Returns plain GainerLoserItem[] */
export function useTopGainers(options?: UseCseQueryOptions) {
  return useCseQuery<GainerLoserItem[]>(getTopGainers, [], options);
}

/** Returns plain GainerLoserItem[] */
export function useTopLosers(options?: UseCseQueryOptions) {
  return useCseQuery<GainerLoserItem[]>(getTopLosers, [], options);
}

/** Returns plain MostActiveItem[] */
export function useMostActiveTrades(options?: UseCseQueryOptions) {
  return useCseQuery<MostActiveItem[]>(getMostActiveTrades, [], options);
}

// ─── Market Status & Summary ────────────────────────────────────────

/** Returns flat { status: "Regular Trading" } */
export function useMarketStatus(options?: UseCseQueryOptions) {
  return useCseQuery<MarketStatusResponse>(getMarketStatus, [], options);
}

/** Returns flat { id, tradeVolume, shareVolume, tradeDate, trades } */
export function useMarketSummary(options?: UseCseQueryOptions) {
  return useCseQuery<MarketSummaryResponse>(getMarketSummary, [], options);
}

/** Returns DailyMarketItem[][] */
export function useDailyMarketSummary(options?: UseCseQueryOptions) {
  return useCseQuery<DailyMarketItem[][]>(getDailyMarketSummary, [], options);
}

// ─── Index Data ─────────────────────────────────────────────────────

/** Returns flat { value, change, percentage, ... } for ASPI */
export function useAspiData(options?: UseCseQueryOptions) {
  return useCseQuery<IndexDataResponse>(getAspiData, [], options);
}

/** Returns flat { value, change, percentage, ... } for S&P SL20 */
export function useSnpData(options?: UseCseQueryOptions) {
  return useCseQuery<IndexDataResponse>(getSnpData, [], options);
}

// ─── Chart Data ─────────────────────────────────────────────────────

export function useChartData(params: ChartDataRequest | null, options?: UseCseQueryOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useCseQuery<any>(
    () => getChartData(params!),
    [params?.symbol, params?.chartId, params?.period],
    { ...options, enabled: !!params && (options?.enabled ?? true) }
  );
}

export function useCompanyChartDataByStock(params: CompanyChartDataByStockRequest | null, options?: UseCseQueryOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useCseQuery<any>(
    () => getCompanyChartDataByStock(params!),
    [params?.stockId, params?.period],
    { ...options, enabled: !!params && (options?.enabled ?? true) }
  );
}

// ─── Sectors ────────────────────────────────────────────────────────

/** Returns plain SectorItem[] */
export function useAllSectors(options?: UseCseQueryOptions) {
  return useCseQuery<SectorItem[]>(getAllSectors, [], options);
}

// ─── Announcements  (all return Announcement[]) ─────────────────────

export function useNewListingsAnnouncements(options?: UseCseQueryOptions) {
  return useCseQuery<Announcement[]>(getNewListingsAnnouncements, [], options);
}

export function useBuyInBoardAnnouncements(options?: UseCseQueryOptions) {
  return useCseQuery<Announcement[]>(getBuyInBoardAnnouncements, [], options);
}

export function useApprovedAnnouncements(options?: UseCseQueryOptions) {
  return useCseQuery<Announcement[]>(getApprovedAnnouncements, [], options);
}

export function useCovidAnnouncements(options?: UseCseQueryOptions) {
  return useCseQuery<Announcement[]>(getCovidAnnouncements, [], options);
}

export function useFinancialAnnouncements(options?: UseCseQueryOptions) {
  return useCseQuery<Announcement[]>(getFinancialAnnouncements, [], options);
}

export function useCircularAnnouncements(options?: UseCseQueryOptions) {
  return useCseQuery<Announcement[]>(getCircularAnnouncements, [], options);
}

export function useDirectiveAnnouncements(options?: UseCseQueryOptions) {
  return useCseQuery<Announcement[]>(getDirectiveAnnouncements, [], options);
}

export function useNonComplianceAnnouncements(options?: UseCseQueryOptions) {
  return useCseQuery<Announcement[]>(getNonComplianceAnnouncements, [], options);
}
