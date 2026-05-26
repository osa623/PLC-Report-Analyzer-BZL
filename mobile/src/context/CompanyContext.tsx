import { createContext, useContext } from 'react';

type CompanyCtx = {
  companyId: string;
};

const CompanyContext = createContext<CompanyCtx>({ companyId: 'demo-report' });

export const CompanyProvider = CompanyContext.Provider;

export function useCompanyId() {
  return useContext(CompanyContext).companyId;
}
