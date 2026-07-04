"use client";

import { ArrowLeftIcon } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { setPin, updateOnboarding, updateProfile } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
    RegistrationFormData,
    OnboardingFormData,
    OnboardingRequest
} from '@/lib/types';

interface Props {
    registrationData: RegistrationFormData;
    onboardingData: OnboardingFormData;
    onBack: () => void;
}

// Using DiceBear API for the animal avatars
const AVATAR_OPTIONS = [
    { id: 'lion', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Lion' },
    { id: 'fox', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Fox' },
    { id: 'bear', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Bear' },
    { id: 'owl', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Owl' },
    { id: 'cat', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix' },
    { id: 'dog', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Scooby' },
];

// Map display labels to backend enum values
const experienceMap: Record<string, OnboardingRequest['experience_level']> = {
    'Beginner': 'beginner',
    'Intermediate': 'intermediate',
    'Advanced': 'advanced',
};

const goalMap: Record<string, OnboardingRequest['primary_goal']> = {
    'Trading': 'trading',
    'Long-Term Investing': 'long_term_investing',
    'Research & Analysis': 'research_analysis',
};

const investorTypeMap: Record<string, NonNullable<OnboardingRequest['investor_type']>> = {
    'Retail': 'retail',
    'Student': 'student',
    'Professional': 'professional',
};

const portfolioSizeMap: Record<string, NonNullable<OnboardingRequest['portfolio_size']>> = {
    'low': '0_500k',
    'mid': '500k_10m',
    'high': '10m_plus',
};

export default function IdentitySection({ registrationData, onboardingData, onBack }: Props) {
    const [formData, setFormData] = useState({
        username: registrationData.username, // Pre-fill from step 1
        avatar: AVATAR_OPTIONS[0].url
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingStep, setLoadingStep] = useState('');

    const { registerBackendUser, refreshProfile, setRegistrationComplete } = useAuth();
    const router = useRouter();

    const handleUpdate = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
    };

    const isComplete = formData.username.trim().length >= 3;

    /**
     * Final step — execute ALL backend calls in sequence.
     * This is the ONLY place where data is persisted to the backend.
     * All previous steps only collected data in client-side state.
     */
    const handleComplete = async () => {
        if (!isComplete) return;
        setIsLoading(true);
        setError(null);

        try {
            // ---- 1. Register user in backend database ----
            setLoadingStep('Creating your account...');
            try {
                await registerBackendUser({
                    first_name: registrationData.firstName,
                    last_name: registrationData.lastName,
                    username: formData.username.trim(), // Use final username from this step
                    email: registrationData.email,
                    phone_number: registrationData.phone || undefined,
                });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                // 409 = user already registered from a previous attempt — safe to continue
                if (!err.message?.includes('409') && !err.message?.includes('already exists')) {
                    throw err;
                }
            }

            // ---- 2. Set security PIN ----
            setLoadingStep('Securing your account...');
            await setPin(registrationData.pin);

            // ---- 3. Save onboarding preferences ----
            setLoadingStep('Saving your preferences...');
            const onboardingPayload: OnboardingRequest = {
                experience_level: experienceMap[onboardingData.experience],
                primary_goal: goalMap[onboardingData.goal],
                investor_type: onboardingData.investorType
                    ? investorTypeMap[onboardingData.investorType]
                    : undefined,
                portfolio_size: onboardingData.portfolioSize
                    ? portfolioSizeMap[onboardingData.portfolioSize]
                    : undefined,
            };
            await updateOnboarding(onboardingPayload);

            // ---- 4. Update profile with avatar ----
            setLoadingStep('Setting up your identity...');
            await updateProfile({
                avatar_url: formData.avatar,
            });

            // ---- 5. Finalize registration ----
            setLoadingStep('Finalizing...');
            await refreshProfile();
            setRegistrationComplete();

            // Done — redirect to dashboard
            router.push('/dashboard');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error('Registration finalization error:', err);
            let errorMessage = err.message || 'Failed to complete registration. Please try again.';
            if (err.message?.includes('409') || err.message?.includes('already exists')) {
                errorMessage = 'This username or account already exists. Please try a different username.';
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
            setLoadingStep('');
        }
    };

    return (
        <section className="flex flex-col items-center w-full justify-center p-6 text-white font-sans">
            <div className="w-full max-w-xl">
                <div className="bg-[#121C33] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between w-full items-center mb-2">
                        <h2 className="text-sm font-bold text-[#B28D41] uppercase tracking-widest">Final Step</h2>
                        <button
                            onClick={onBack}
                            disabled={isLoading}
                            className="text-[#B28D41] flex items-center gap-2 cursor-pointer hover:text-[#9a7835] text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ArrowLeftIcon className="w-4 h-4" /> Previous Step
                        </button>
                    </div>
                    <h1 className="text-3xl font-extrabold mb-4 tracking-tight">Set your identity</h1>

                    {/* ERROR MESSAGE */}
                    {error && (
                        <div className="p-3 mb-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* AVATAR PREVIEW */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative group">
                            <div className="w-24 h-24 rounded-full border-2 border-[#B28D41] p-1 mb-2 bg-[#090C1A] shadow-[0_0_15px_rgba(178,141,65,0.3)] transition-transform group-hover:scale-105">
                                <img
                                    src={formData.avatar}
                                    alt="Selected Avatar"
                                    className="w-full h-full rounded-full object-cover"
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Choose your animal spirit</p>
                    </div>

                    <div className="space-y-6">
                        {/* USERNAME INPUT */}
                        <div>
                            <label className="text-gray-400 text-xs font-bold uppercase mb-2 block">Username</label>
                            <input
                                type="text"
                                placeholder="e.g. BullishTrader"
                                value={formData.username}
                                onChange={(e) => handleUpdate('username', e.target.value)}
                                disabled={isLoading}
                                className="w-full bg-[#090C1A] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#B28D41] transition-all text-white placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            {formData.username && formData.username.length < 3 && (
                                <p className="text-[10px] text-red-400 mt-1 ml-1">Minimum 3 characters required</p>
                            )}
                        </div>

                        {/* AVATAR GRID */}
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase mb-4">Select an Avatar</p>
                            <div className="grid grid-cols-6 gap-3">
                                {AVATAR_OPTIONS.map((avatar) => (
                                    <button
                                        key={avatar.id}
                                        type="button"
                                        onClick={() => handleUpdate('avatar', avatar.url)}
                                        disabled={isLoading}
                                        className={`rounded-xl p-1 border-2 transition-all duration-200 disabled:opacity-50 ${formData.avatar === avatar.url
                                            ? 'border-[#B28D41] bg-[#B28D41]/20 scale-110 shadow-[0_0_10px_rgba(178,141,65,0.2)]'
                                            : 'border-transparent bg-white/5 hover:bg-white/10 hover:scale-105'
                                            }`}
                                    >
                                        <img src={avatar.url} alt={avatar.id} className="w-full h-full" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* SUBMIT BUTTON */}
                        <button
                            disabled={!isComplete || isLoading}
                            onClick={handleComplete}
                            className={`w-full py-4 rounded-xl font-bold transition-all duration-300 mt-4 ${isComplete && !isLoading
                                ? 'bg-[#B28D41] hover:bg-[#9a7835] text-white shadow-[0_0_20px_rgba(178,141,65,0.4)]'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    {loadingStep || 'Saving...'}
                                </span>
                            ) : (
                                'Complete Setup'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
