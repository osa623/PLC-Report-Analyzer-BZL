"use client";

import React from "react";
import SectorSection from "@/components/Pages/Sector/sector_section";


export default function SectorPage() {
    return (
        <main className="relative min-h-screen text-white w-full">
            {/* DASHBOARD CONTENT */}
            <div className="relative z-10">
                <SectorSection />
            </div>
        </main>
    );
}
