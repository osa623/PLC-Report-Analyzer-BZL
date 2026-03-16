"use client";

import React from "react";
import LoginForm from "@/components/Pages/LoginPage/LoginFrom";

export default function LoginPage() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-black">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0A0E1A] via-[#0D1425] to-[#182039]" />

            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />

            {/* Content */}
            <div className="relative z-10 w-full flex justify-center">
                <LoginForm />
            </div>
        </div>
    );
}
