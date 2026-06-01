/**
 * Shared formatting utilities for the financial dashboard.
 */

export function formatCurrency(value, currency = 'LKR') {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const num = Number(value);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  const symbol = currency === 'USD' ? '$' : currency === 'LKR' ? 'Rs.' : currency;
  if (abs >= 1e9) return `${sign}${symbol}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${symbol}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${symbol}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

export function formatPercentage(value, decimals = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(decimals)}%`;
}

export function formatRatioPercent(value, decimals = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toFixed(decimals)}%`;
}

export function formatLargeNumber(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const num = Number(value);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export function getTrendDirection(current, previous) {
  if (current == null || previous == null) return 'flat';
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return 'flat';
  const change = ((c - p) / Math.abs(p)) * 100;
  if (change > 0.5) return 'up';
  if (change < -0.5) return 'down';
  return 'flat';
}

export function getTrendChange(current, previous) {
  if (current == null || previous == null) return null;
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}

export function getStatusColor(status) {
  if (!status) return 'text-slate-400';
  const s = String(status).toUpperCase();
  if (s === 'PASSED' || s === 'HEALTHY' || s === 'LOW') return 'text-emerald-600';
  if (s === 'WARNING' || s === 'MEDIUM') return 'text-amber-500';
  if (s === 'FAILED' || s === 'CRITICAL' || s === 'HIGH') return 'text-red-500';
  if (s === 'NOT_APPLICABLE') return 'text-slate-400';
  return 'text-slate-600';
}

export function getStatusBg(status) {
  if (!status) return 'bg-slate-100 text-slate-500';
  const s = String(status).toUpperCase();
  if (s === 'PASSED' || s === 'HEALTHY' || s === 'LOW') return 'bg-emerald-50 text-emerald-700';
  if (s === 'WARNING' || s === 'MEDIUM') return 'bg-amber-50 text-amber-700';
  if (s === 'FAILED' || s === 'CRITICAL' || s === 'HIGH') return 'bg-red-50 text-red-700';
  if (s === 'NOT_APPLICABLE') return 'bg-slate-50 text-slate-400';
  return 'bg-slate-100 text-slate-600';
}

export function safeGet(obj, path, fallback = null) {
  if (!obj || typeof obj !== 'object') return fallback;
  const keys = Array.isArray(path) ? path : String(path).split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return fallback;
    current = current[key];
  }
  return current ?? fallback;
}

export function extractYears(data) {
  const years = new Set();
  const extraction = safeGet(data, 'extraction', {});
  const yearData = extraction.years || extraction.financial_graph || {};
  Object.keys(yearData).forEach((y) => { if (/^\d{4}$/.test(y)) years.add(y); });
  // Also check bank/group analysis
  ['bank_analysis', 'group_analysis'].forEach((key) => {
    const entity = safeGet(data, key, {});
    Object.keys(entity).forEach((y) => { if (/^\d{4}$/.test(y)) years.add(y); });
  });
  return [...years].sort((a, b) => Number(b) - Number(a));
}

export const CHART_COLORS = {
  indigo: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
  rose: '#f43f5e',
  teal: '#14b8a6',
};
