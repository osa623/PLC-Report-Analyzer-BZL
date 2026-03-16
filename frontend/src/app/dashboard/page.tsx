import React from "react";
import AllStocksSection from "@/components/Pages/Dashboard/AllStocksSection";
import SectorSection from "@/components/Pages/Dashboard/SectorSection";
import PortfolioSection from "@/components/Pages/Dashboard/PortfolioSection"; 
import Particles from '@/components/Ui/Particles';
import ProtectedRoute from "@/components/ProtectedRoute";


export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <main className="relative min-h-screen text-white w-full">
        {/* BACKGROUND PARTICLES */}
        <div className="absolute inset-0 -z-10">

        </div>

        {/* DASHBOARD CONTENT */}
        <div className=" relative z-10">
          <AllStocksSection />
          <SectorSection />
          <PortfolioSection />
        </div>
      </main>
    </ProtectedRoute>
  );
}

