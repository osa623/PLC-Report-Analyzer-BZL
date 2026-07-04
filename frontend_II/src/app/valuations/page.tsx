"use client";

import MainNav from "@/components/Ui/Stocks/MainNav";
import Value from "@/components/Pages/Valuations/page";


export default function IncomeStatementPage() {
  return (
    <main className="min-h-screen text-white">

      <div className="container mx-auto px-6 py-8 space-y-8">

        {/* TOP NAV */}
        <MainNav />

        {/* CONTENT */}
        <Value />

      </div>
    </main>
  );
}
