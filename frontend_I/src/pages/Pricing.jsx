import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCredits } from '../utils/CreditContext';
import { CheckIcon } from '@heroicons/react/24/outline';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 4.99,
    credits: 5,
    perCredit: '1.00',
    description: 'Try it out with a small pack.',
    features: ['5 PDF uploads', 'All 8 statement types', 'Multi-format export', 'Email support'],
    popular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 14.99,
    credits: 20,
    perCredit: '0.75',
    description: 'Best value for regular users.',
    features: ['20 PDF uploads', 'All 8 statement types', 'Multi-format export', 'Priority support', 'Bulk extraction'],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 39.99,
    credits: 75,
    perCredit: '0.53',
    description: 'For teams and heavy workloads.',
    features: ['75 PDF uploads', 'All 8 statement types', 'Multi-format export', 'Dedicated support', 'Bulk extraction', 'API access'],
    popular: false,
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { credits, addCredits } = useCredits();
  const [purchasing, setPurchasing] = useState(null);
  const [successPlan, setSuccessPlan] = useState(null);

  const handlePurchase = (plan) => {
    setPurchasing(plan.id);
    // Simulate purchase (frontend only — backend would handle real payment)
    setTimeout(() => {
      addCredits(plan.credits);
      setPurchasing(null);
      setSuccessPlan(plan);
    }, 1500);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-[26px] font-bold text-slate-900 tracking-heading leading-heading">Purchase Credits</h1>
        <p className="text-[14px] text-slate-500 mt-2 tracking-refined leading-rhythm">
          You have <span className="font-semibold text-slate-800">{credits}</span> credit{credits !== 1 ? 's' : ''} remaining.
          Each credit allows one PDF upload and extraction.
        </p>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl border p-6 flex flex-col transition-all duration-300 ease-apple
              ${plan.popular ? 'border-slate-900 ring-1 ring-slate-900 bg-white shadow-apple-md' : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-apple shadow-apple-sm'}`}
          >
            {plan.popular && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-semibold uppercase tracking-widest px-3 py-0.5 rounded-full">
                Most Popular
              </span>
            )}

            <div className="mb-5">
              <h3 className="text-[14px] font-semibold text-slate-900 tracking-refined">{plan.name}</h3>
              <p className="text-[12px] text-slate-500 mt-0.5 tracking-refined">{plan.description}</p>
            </div>

            <div className="mb-5">
              <span className="text-3xl font-bold text-slate-900 tracking-heading">${plan.price}</span>
              <span className="text-[13px] text-slate-400 ml-1 tracking-refined">/ {plan.credits} credits</span>
              <p className="text-[11px] text-slate-400 mt-0.5 tracking-refined">${plan.perCredit} per extraction</p>
            </div>

            <ul className="space-y-2.5 mb-6 flex-1">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-[13px] text-slate-600 tracking-refined">
                  <CheckIcon className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handlePurchase(plan)}
              disabled={!!purchasing}
              className={`w-full py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ease-apple disabled:opacity-50 tracking-refined
                ${plan.popular
                  ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-apple-sm hover:shadow-apple'
                  : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-apple-sm'}`}
            >
              {purchasing === plan.id ? 'Processing...' : `Buy ${plan.credits} credits`}
            </button>
          </div>
        ))}
      </div>

      {/* Back link */}
      <div className="text-center mt-10">
        <button
          onClick={() => navigate('/home')}
          className="text-[13px] text-slate-400 hover:text-slate-600 transition-colors duration-200 tracking-refined"
        >
          Back to extraction
        </button>
      </div>

      {/* Success modal */}
      {successPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-apple-xl p-8 max-w-sm w-full mx-4 text-center animate-scale-in">
            <div className="w-12 h-12 bg-green-50 border border-green-200/60 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1 tracking-heading">Purchase Successful</h3>
            <p className="text-[13px] text-slate-500 mb-1 tracking-refined">
              {successPlan.credits} credits have been added to your account.
            </p>
            <p className="text-[13px] text-slate-400 mb-6 tracking-refined">
              You now have <span className="font-semibold text-slate-700">{credits}</span> total credits.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setSuccessPlan(null); navigate('/home'); }}
                className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl text-[13px] font-medium hover:bg-slate-800 transition-all duration-200 shadow-apple-sm tracking-refined"
              >
                Start Extracting
              </button>
              <button
                onClick={() => setSuccessPlan(null)}
                className="flex-1 bg-white border border-slate-200/80 text-slate-600 py-2.5 rounded-xl text-[13px] font-medium hover:bg-slate-50 transition-all duration-200 shadow-apple-sm tracking-refined"
              >
                Stay Here
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pricing;
