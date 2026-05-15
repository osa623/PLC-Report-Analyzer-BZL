import { IntelligenceSnapshot } from '@/types/finance';

export const sampleSnapshot: IntelligenceSnapshot = {
  company: {
    id: 'demo-report',
    name: 'Acme Corporation',
    symbol: 'ACME',
    sector: 'Diversified Financials',
    reportYear: '2025',
    confidenceScore: 92,
    reliability: {
      completeness: 95,
      validation: 91,
      consistency: 93,
      coverage: 89,
    },
  },
  years: ['2021', '2022', '2023', '2024', '2025'],
  riskScore: 34,
  aiInsights: [
    'Strong profitability and efficient operations are driving sustainable value creation.',
    'Revenue acceleration is supported by margin discipline and cash conversion quality.',
    'Governance disclosure density is stable with no high-severity ESG divergence detected.',
  ],
  financials: [
    { key: 'revenue', label: 'Total Revenue', value: '$2.84B', rawValue: 2840, change: '+18.4%', previous: 'vs 2024: $2.40B', accent: 'blue', trend: [18, 34, 46, 61, 47, 86] },
    { key: 'netProfit', label: 'Net Profit', value: '$458M', rawValue: 458, change: '+22.7%', previous: 'vs 2024: $373M', accent: 'gold', trend: [24, 40, 56, 70, 54, 86] },
    { key: 'assets', label: 'Total Assets', value: '$3.67B', rawValue: 3670, change: '+12.6%', previous: 'vs 2024: $3.26B', accent: 'blue', trend: [22, 43, 54, 74, 41, 86] },
    { key: 'equity', label: 'Total Equity', value: '$1.58B', rawValue: 1580, change: '+15.3%', previous: 'vs 2024: $1.37B', accent: 'gold', trend: [20, 39, 50, 63, 42, 81] },
    { key: 'cashFlow', label: 'Operating Cash Flow', value: '$612M', rawValue: 612, change: '+17.1%', previous: 'vs 2024: $523M', accent: 'blue', trend: [18, 42, 55, 73, 39, 86] },
  ],
  ratios: [
    { key: 'roe', label: 'ROE', value: '21.3%', change: '+2.6pp', category: 'Profitability', series: [{ year: '2021', value: 14.4 }, { year: '2022', value: 15.5 }, { year: '2023', value: 16.8 }, { year: '2024', value: 18.7 }, { year: '2025', value: 21.3 }] },
    { key: 'roa', label: 'ROA', value: '13.8%', change: '+1.8pp', category: 'Profitability', series: [{ year: '2021', value: 9.1 }, { year: '2022', value: 10.3 }, { year: '2023', value: 11.2 }, { year: '2024', value: 12.0 }, { year: '2025', value: 13.8 }] },
    { key: 'netMargin', label: 'Net Margin', value: '16.1%', change: '+2.1pp', category: 'Profitability', series: [{ year: '2021', value: 10.4 }, { year: '2022', value: 11.8 }, { year: '2023', value: 13.2 }, { year: '2024', value: 14.0 }, { year: '2025', value: 16.1 }] },
    { key: 'ebitda', label: 'EBITDA Margin', value: '24.7%', change: '+2.2pp', category: 'Profitability', series: [{ year: '2021', value: 18.2 }, { year: '2022', value: 19.1 }, { year: '2023', value: 21.0 }, { year: '2024', value: 22.5 }, { year: '2025', value: 24.7 }] },
    { key: 'opMargin', label: 'Operating Margin', value: '18.9%', change: '+2.4pp', category: 'Profitability', series: [{ year: '2021', value: 13.1 }, { year: '2022', value: 14.2 }, { year: '2023', value: 15.4 }, { year: '2024', value: 16.5 }, { year: '2025', value: 18.9 }] },
    { key: 'grossMargin', label: 'Gross Margin', value: '28.6%', change: '+1.7pp', category: 'Profitability', series: [{ year: '2021', value: 22.1 }, { year: '2022', value: 23.8 }, { year: '2023', value: 25.2 }, { year: '2024', value: 26.9 }, { year: '2025', value: 28.6 }] },
    { key: 'fcfQuality', label: 'FCF Quality', value: '0.92', change: 'Good', category: 'Efficiency', series: [{ year: '2021', value: 0.74 }, { year: '2022', value: 0.79 }, { year: '2023', value: 0.83 }, { year: '2024', value: 0.88 }, { year: '2025', value: 0.92 }] },
    { key: 'assetTurnover', label: 'Asset Turnover', value: '0.78x', change: '+0.05x', category: 'Efficiency', series: [{ year: '2021', value: 0.62 }, { year: '2022', value: 0.66 }, { year: '2023', value: 0.70 }, { year: '2024', value: 0.73 }, { year: '2025', value: 0.78 }] },
    { key: 'debtEquity', label: 'Debt to Equity', value: '0.68x', change: '-0.06x', category: 'Solvency', series: [{ year: '2021', value: 1.1 }, { year: '2022', value: 1.0 }, { year: '2023', value: 0.91 }, { year: '2024', value: 0.74 }, { year: '2025', value: 0.68 }] },
    { key: 'currentRatio', label: 'Current Ratio', value: '1.42x', change: '+0.15x', category: 'Liquidity', series: [{ year: '2021', value: 1.05 }, { year: '2022', value: 1.12 }, { year: '2023', value: 1.20 }, { year: '2024', value: 1.27 }, { year: '2025', value: 1.42 }] },
    { key: 'quickRatio', label: 'Quick Ratio', value: '1.08x', change: '+0.12x', category: 'Liquidity', series: [{ year: '2021', value: 0.80 }, { year: '2022', value: 0.86 }, { year: '2023', value: 0.92 }, { year: '2024', value: 0.96 }, { year: '2025', value: 1.08 }] },
  ],
  patterns: [
    { id: 'p1', title: 'Revenue Acceleration Anomaly', status: 'detected', severity: 'critical', confidence: 87, summary: 'Revenue growth significantly higher than industry trend.' },
    { id: 'p2', title: 'Related Party Transactions', status: 'clear', severity: 'low', confidence: 12, summary: 'No significant related party transactions detected.' },
    { id: 'p3', title: 'Margin Degradation Risk', status: 'detected', severity: 'medium', confidence: 74, summary: 'Operating margin declining for 2 consecutive years.' },
    { id: 'p4', title: 'Earnings Manipulation Indicators', status: 'clear', severity: 'low', confidence: 18, summary: 'No strong evidence of earnings manipulation detected.' },
    { id: 'p5', title: 'Cash Flow Quality Risk', status: 'detected', severity: 'medium', confidence: 68, summary: 'Cash flow quality lower than recommended threshold.' },
  ],
};
