"use client";

import { ArrowLeft } from 'lucide-react';
import React, { useState } from 'react';
import { OnboardingFormData } from '@/lib/types';

//interface
interface onboardingSectionProp {
  onComplete: (data: OnboardingFormData) => void;
  onBack: () => void;
}

// Reusing your Icons or similar ones
const ChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
);

export default function OnboardingSection({ onComplete, onBack }: onboardingSectionProp) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    experience: '',
    goal: '',
    investorType: '',
    portfolioSize: ''
  });

  // Handle selection for custom radio-style buttons
  const handleSelect = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Logic to move to step 2
  const goToNextStep = () => {
    if (formData.experience && formData.goal) {
      setStep(2);
    }
  };

  // Pass collected data to parent — NO API calls here
  const handleComplete = () => {
    onComplete({
      experience: formData.experience,
      goal: formData.goal,
      investorType: formData.investorType,
      portfolioSize: formData.portfolioSize,
    });
  };

  const isStep1Complete = formData.experience && formData.goal;
  const isStep2Complete = formData.investorType && formData.portfolioSize;

  return (
    <section className="flex flex-col items-center w-full justify-center min-h-screen p-6  text-white font-sans">

      <div className="w-full max-w-xl space-y-8">

        {/* PROGRESS INDICATOR */}
        <div className="flex justify-center gap-2 mb-8">
          <div className={`h-1.5 w-12 rounded-full transition-all ${step >= 1 ? 'bg-[#B28D41]' : 'bg-gray-700'}`} />
          <div className={`h-1.5 w-12 rounded-full transition-all ${step >= 2 ? 'bg-[#B28D41]' : 'bg-gray-700'}`} />
        </div>

        {/* STEP 1: Tell us about you */}
        {step === 1 && (
          <div className="bg-[#121C33] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className='flex w-full items-center justify-between mb-2'>
              <h2 className="text-sm font-bold text-[#B28D41] uppercase tracking-widest">Step 01</h2>
              <button onClick={onBack} className="text-sm cursor-pointer flex items-center gap-1 font-light text-[#B28D41]/60 hover:text-[#B28D41] transition-all duration-300 uppercase tracking-widest">
                <ArrowLeft size={16} /> Back</button>
            </div>
            <h1 className="text-3xl font-extrabold mb-8 tracking-tight">Tell us about you</h1>

            <div className="space-y-6">
              {/* Experience Question */}
              <div>
                <p className="text-gray-400 text-sm mb-4">What is your experience with stock investing?</p>
                <div className="grid grid-cols-1 gap-3">
                  {['Beginner', 'Intermediate', 'Advanced'].map((lvl) => (
                    <OptionButton
                      key={lvl}
                      label={lvl}
                      selected={formData.experience === lvl}
                      onClick={() => handleSelect('experience', lvl)}
                    />
                  ))}
                </div>
              </div>

              {/* Goal Question */}
              <div>
                <p className="text-gray-400 text-sm mb-4">What is your primary goal on this platform?</p>
                <div className="grid grid-cols-1 gap-3">
                  {['Trading', 'Long-Term Investing', 'Research & Analysis'].map((goal) => (
                    <OptionButton
                      key={goal}
                      label={goal}
                      selected={formData.goal === goal}
                      onClick={() => handleSelect('goal', goal)}
                    />
                  ))}
                </div>
              </div>

              <button
                disabled={!isStep1Complete}
                onClick={goToNextStep}
                className={`w-full py-4 mt-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 ${isStep1Complete
                  ? 'bg-[#B28D41] hover:bg-[#9a7835] text-white'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
              >
                Continue to Personalization <ChevronRight />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Help us personalize */}
        {step === 2 && (
          <div className="bg-[#121C33] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-500">
            <div className='flex w-full items-center justify-between mb-2'>
              <h2 className="text-sm font-bold text-[#B28D41] uppercase tracking-widest">Step 02</h2>
              <h2 onClick={() => setStep(1)} className="text-sm cursor-pointer flex items-center gap-1 font-light text-[#B28D41]/60 hover:text-[#B28D41] transition-all duration-300 uppercase  tracking-widest">
                <ArrowLeft size={16} /> Step 01</h2>
            </div>
            <h1 className="text-3xl font-extrabold mb-8 tracking-tight">Help us personalize</h1>

            <div className="space-y-6">
              {/* Investor Type */}
              <div>
                <p className="text-gray-400 text-sm mb-4">Which best describes you as an investor?</p>
                <div className="grid grid-cols-3 gap-3">
                  {['Retail', 'Student', 'Professional'].map((type) => (
                    <OptionButton
                      key={type}
                      label={type}
                      selected={formData.investorType === type}
                      onClick={() => handleSelect('investorType', type)}
                    />
                  ))}
                </div>
              </div>

              {/* Portfolio Size */}
              <div>
                <p className="text-gray-400 text-sm mb-4">Your Approximate portfolio size (LKR)</p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { label: '0 - 500k', val: 'low' },
                    { label: '500k - 10M', val: 'mid' },
                    { label: '10M+', val: 'high' }
                  ].map((size) => (
                    <OptionButton
                      key={size.val}
                      label={size.label}
                      selected={formData.portfolioSize === size.val}
                      onClick={() => handleSelect('portfolioSize', size.val)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  disabled={!isStep2Complete}
                  onClick={handleComplete}
                  className={`flex-[2] py-4 rounded-xl font-bold transition-all duration-300 ${isStep2Complete
                    ? 'bg-[#B28D41] hover:bg-[#9a7835] text-white shadow-[0_0_20px_rgba(178,141,65,0.3)]'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  Continue to Final Step
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// Sub-component for the selection buttons to keep code clean
function OptionButton({ label, selected, onClick }: { label: string, selected: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200 text-left ${selected
        ? 'bg-[#B28D41]/10 border-[#B28D41] text-[#B28D41]'
        : 'bg-[#090C1A] border-white/5 text-gray-400 hover:border-white/20 hover:bg-white/5'
        }`}
    >
      <div className="flex items-center justify-between">
        {label}
        {selected && (
          <div className="w-2 h-2 rounded-full bg-[#B28D41] shadow-[0_0_8px_#B28D41]" />
        )}
      </div>
    </button>
  );
}
