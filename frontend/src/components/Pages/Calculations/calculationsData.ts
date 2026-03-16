export type CalculationRow = {
  label: string;
  value: number;
};

export type Year = "2020" | "2021" | "2022" | "2023" | "2024";

export const calculationsIncomeDataByYear: Record<Year, CalculationRow[]> = {
  2020: [
    { label: "Revenue Growth Rate", value: 657 },
    { label: "Gross Profit", value: 667 },
    { label: "Gross Profit Margin", value: 990 },
    { label: "Operating Profit (EBIT)", value: 890 },
  ],
  2021: [
    { label: "Revenue Growth Rate", value: 720 },
    { label: "Gross Profit", value: 725 },
    { label: "Gross Profit Margin", value: 1050 },
    { label: "Operating Profit (EBIT)", value: 945 },
  ],
  2022: [
    { label: "Revenue Growth Rate", value: 780 },
    { label: "Gross Profit", value: 785 },
    { label: "Gross Profit Margin", value: 1100 },
    { label: "Operating Profit (EBIT)", value: 1000 },
  ],
  2023: [
    { label: "Revenue Growth Rate", value: 840 },
    { label: "Gross Profit", value: 850 },
    { label: "Gross Profit Margin", value: 1150 },
    { label: "Operating Profit (EBIT)", value: 1050 },
  ],
  2024: [
    { label: "Revenue Growth Rate", value: 900 },
    { label: "Gross Profit", value: 920 },
    { label: "Gross Profit Margin", value: 1200 },
    { label: "Operating Profit (EBIT)", value: 1100 },
  ],
};

export const calculationsFinancialPositionDataByYear: Record<Year, CalculationRow[]> = {
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

export const calculationsCashFlowDataByYear: Record<Year, CalculationRow[]> = {
  2020: [
    { label: "Interest Income", value: 6567458657 },
    { label: "Interest Expense", value: 4325654667 },
    { label: "Net Interest Income", value: 2241803990 },
    { label: "Operating Income", value: 1674567890 },
  ],
  2021: [
    { label: "Interest Income", value: 7067458657 },
    { label: "Interest Expense", value: 4825654667 },
    { label: "Net Interest Income", value: 2241803990 },
    { label: "Operating Income", value: 1774567890 },
  ],
  2022: [
    { label: "Interest Income", value: 7567458657 },
    { label: "Interest Expense", value: 5325654667 },
    { label: "Net Interest Income", value: 2241803990 },
    { label: "Operating Income", value: 1874567890 },
  ],
  2023: [
    { label: "Interest Income", value: 8067458657 },
    { label: "Interest Expense", value: 5625654667 },
    { label: "Net Interest Income", value: 2441803990 },
    { label: "Operating Income", value: 1974567890 },
  ],
  2024: [
    { label: "Interest Income", value: 8567458657 },
    { label: "Interest Expense", value: 5925654667 },
    { label: "Net Interest Income", value: 2641803990 },
    { label: "Operating Income", value: 2074567890 },
  ],
};

export const years: Year[] = ["2020", "2021", "2022", "2023", "2024"];
