export type RootTabParamList = {
  Home: undefined;
  Reports: undefined;
  Analytics: undefined;
  Alerts: undefined;
  More: undefined;
  // Old analysis tabs — kept for the "More" or "Analyzer" flow
  Dashboard: undefined;
  Financials: undefined;
  Ratios: undefined;
  Patterns: undefined;
  Insights: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  AnalyzerTabs: undefined;
  ProcessingPipeline: undefined;
  DocumentThreads: undefined;
  DocumentProcessing: { reportId: string };
};
