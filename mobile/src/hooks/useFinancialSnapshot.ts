import { useQuery } from '@tanstack/react-query';
import { useCompanyId } from '@/context/CompanyContext';
import { env } from '@/config/env';
import { reportService } from '@/services/reportService';

/**
 * Fetches the full IntelligenceSnapshot for the current company.
 * Reads companyId from CompanyContext (set by AnalyzerTabNavigator).
 * Falls back to env.defaultReportId when used outside the Analyzer flow.
 */
export function useFinancialSnapshot(overrideId?: string) {
  const contextId = useCompanyId();
  const companyId = overrideId || contextId || env.defaultReportId;
  const isDemo = companyId === 'demo-report';

  return useQuery({
    queryKey: ['financial-snapshot', companyId],
    queryFn: () =>
      isDemo
        ? reportService.getSnapshot(companyId)
        : reportService.getCompanyAnalysis(companyId),
    staleTime: 60_000,
    gcTime: 1000 * 60 * 30,
    retry: 2,
    refetchInterval: 30_000,
  });
}
