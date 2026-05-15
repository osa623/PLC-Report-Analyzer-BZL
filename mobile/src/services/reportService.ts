import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { sampleSnapshot } from '@/constants/sampleData';
import { FinancialMetric, IntelligenceSnapshot, PatternSignal, RatioMetric } from '@/types/finance';

const money = (value: number | undefined, compact = true) => {
  if (!Number.isFinite(value)) return '$0';
  const abs = Math.abs(value as number);
  const suffix = compact && abs >= 1000 ? 'B' : 'M';
  const divisor = compact && abs >= 1000 ? 1000 : 1;
  return `$${((value as number) / divisor).toFixed(abs >= 1000 ? 2 : 0)}${suffix}`;
};

const readRatio = (ratios: Record<string, unknown>, key: string, fallback: RatioMetric) => {
  const value = Number(ratios[key]);
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : fallback.value;
};

function normalizeReportPayload(payload: any): IntelligenceSnapshot {
  const ratiosPayload = payload?.analytics?.ratios || {};
  const riskPayload = payload?.analytics?.risk || {};
  const confidence = payload?.confidence || {};
  const statements = payload?.data_views?.validated_data?.financial_statements || {};
  const latestIncome = Array.isArray(statements.income_statement) ? statements.income_statement : [];
  const latestBalance = Array.isArray(statements.balance_sheet) ? statements.balance_sheet : [];
  const findValue = (rows: any[], label: string) => rows.find((row) => String(row?.label || '').toLowerCase().includes(label))?.value;
  const revenue = findValue(latestIncome, 'revenue');
  const netProfit = findValue(latestIncome, 'net');
  const assets = findValue(latestBalance, 'asset');
  const equity = findValue(latestBalance, 'equity');

  const financials: FinancialMetric[] = sampleSnapshot.financials.map((metric) => {
    const raw = metric.key === 'revenue' ? revenue : metric.key === 'netProfit' ? netProfit : metric.key === 'assets' ? assets : metric.key === 'equity' ? equity : undefined;
    return raw ? { ...metric, value: money(raw), rawValue: raw } : metric;
  });

  const ratios = sampleSnapshot.ratios.map((ratio) => ({
    ...ratio,
    value: readRatio(ratiosPayload, ratio.key, ratio),
  }));

  const patterns: PatternSignal[] = Array.isArray(payload?.analytics?.patterns) && payload.analytics.patterns.length
    ? payload.analytics.patterns.slice(0, 8).map((pattern: any, index: number) => ({
        id: String(pattern.id || `pattern-${index}`),
        title: pattern.title || pattern.name || sampleSnapshot.patterns[index % sampleSnapshot.patterns.length].title,
        status: pattern.status === 'clear' ? 'clear' : 'detected',
        severity: pattern.severity || 'medium',
        confidence: Math.round(Number(pattern.confidence || pattern.score || 70)),
        summary: pattern.summary || pattern.explanation || 'AI pattern engine detected a material signal requiring analyst review.',
      }))
    : sampleSnapshot.patterns;

  return {
    ...sampleSnapshot,
    company: {
      id: payload?.id || sampleSnapshot.company.id,
      name: payload?.name || sampleSnapshot.company.name,
      symbol: payload?.symbol || sampleSnapshot.company.symbol,
      sector: payload?.sector || sampleSnapshot.company.sector,
      reportYear: sampleSnapshot.company.reportYear,
      confidenceScore: Math.round(Number(confidence.overall_data_quality_score || confidence.score || 0.92) * 100),
      reliability: sampleSnapshot.company.reliability,
    },
    riskScore: Math.round(Number(riskPayload.overall_risk_score || riskPayload.score || sampleSnapshot.riskScore)),
    financials,
    ratios,
    patterns,
  };
}

export const reportService = {
  async getSnapshot(reportId: string): Promise<IntelligenceSnapshot> {
    if (reportId === 'demo-report') {
      return sampleSnapshot;
    }
    try {
      const { data } = await apiClient.get(endpoints.report(reportId));
      return normalizeReportPayload(data);
    } catch {
      return sampleSnapshot;
    }
  },
};
