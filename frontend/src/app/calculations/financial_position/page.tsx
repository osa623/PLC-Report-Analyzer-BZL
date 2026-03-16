"use client";

import MainNav from "@/components/Ui/Stocks/MainNav";
import SecondaryNav from "@/components/Ui/Stocks/CalculationsNav";
import CalculationsSubNav from "@/components/Ui/Stocks/CalculationsSubNav";
import FinancialPosition from "@/components/Pages/Calculations/financial_position";
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
        <CalculationsSubNav />

        {/* CONTENT */}
        <FinancialPosition />

      </div>
    </main>
  );
}
