import React from "react";
import Watchlist from "@/components/Pages/Watchlist/page";
import ProtectedRoute from "@/components/ProtectedRoute";



export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gradient-to-br from-[#0A0E1A] via-[#0D1425] to-[#182039] text-white">

        <div className="container mx-auto  px-6 py-8 space-y-8">

          <Watchlist />
        </div>
      </main>
    </ProtectedRoute>
  );
}



