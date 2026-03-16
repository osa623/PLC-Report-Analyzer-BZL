"use client";

import MainNav from "@/components/Ui/Stocks/MainNav";
import SecondaryNav from "@/components/Ui/Stocks/RatioNav";
import RatiosSubNav from "@/components/Ui/Stocks/RatiosSubNav";
import FinancialPosition from "@/components/Pages/Ratios/financial_position";
import Particles from '@/components/Ui/Particles';


export default function IncomeStatementPage() {
  return (
    <main className="min-h-screen text-white">

      <div className="container mx-auto px-6 py-8 space-y-8">

        {/* TOP NAV */}
        <MainNav />

        {/* SECONDARY NAV */}
        <SecondaryNav />

        {/* SUB NAV: Financials / Graphs */}
        <RatiosSubNav />

        {/* CONTENT */}
        <FinancialPosition />

      </div>
    </main>
  );
}
