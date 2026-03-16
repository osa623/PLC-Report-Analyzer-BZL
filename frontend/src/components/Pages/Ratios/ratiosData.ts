export type RatioRow = {
  label: string;
  value: number;
};

export type Year = "2020" | "2021" | "2022" | "2023" | "2024";

export const ratiosIncomeDataByYear: Record<Year, RatioRow[]> = {
  2020: [
    { label: "P/E Ratio", value: 532 },
    { label: "P/B Ratio", value: 43 },
    { label: "P/S Ratio", value: 34 },
    { label: "Earnings Yield", value: 78 },
  ],
  2021: [
    { label: "P/E Ratio", value: 545 },
    { label: "P/B Ratio", value: 45 },
    { label: "P/S Ratio", value: 36 },
    { label: "Earnings Yield", value: 82 },
  ],
  2022: [
    { label: "P/E Ratio", value: 560 },
    { label: "P/B Ratio", value: 47 },
    { label: "P/S Ratio", value: 38 },
    { label: "Earnings Yield", value: 85 },
  ],
  2023: [
    { label: "P/E Ratio", value: 575 },
    { label: "P/B Ratio", value: 49 },
    { label: "P/S Ratio", value: 40 },
    { label: "Earnings Yield", value: 90 },
  ],
  2024: [
    { label: "P/E Ratio", value: 590 },
    { label: "P/B Ratio", value: 51 },
    { label: "P/S Ratio", value: 42 },
    { label: "Earnings Yield", value: 95 },
  ],
};

export const ratiosFinancialPositionDataByYear: Record<Year, RatioRow[]> = {
  2020: [
    { label: "P/E Ratio", value: 532 },
    { label: "P/B Ratio", value: 43 },
    { label: "P/S Ratio", value: 34 },
    { label: "Earnings Yield", value: 78 },
  ],
  2021: [
    { label: "P/E Ratio", value: 545 },
    { label: "P/B Ratio", value: 45 },
    { label: "P/S Ratio", value: 36 },
    { label: "Earnings Yield", value: 82 },
  ],
  2022: [
    { label: "P/E Ratio", value: 560 },
    { label: "P/B Ratio", value: 47 },
    { label: "P/S Ratio", value: 38 },
    { label: "Earnings Yield", value: 85 },
  ],
  2023: [
    { label: "P/E Ratio", value: 575 },
    { label: "P/B Ratio", value: 49 },
    { label: "P/S Ratio", value: 40 },
    { label: "Earnings Yield", value: 90 },
  ],
  2024: [
    { label: "P/E Ratio", value: 590 },
    { label: "P/B Ratio", value: 51 },
    { label: "P/S Ratio", value: 42 },
    { label: "Earnings Yield", value: 95 },
  ],
};

export const ratiosCashFlowDataByYear: Record<Year, RatioRow[]> = {
  2020: [
    { label: "P/E Ratio", value: 532 },
    { label: "P/B Ratio", value: 43 },
    { label: "P/S Ratio", value: 34 },
    { label: "Earnings Yield", value: 78 },
  ],
  2021: [
    { label: "P/E Ratio", value: 545 },
    { label: "P/B Ratio", value: 45 },
    { label: "P/S Ratio", value: 36 },
    { label: "Earnings Yield", value: 82 },
  ],
  2022: [
    { label: "P/E Ratio", value: 560 },
    { label: "P/B Ratio", value: 47 },
    { label: "P/S Ratio", value: 38 },
    { label: "Earnings Yield", value: 85 },
  ],
  2023: [
    { label: "P/E Ratio", value: 575 },
    { label: "P/B Ratio", value: 49 },
    { label: "P/S Ratio", value: 40 },
    { label: "Earnings Yield", value: 90 },
  ],
  2024: [
    { label: "P/E Ratio", value: 590 },
    { label: "P/B Ratio", value: 51 },
    { label: "P/S Ratio", value: 42 },
    { label: "Earnings Yield", value: 95 },
  ],
};

export const years: Year[] = ["2020", "2021", "2022", "2023", "2024"];
