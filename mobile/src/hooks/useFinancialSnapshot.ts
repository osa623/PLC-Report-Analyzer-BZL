import { useQuery } from '@tanstack/react-query';
import { env } from '@/config/env';
import { reportService } from '@/services/reportService';

export function useFinancialSnapshot(reportId = env.defaultReportId) {
  return useQuery({
    queryKey: ['financial-snapshot', reportId],
    queryFn: () => reportService.getSnapshot(reportId),
    staleTime: 60_000,
    gcTime: 1000 * 60 * 30,
    retry: 2,
    refetchInterval: 30_000,
  });
}
