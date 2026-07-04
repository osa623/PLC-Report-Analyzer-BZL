"use client";

import MainNav from "@/components/Ui/Stocks/MainNav";
import SecondaryNav from "@/components/Ui/Stocks/RatioNav";
import RatiosSubNav from "@/components/Ui/Stocks/RatiosSubNav";
import CashFlow from "@/components/Pages/Ratios/cash_flow";

export default function IncomeStatementPage() {
  return (
    <main className="min-h-screen text-white">
      <div className="absolute inset-0 -z-10">
      </div>
      <div className="container bg-gradient-to-br from-[#0A0E1A] via-[#0D1425] to-[#182039] mx-auto px-6 py-8 space-y-8">

        {/* TOP NAV */}
        <MainNav />

        {/* SECONDARY NAV */}
        <SecondaryNav />

        {/* SUB NAV: Financials / Graphs */}
        <RatiosSubNav />

        {/* CONTENT */}
        <CashFlow />

      </div>
    </main>
  );
}
