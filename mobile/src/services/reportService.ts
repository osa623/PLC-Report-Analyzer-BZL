import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { sampleSnapshot } from '@/constants/sampleData';
import { FinancialMetric, IntelligenceSnapshot, PatternSignal, RatioMetric } from '@/types/finance';

const money = (value: number | undefined, compact = true) => {
  if (value === undefined || !Number.isFinite(value)) return '$0';
  const abs = Math.abs(value);
  // Re-scale from backend numbers (which are raw units)
  if (abs >= 1000000000) {
    return `$${(value / 1000000000).toFixed(2)}B`;
  }
  if (abs >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (abs >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`;
  }
  return `$${value.toFixed(0)}`;
};

function normalizeReportPayload(payload: any): IntelligenceSnapshot {
  if (!payload) return sampleSnapshot;

  const ratiosPayload = payload?.analytics?.ratios || payload?.latest_run?.ratios || {};
  const riskPayload = payload?.analytics?.risk || payload?.latest_run?.risk || {};
  const confidencePayload = payload?.confidence || payload?.latest_run?.scores || {};
  const dataViews = payload?.data_views || {};
  const validated = dataViews.validated_data || {};
  const statements = validated.financial_statements || {};
  
  const incomeStatement = Array.isArray(statements.income_statement) ? statements.income_statement : [];
  const balanceSheet = Array.isArray(statements.balance_sheet) ? statements.balance_sheet : [];
  const cashflow = Array.isArray(statements.cashflow) ? statements.cashflow : [];

  // Extract years dynamically from the ratios payload or validated data
  let years: string[] = Array.isArray(ratiosPayload.detected_years) 
    ? ratiosPayload.detected_years.map(String) 
    : Object.keys(ratiosPayload.by_year || {}).sort((a, b) => Number(a) - Number(b));

  if (years.length === 0) {
    years = ['2025'];
  }

  const latestYear = years[years.length - 1];
  const prevYear = years[years.length - 2];

  const getStatementValue = (statement: any[], keywords: string[], year: string) => {
    const row = statement.find(r => {
      const label = String(r?.label || '').toLowerCase();
      const period = String(r?.period || '');
      return period === year && keywords.some(kw => label.includes(kw));
    });
    return row ? Number(row.value) : undefined;
  };

  const getFinancialMetric = (
    key: string,
    label: string,
    keywords: string[],
    statement: any[],
    accent: 'blue' | 'gold'
  ): FinancialMetric => {
    const rawValue = getStatementValue(statement, keywords, latestYear) || 0;
    const prevValue = prevYear ? getStatementValue(statement, keywords, prevYear) : undefined;

    let change = 'N/A';
    if (prevValue !== undefined && prevValue !== 0) {
      const diff = ((rawValue - prevValue) / Math.abs(prevValue)) * 100;
      change = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
    }

    const valueStr = money(rawValue);
    const prevStr = prevValue !== undefined ? `vs ${prevYear}: ${money(prevValue)}` : 'N/A';

    const trend = years.map(y => getStatementValue(statement, keywords, y) || 0);

    return {
      key,
      label,
      value: valueStr,
      rawValue,
      change,
      previous: prevStr,
      accent,
      trend,
    };
  };

  // Map 5 core financials
  const financials: FinancialMetric[] = [
    getFinancialMetric('revenue', 'Total Revenue', ['revenue', 'turnover', 'sales'], incomeStatement, 'blue'),
    getFinancialMetric('netProfit', 'Net Profit', ['net profit', 'net income', 'profit for', 'profit after tax'], incomeStatement, 'gold'),
    getFinancialMetric('assets', 'Total Assets', ['total assets', 'total non-current assets + current assets'], balanceSheet, 'blue'),
    getFinancialMetric('equity', 'Total Equity', ['total equity', 'shareholder', 'equity attributable'], balanceSheet, 'gold'),
    getFinancialMetric('cashFlow', 'Operating Cash Flow', ['operating cash', 'cash generated from operations', 'net cash from operating'], cashflow, 'blue'),
  ];

  // Map ratios
  const getRatioMetric = (
    key: string,
    label: string,
    category: 'Profitability' | 'Liquidity' | 'Solvency' | 'Efficiency',
    suffix = '%'
  ): RatioMetric => {
    const series = years.map(y => {
      const yrRatios = ratiosPayload.by_year?.[y] || {};
      const val = yrRatios[key] !== undefined ? Number(yrRatios[key]) : (yrRatios[key === 'debt_to_equity' ? 'debt_to_equity_ratio' : key] || 0);
      // Convert margins back to percentages if they are fractions (e.g. 0.25 -> 25)
      const isFractionalMargin = suffix === '%' && val > 0 && val <= 1.0;
      const finalVal = isFractionalMargin ? val * 100 : val;
      return { year: y, value: finalVal };
    });

    const latestVal = series[series.length - 1]?.value || 0;
    const prevVal = series[series.length - 2]?.value;

    let change = 'N/A';
    if (prevVal !== undefined) {
      const diff = latestVal - prevVal;
      change = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}${suffix === '%' ? 'pp' : suffix}`;
    }

    let valueStr = `${latestVal.toFixed(1)}${suffix}`;
    if (suffix === 'x') {
      valueStr = `${latestVal.toFixed(2)}x`;
    }

    return {
      key,
      label,
      value: valueStr,
      change,
      series,
      category,
    };
  };

  const ratios: RatioMetric[] = [
    getRatioMetric('roe', 'ROE', 'Profitability'),
    getRatioMetric('roa', 'ROA', 'Profitability'),
    getRatioMetric('net_margin', 'Net Margin', 'Profitability'),
    getRatioMetric('ebitda_margin', 'EBITDA Margin', 'Profitability'),
    getRatioMetric('operating_margin', 'Operating Margin', 'Profitability'),
    getRatioMetric('gross_margin', 'Gross Margin', 'Profitability'),
    getRatioMetric('current_ratio', 'Current Ratio', 'Liquidity', 'x'),
    getRatioMetric('quick_ratio', 'Quick Ratio', 'Liquidity', 'x'),
    getRatioMetric('cash_ratio', 'Cash Ratio', 'Liquidity', 'x'),
    getRatioMetric('debt_to_equity', 'Debt to Equity', 'Solvency', 'x'),
    getRatioMetric('interest_coverage', 'Interest Coverage', 'Solvency', 'x'),
    getRatioMetric('asset_turnover', 'Asset Turnover', 'Efficiency', 'x'),
  ];

  // Map patterns
  const patternsSource = payload?.analytics?.patterns || payload?.latest_run?.patterns || [];
  const patterns: PatternSignal[] = Array.isArray(patternsSource) && patternsSource.length > 0
    ? patternsSource.map((pattern: any, index: number) => ({
        id: String(pattern.id || `pattern-${index}`),
        title: pattern.title || pattern.name || 'AI Signal',
        status: pattern.status === 'clear' ? 'clear' : 'detected',
        severity: pattern.severity || 'medium',
        confidence: Math.round(Number(pattern.confidence || pattern.score || 75)),
        summary: pattern.summary || pattern.explanation || 'AI pattern engine detected a material signal requiring review.',
      }))
    : sampleSnapshot.patterns;

  // Map AI Insights
  const aiInsights = [
    ...(payload?.transparency?.analysis_limited || []),
    ...(Array.isArray(payload?.narratives?.governance) && payload.narratives.governance.length > 0
      ? [payload.narratives.governance[0]?.summary || payload.narratives.governance[0]]
      : []),
    ...(Array.isArray(payload?.narratives?.risk) && payload.narratives.risk.length > 0
      ? [payload.narratives.risk[0]?.summary || payload.narratives.risk[0]]
      : []),
  ].filter(Boolean);

  if (aiInsights.length === 0) {
    aiInsights.push(...sampleSnapshot.aiInsights);
  }

  const confidenceScore = Math.round(Number(confidencePayload.overall_data_quality_score || confidencePayload.score || 0.92) * 100);

  return {
    company: {
      id: payload?.id || payload?.company_id || sampleSnapshot.company.id,
      name: payload?.name || ratiosPayload.company_name || sampleSnapshot.company.name,
      symbol: payload?.symbol || 'UNKNOWN',
      sector: payload?.sector || 'Diversified',
      reportYear: latestYear,
      confidenceScore,
      reliability: {
        completeness: Math.round((confidencePayload.completeness || 0.95) * 100),
        validation: Math.round((confidencePayload.validation_pass_rate || 0.91) * 100),
        consistency: Math.round((confidencePayload.unit_consistency || 0.93) * 100),
        coverage: Math.round((confidencePayload.ratio_coverage || 0.89) * 100),
      },
    },
    riskScore: Math.round(Number(riskPayload.overall_risk_score || riskPayload.score || sampleSnapshot.riskScore)),
    financials,
    ratios,
    patterns,
    aiInsights,
    years,
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
    } catch (err) {
      console.warn('getSnapshot failed, using sample fallback:', err);
      return sampleSnapshot;
    }
  },

  async listCompanies(): Promise<any[]> {
    try {
      const { data } = await apiClient.get(endpoints.companies);
      return data;
    } catch (err) {
      console.error('listCompanies failed:', err);
      return [];
    }
  },

  async getCompanyAnalysis(companyId: string): Promise<IntelligenceSnapshot> {
    try {
      const { data } = await apiClient.get(endpoints.companyAnalysis(companyId));
      return normalizeReportPayload(data);
    } catch (err) {
      console.error(`getCompanyAnalysis failed for ${companyId}:`, err);
      throw err;
    }
  },

  async uploadReport(
    fileUri: string,
    fileName: string,
    fileType: string,
    meta: { name: string; symbol: string; sector: string }
  ): Promise<{ report_id: string; workflow_state: string }> {
    const formData = new FormData();
    formData.append('report', {
      uri: fileUri,
      name: fileName,
      type: fileType,
    } as any);
    formData.append('name', meta.name);
    formData.append('symbol', meta.symbol);
    formData.append('sector', meta.sector);

    const { data } = await apiClient.post(endpoints.uploadReports, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  async getPipelineStages(reportId: string): Promise<any> {
    try {
      const { data } = await apiClient.get(endpoints.stages(reportId));
      return data;
    } catch (err) {
      console.error(`getPipelineStages failed for ${reportId}:`, err);
      throw err;
    }
  },

  async getDocumentStatuses(reportId: string): Promise<any> {
    try {
      const { data } = await apiClient.get(endpoints.documents(reportId));
      return data;
    } catch (err) {
      console.error(`getDocumentStatuses failed for ${reportId}:`, err);
      throw err;
    }
  },
};
