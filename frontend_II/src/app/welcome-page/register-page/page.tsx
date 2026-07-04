"use client";

import React from "react";
import RegisterForm from "@/components/Pages/RegisterPage/RegisterForm";
import PreVerification from "@/components/Pages/RegisterPage/PreVerification";
import GoTONextStep from "@/components/Pages/RegisterPage/GoToNextStep";
import OnboardingSection from "@/components/Pages/RegisterPage/onboardingSection";
import { RegistrationFormData, OnboardingFormData } from "@/lib/types";

export default function RegisterPage() {
    // Step navigation: 1 → 2 → 3 → 4
    const [currentStep, setCurrentStep] = React.useState(1);

    // Data accumulated across steps (kept in parent so it survives step transitions)
    // No data is saved to the backend until step 4 is complete.
    const [registrationData, setRegistrationData] = React.useState<RegistrationFormData | null>(null);
    const [onboardingData, setOnboardingData] = React.useState<OnboardingFormData | null>(null);

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-black">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0A0E1A] via-[#0D1425] to-[#182039]" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />

            <div className="relative z-10 w-full flex justify-center">

                {/* Step 1: Registration Form — creates Firebase user + collects profile data */}
                {currentStep === 1 && (
                    <RegisterForm
                        onComplete={(data) => {
                            setRegistrationData(data);
                            setCurrentStep(2);
                        }}
                    />
                )}

                {/* Step 2: Email / Phone Verification */}
                {currentStep === 2 && (
                    <PreVerification
                        phone={registrationData?.phone}
                        onComplete={() => setCurrentStep(3)}
                        onBack={() => setCurrentStep(1)}
                    />
                )}

                {/* Step 3: Onboarding Preferences — only collects data, no API calls */}
                {currentStep === 3 && (
                    <GoTONextStep
                        onComplete={(data) => {
                            setOnboardingData(data);
                            setCurrentStep(4);
                        }}
                        onBack={() => setCurrentStep(2)}
                    />
                )}

                {/* Step 4: Identity + Final Save — ALL backend calls happen here */}
                {currentStep === 4 && registrationData && onboardingData && (
                    <OnboardingSection
                        registrationData={registrationData}
                        onboardingData={onboardingData}
                        onBack={() => setCurrentStep(3)}
                    />
                )}
            </div>
        </div>
    );
}
