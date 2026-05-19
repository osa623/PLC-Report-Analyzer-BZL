import { create } from 'zustand';
import { env } from '@/config/env';

type SessionState = {
  reportId: string;
  setReportId: (reportId: string) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  reportId: env.defaultReportId,
  setReportId: (reportId) => set({ reportId }),
}));
