export type MetricPoint = {
  year: string;
  value: number;
};

export type FinancialMetric = {
  key: string;
  label: string;
  value: string;
  rawValue: number;
  change: string;
  previous: string;
  accent: 'blue' | 'gold' | 'green' | 'red';
  trend: number[];
};

export type RatioMetric = {
  key: string;
  label: string;
  value: string;
  change: string;
  series: MetricPoint[];
  category: 'Profitability' | 'Liquidity' | 'Solvency' | 'Efficiency';
};

export type PatternSignal = {
  id: string;
  title: string;
  status: 'detected' | 'clear';
  severity: 'critical' | 'medium' | 'low';
  confidence: number;
  summary: string;
};

export type CompanyProfile = {
  id: string;
  name: string;
  symbol: string;
  sector: string;
  reportYear: string;
  confidenceScore: number;
  reliability: {
    completeness: number;
    validation: number;
    consistency: number;
    coverage: number;
  };
};

export type IntelligenceSnapshot = {
  company: CompanyProfile;
  financials: FinancialMetric[];
  ratios: RatioMetric[];
  patterns: PatternSignal[];
  riskScore: number;
  aiInsights: string[];
  years: string[];
};
