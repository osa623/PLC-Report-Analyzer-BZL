import { create } from "zustand";
import { persist } from "zustand/middleware";

type Company = {
  companyName: string;
  ticker: string;
  sector: string;
  logo: string;
};

type CompanyStore = {
  company: Company;
  setCompany: (company: Company) => void;
  clearCompany: () => void;
};

export const useCompanyStore = create<CompanyStore>()(
  persist(
    (set) => ({
      company: {
        companyName: "",
        ticker: "",
        sector: "",
        logo: "",
      },

      setCompany: (company) => set({ company }),

      clearCompany: () =>
        set({
          company: {
            companyName: "",
            ticker: "",
            sector: "",
            logo: "",
          },
        }),
    }),
    {
      name: "company-storage",
    }
  )
);