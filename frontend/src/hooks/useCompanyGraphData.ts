"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { dataApi, type ExtractedDataRecord } from "@/lib/api";

/* ───────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────── */

export interface ChartSeries {
    label: string;
    data: { year: string; value: number }[];
    color: string;
}

export interface UseCompanyGraphDataResult {
    /** One series per metric, each containing { year, value }[] */
    series: ChartSeries[];
    /** Sorted list of available years */
    years: string[];
    /** Company ticker from URL */
    symbol: string | null;
    loading: boolean;
    error: string | null;
}

/* ───────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────── */

function extractSymbolBase(raw: string): string {
    if (!raw) return "";
    return raw.split(".")[0].trim().toUpperCase();
}

/** Default color palette for chart series */
const PALETTE = [
    "#4ADE80", // green
    "#60A5FA", // blue
    "#FBBF24", // amber
    "#F87171", // red
    "#A78BFA", // purple
    "#FB7185", // pink
    "#2DD4BF", // teal
    "#818CF8", // indigo
    "#F59E0B", // orange
    "#34D399", // emerald
];

/* ───────────────────────────────────────────────
   Type-filter keywords
   ─────────────────────────────────────────────── */

const INCOME_KEYS = [
    "income",
    "income_statement",
    "profit_and_loss",
    "profit_loss",
    "statement_of_profit",
    "consolidated_income",
    "revenue",
    "earnings",
];

const FINANCIAL_POSITION_KEYS = [
    "financial_position",
    "balance_sheet",
    "statement_of_financial",
    "assets_liabilities",
    "consolidated_statement_of_financial",
];

const CASH_FLOW_KEYS = [
    "cash_flow",
    "cash_flows",
    "statement_of_cash",
    "consolidated_cash",
];

export type ReportCategory = "income" | "financial_position" | "cash_flow";

function getCategoryKeywords(category: ReportCategory): string[] {
    switch (category) {
        case "income":
            return INCOME_KEYS;
        case "financial_position":
            return FINANCIAL_POSITION_KEYS;
        case "cash_flow":
            return CASH_FLOW_KEYS;
    }
}

/**
 * From a record's `.data` object, find a top-level key that matches the
 * category keywords, then return the value (which is usually an array of
 * data rows). Falls back to the full data object if no match found.
 */
function extractCategoryData(
    data: Record<string, unknown>,
    category: ReportCategory
): Record<string, unknown> | unknown[] {
    const keywords = getCategoryKeywords(category);

    for (const [key, val] of Object.entries(data)) {
        const k = key.toLowerCase().replace(/\s+/g, "_");
        if (keywords.some((kw) => k.includes(kw))) {
            if (Array.isArray(val)) return val;
            if (typeof val === "object" && val !== null)
                return val as Record<string, unknown>;
        }
    }

    return data;
}

/**
 * Flatten a data section into { label → number } pairs.
 * Handles both array-of-objects (with "Label"/"Value" columns) and flat objects.
 */
function flattenToLabelValue(
    raw: Record<string, unknown> | unknown[]
): Record<string, number> {
    const result: Record<string, number> = {};

    if (Array.isArray(raw)) {
        for (const item of raw) {
            if (typeof item !== "object" || item === null) continue;
            const obj = item as Record<string, unknown>;

            // Try common column name patterns
            const labelKey = Object.keys(obj).find((k) =>
                /^(label|item|description|particular|name)/i.test(k)
            );

            if (labelKey) {
                const label = String(obj[labelKey] || "");
                // Collect ALL numeric columns as potential values
                for (const [k, v] of Object.entries(obj)) {
                    if (k === labelKey) continue;
                    if (k.toLowerCase().includes("note")) continue;
                    const num = Number(v);
                    if (!isNaN(num) && label) {
                        // Append the column name to distinguish multi-year columns
                        const seriesKey =
                            Object.keys(obj).filter(
                                (x) => x !== labelKey && !x.toLowerCase().includes("note")
                            ).length > 1
                                ? `${label}`
                                : label;
                        // Use the FIRST numeric column as the primary value
                        if (!(seriesKey in result)) {
                            result[seriesKey] = num;
                        }
                    }
                }
            } else {
                // Fallback: treat each key-value as label-value
                for (const [k, v] of Object.entries(obj)) {
                    const num = Number(v);
                    if (!isNaN(num)) result[k] = num;
                }
            }
        }
    } else {
        // Flat object
        for (const [k, v] of Object.entries(raw)) {
            if (typeof v === "number") {
                result[k] = v;
            } else if (typeof v === "string") {
                const num = Number(v.replace(/,/g, ""));
                if (!isNaN(num)) result[k] = num;
            }
        }
    }

    return result;
}

/* ───────────────────────────────────────────────
   The Hook
   ─────────────────────────────────────────────── */

interface UseCompanyGraphDataOptions {
    /**
     * Which report-data category to filter for.
     * E.g. "income" → only income-statement records.
     */
    category: ReportCategory;
    /**
     * Specific metric labels to chart.
     * If omitted, all numeric fields found are charted.
     */
    metrics?: string[];
}

export function useCompanyGraphData(
    options: UseCompanyGraphDataOptions
): UseCompanyGraphDataResult {
    const { category, metrics } = options;
    const params = useParams<{ symbol?: string }>();

    const rawSymbol = params?.symbol
        ? decodeURIComponent(params.symbol)
        : null;
    const symbol = rawSymbol ? extractSymbolBase(rawSymbol) : null;

    const [series, setSeries] = useState<ChartSeries[]>([]);
    const [years, setYears] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    const fetchData = useCallback(async () => {
        if (!symbol) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const res = await dataApi.getCompanyDataByName(symbol);
            const records: ExtractedDataRecord[] = res.data || [];

            if (records.length === 0) {
                if (mountedRef.current) {
                    setError("No data found for this company");
                    setLoading(false);
                }
                return;
            }

            // Gather unique sorted years
            const uniqueYears = Array.from(
                new Set(records.map((r) => r.year))
            ).sort((a, b) => Number(a) - Number(b));

            // For each year, extract the relevant category data & flatten
            const yearDataMap: Record<string, Record<string, number>> = {};

            for (const record of records) {
                const catData = extractCategoryData(
                    record.data as Record<string, unknown>,
                    category
                );
                const flat = flattenToLabelValue(catData);

                // Merge: a year may have multiple records; keep first non-zero
                if (!yearDataMap[record.year]) {
                    yearDataMap[record.year] = {};
                }
                for (const [label, value] of Object.entries(flat)) {
                    if (!(label in yearDataMap[record.year]) || yearDataMap[record.year][label] === 0) {
                        yearDataMap[record.year][label] = value;
                    }
                }
            }

            // Determine which metric labels to chart
            const allLabels = new Set<string>();
            for (const flat of Object.values(yearDataMap)) {
                for (const label of Object.keys(flat)) {
                    allLabels.add(label);
                }
            }

            const targetLabels = metrics
                ? metrics.filter((m) => allLabels.has(m))
                : Array.from(allLabels).slice(0, 8); // Limit to 8 charts max

            // Build chart series
            const builtSeries: ChartSeries[] = targetLabels.map(
                (label, idx) => ({
                    label,
                    color: PALETTE[idx % PALETTE.length],
                    data: uniqueYears.map((year) => ({
                        year,
                        value: yearDataMap[year]?.[label] ?? 0,
                    })),
                })
            );

            if (mountedRef.current) {
                setSeries(builtSeries);
                setYears(uniqueYears);
            }
        } catch (err: unknown) {
            if (mountedRef.current) {
                setError(
                    err instanceof Error ? err.message : "Failed to load chart data"
                );
            }
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [symbol, category, metrics]);

    useEffect(() => {
        mountedRef.current = true;
        fetchData();
        return () => {
            mountedRef.current = false;
        };
    }, [fetchData]);

    return { series, years, symbol, loading, error };
}
