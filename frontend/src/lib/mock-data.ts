export type Stage = "Upload" | "Parsing" | "Structure" | "Extraction" | "Validation" | "Analytics" | "Report";
export const STAGES: Stage[] = ["Upload", "Parsing", "Structure", "Extraction", "Validation", "Analytics", "Report"];

export interface ProcessingFile {
  id: string;
  name: string;
  size: string;
  pages: number;
  uploadedAt: string;
  stageIndex: number; // 0..6
  progress: number; // 0..100 within current stage
  confidence: number;
  eta: string;
}

export const processingFiles: ProcessingFile[] = [
  { id: "1", name: "Annual_Report_2023.pdf", size: "12.4 MB", pages: 152, uploadedAt: "2m ago", stageIndex: 3, progress: 87, confidence: 96, eta: "00:01:32" },
  { id: "2", name: "Annual_Report_2022.pdf", size: "10.1 MB", pages: 148, uploadedAt: "4m ago", stageIndex: 4, progress: 60, confidence: 94, eta: "00:02:10" },
  { id: "3", name: "Annual_Report_2021.pdf", size: "8.7 MB",  pages: 136, uploadedAt: "6m ago", stageIndex: 2, progress: 30, confidence: 91, eta: "00:03:45" },
  { id: "4", name: "Annual_Report_2020.pdf", size: "11.2 MB", pages: 142, uploadedAt: "8m ago", stageIndex: 1, progress: 15, confidence: 88, eta: "00:04:20" },
  { id: "5", name: "Annual_Report_2019.pdf", size: "8.9 MB",  pages: 120, uploadedAt: "10m ago", stageIndex: 0, progress: 5,  confidence: 0,  eta: "00:06:10" },
  { id: "6", name: "Q4_Financials_2023.pdf", size: "5.2 MB",  pages: 64,  uploadedAt: "12m ago", stageIndex: 6, progress: 100, confidence: 98, eta: "Done" },
  { id: "7", name: "Q3_Financials_2023.pdf", size: "4.8 MB",  pages: 58,  uploadedAt: "14m ago", stageIndex: 6, progress: 100, confidence: 97, eta: "Done" },
  { id: "8", name: "Sustainability_Report.pdf", size: "14.1 MB", pages: 188, uploadedAt: "16m ago", stageIndex: 5, progress: 40, confidence: 92, eta: "00:01:50" },
  { id: "9", name: "Investor_Presentation.pdf", size: "6.6 MB",  pages: 42,  uploadedAt: "18m ago", stageIndex: 3, progress: 55, confidence: 90, eta: "00:02:30" },
  { id: "10", name: "Audit_Letter_2023.pdf", size: "2.1 MB",  pages: 18,  uploadedAt: "20m ago", stageIndex: 4, progress: 75, confidence: 93, eta: "00:00:45" },
];

export const recentUploads = [
  { name: "Annual_Report_2023.pdf", size: "12.4 MB", time: "Just now", status: "Processing" },
  { name: "Annual_Report_2022.pdf", size: "10.1 MB", time: "2 min ago", status: "Completed" },
  { name: "Q4_Financials_2023.pdf", size: "5.2 MB",  time: "8 min ago", status: "Completed" },
];

export const tocItems = [
  { title: "Corporate Overview", page: 2 },
  { title: "Chairman's Message", page: 5 },
  { title: "Directors' Report", page: 12 },
  { title: "Management Discussion & Analysis", page: 18 },
  { title: "Financial Statements", page: 44, bold: true },
  { title: "Independent Auditor's Report", page: 44 },
  { title: "Balance Sheet", page: 51 },
  { title: "Statement of Profit or Loss", page: 45 },
  { title: "Statement of Cash Flows", page: 58 },
  { title: "Statement of Changes in Equity", page: 72 },
  { title: "Notes to Financial Statements", page: 80 },
];

export const statementSections = [
  { key: "income", label: "Income Statement", pages: "45–57", confidence: 95 },
  { key: "balance", label: "Balance Sheet", pages: "51–57", confidence: 93 },
  { key: "cashflow", label: "Cash Flow Statement", pages: "58–61", confidence: 92 },
  { key: "comprehensive", label: "Comprehensive Income", pages: "48–50", confidence: 90 },
  { key: "equity", label: "Statement of Equity", pages: "62–64", confidence: 91 },
];

// Dashboard
export const years = [2020, 2021, 2022, 2023] as const;
export type Year = (typeof years)[number];

export const kpis = {
  revenue: { value: 1245.8, unit: "M", change: 12.4, series: [820, 902, 1015, 1108, 1180, 1245.8] },
  netProfit: { value: 162.6, unit: "M", change: 8.7, series: [105, 121, 140, 148, 156, 162.6] },
  totalAssets: { value: 2358.7, unit: "M", change: 9.3, series: [1650, 1821, 2158, 2240, 2310, 2358.7] },
  cash: { value: 312.4, unit: "M", change: 15.1, series: [180, 210, 232, 264, 290, 312.4] },
};

export const yearSeries = [
  { year: "2018", revenue: 720, profit: 82,  assets: 1420, equity: 612, cashflow: 140, interest: 38, liabilities: 808 },
  { year: "2019", revenue: 845, profit: 95,  assets: 1535, equity: 648, cashflow: 168, interest: 41, liabilities: 887 },
  { year: "2020", revenue: 982.4, profit: 105.2, assets: 1650.3, equity: 682.1, cashflow: 198, interest: 44, liabilities: 968 },
  { year: "2021", revenue: 1004.6, profit: 121.3, assets: 1821.0, equity: 743.6, cashflow: 232, interest: 46, liabilities: 1077 },
  { year: "2022", revenue: 1107.8, profit: 140.6, assets: 2158.2, equity: 876.4, cashflow: 268, interest: 49, liabilities: 1281 },
  { year: "2023", revenue: 1245.8, profit: 162.6, assets: 2358.7, equity: 954.3, cashflow: 312, interest: 52, liabilities: 1404 },
];

export const calculationRows = [
  { metric: "Revenue (M)",     v: [982.4, 1004.6, 1107.8, 1245.8], growth: 12.4 },
  { metric: "Net Profit (M)",  v: [105.2, 121.3, 140.6, 162.6], growth: 8.7 },
  { metric: "Total Assets (M)",v: [1650.3, 1821.0, 2158.2, 2358.7], growth: 9.3 },
  { metric: "Equity (M)",      v: [682.1, 743.6, 876.4, 954.3], growth: 8.9 },
  { metric: "Current Ratio",   v: [1.52, 1.71, 1.85, 1.92], growth: 3.8 },
  { metric: "ROE (%)",         v: [15.4, 16.3, 17.8, 18.1], growth: 1.7 },
  { metric: "ROA (%)",         v: [6.4, 6.8, 7.1, 7.4], growth: 0.3 },
  { metric: "Debt Ratio (%)",  v: [42.1, 43.2, 45.6, 46.2], growth: 0.6 },
];

export const patterns = [
  { key: "revenue", title: "Revenue Trend", subtitle: "Increasing", delta: "+12.4%", icon: "trending-up", insight: "Strong Revenue Acceleration", body: "Revenue has grown consistently over the last 4 years with an average CAGR of 12.4%. 2023 marks an inflection driven by enterprise expansion.", confidence: 96, impact: "High", recommendation: "Reinforce enterprise sales motion in EMEA and APAC." },
  { key: "profit",  title: "Profitability Trend", subtitle: "Margin Expansion", delta: "+2.3%", icon: "percent", insight: "Operating Leverage Kicking In", body: "Gross margin improved 230bps YoY as unit economics improve and pricing strengthens.", confidence: 94, impact: "High", recommendation: "Lock in supplier contracts to protect gains." },
  { key: "expense", title: "Expense Trend", subtitle: "Operating Cost Growth", delta: "+6.7%", icon: "activity", insight: "Disciplined Investment", body: "Opex grew below revenue, signaling efficient scaling. Headcount focused on R&D.", confidence: 91, impact: "Medium", recommendation: "Maintain hiring discipline in G&A." },
  { key: "cashflow",title: "Cash Flow Trend", subtitle: "Positive", delta: "+15.1%", icon: "wallet", insight: "Cash Generation Strong", body: "Operating cash flow up 15.1% with improving DSO. Free cash conversion at 78%.", confidence: 95, impact: "High", recommendation: "Initiate share buyback or strategic M&A." },
];

export const risks = [
  { key: "liquidity", label: "Liquidity Risk", level: "Low",    score: 22, items: [["Current Ratio", "1.92"], ["Quick Ratio", "1.45"], ["Cash Ratio", "0.68"]] },
  { key: "leverage",  label: "Leverage Risk",  level: "Medium", score: 54, items: [["Debt to Equity", "0.86"], ["Interest Coverage", "4.2x"], ["Debt Ratio", "46.2%"]] },
  { key: "profit",    label: "Profitability Risk", level: "Low", score: 18, items: [["Net Margin", "13.0%"], ["ROA", "7.4%"], ["ROE", "18.1%"]] },
  { key: "growth",    label: "Growth Sustainability", level: "High", score: 78, items: [["Revenue Growth", "12.4%"], ["Earnings Growth", "8.7%"], ["Volatility", "Medium"]] },
];
