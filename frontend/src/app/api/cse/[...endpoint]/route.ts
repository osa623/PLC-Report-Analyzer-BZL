/**
 * Next.js API Route — CSE Proxy
 *
 * Proxies POST requests to https://www.cse.lk/api/<endpoint>
 * to avoid browser CORS restrictions.
 *
 * Usage:  POST /api/cse/tradeSummary   →  POST https://www.cse.lk/api/tradeSummary
 *         POST /api/cse/chartData      →  POST https://www.cse.lk/api/chartData
 *
 * The client sends the same JSON body it would send to CSE directly.
 */

import { NextRequest, NextResponse } from "next/server";

const CSE_BASE_URL = "https://www.cse.lk/api";

/** Allowed CSE endpoints (whitelist to prevent open‑proxy abuse) */
const ALLOWED_ENDPOINTS = new Set([
  "companyInfoSummery",
  "tradeSummary",
  "todaySharePrice",
  "topGainers",
  "topLooses",
  "mostActiveTrades",
  "getNewListingsRelatedNoticesAnnouncements",
  "getBuyInBoardAnnouncements",
  "approvedAnnouncement",
  "getCOVIDAnnouncements",
  "getFinancialAnnouncement",
  "circularAnnouncement",
  "directiveAnnouncement",
  "getNonComplianceAnnouncements",
  "marketStatus",
  "marketSummery",
  "aspiData",
  "snpData",
  "chartData",
  "allSectors",
  "detailedTrades",
  "dailyMarketSummery",
  "companyChartDataByStock",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> }
) {
  const { endpoint } = await params;
  const endpointName = endpoint?.join("/");

  if (!endpointName || !ALLOWED_ENDPOINTS.has(endpointName)) {
    return NextResponse.json(
      { error: `Endpoint "${endpointName}" is not allowed` },
      { status: 400 }
    );
  }

  try {
    // Read the body from the client (may be empty for endpoints with no params)
    let body: string | undefined;
    try {
      const json = await request.json();
      body = JSON.stringify(json);
    } catch {
      // No body sent — that's fine for many CSE endpoints
      body = JSON.stringify({});
    }

    const cseResponse = await fetch(`${CSE_BASE_URL}/${endpointName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // Next.js fetch caching: revalidate every 30 seconds for market data
      next: { revalidate: 30 },
    });

    if (!cseResponse.ok) {
      return NextResponse.json(
        {
          error: `CSE API returned ${cseResponse.status}`,
          status: cseResponse.status,
          endpoint: endpointName,
        },
        { status: cseResponse.status }
      );
    }

    const data = await cseResponse.json();

    return NextResponse.json(data, {
      status: 200,
      headers: {
        // Allow browser to cache for 15 seconds
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error(`[CSE Proxy] Error fetching ${endpointName}:`, error);
    return NextResponse.json(
      {
        error: "Failed to fetch data from CSE",
        endpoint: endpointName,
      },
      { status: 502 }
    );
  }
}
