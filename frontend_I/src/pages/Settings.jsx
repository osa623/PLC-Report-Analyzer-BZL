import React from 'react';
import SectionLayout from '../components/ui/SectionLayout';

const Settings = () => {
  return (
    <SectionLayout
      title="Settings"
      description="Configure application preferences, API connections, and extraction defaults."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* General Settings */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-apple-sm">
          <h3 className="text-[14px] font-semibold text-slate-900 mb-5 tracking-refined">General</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-1.5 tracking-refined">Default Report Year</label>
              <select className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all duration-200 ease-apple tracking-refined">
                <option>2024</option>
                <option>2023</option>
                <option>2022</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-1.5 tracking-refined">Date Format</label>
              <select className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all duration-200 ease-apple tracking-refined">
                <option>YYYY-MM-DD</option>
                <option>DD/MM/YYYY</option>
                <option>MM/DD/YYYY</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-1.5 tracking-refined">Currency Display</label>
              <select className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all duration-200 ease-apple tracking-refined">
                <option>LKR (Sri Lankan Rupee)</option>
                <option>USD (US Dollar)</option>
                <option>EUR (Euro)</option>
              </select>
            </div>
          </div>
        </div>

        {/* API Configuration */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-apple-sm">
          <h3 className="text-[14px] font-semibold text-slate-900 mb-5 tracking-refined">API Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-1.5 tracking-refined">Backend API URL</label>
              <input
                type="text"
                readOnly
                value="http://localhost:5000/api"
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-600 tracking-refined"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-1.5 tracking-refined">ML Service URL</label>
              <input
                type="text"
                readOnly
                value="http://localhost:5050"
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-600 tracking-refined"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-[12px] font-medium text-slate-500 tracking-refined">Services status: <span className="text-slate-900">OK</span> (UI placeholder)</span>
            </div>
          </div>
        </div>

        {/* Extraction Defaults */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-apple-sm">
          <h3 className="text-[14px] font-semibold text-slate-900 mb-5 tracking-refined">Extraction Defaults</h3>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-slate-700 tracking-refined">Auto-save results</p>
                <p className="text-[12px] text-slate-400 tracking-refined mt-0.5">Save extracted data automatically after processing</p>
              </div>
              <button className="w-10 h-6 bg-slate-900 rounded-full relative transition-colors duration-200 ease-apple">
                <span className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-apple-sm transition-transform duration-200 ease-apple" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-slate-700 tracking-refined">OCR Enhancement</p>
                <p className="text-[12px] text-slate-400 tracking-refined mt-0.5">Apply image enhancement before OCR processing</p>
              </div>
              <button className="w-10 h-6 bg-slate-300 rounded-full relative transition-colors duration-200 ease-apple">
                <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-apple-sm transition-transform duration-200 ease-apple" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-slate-700 tracking-refined">Confidence Threshold</p>
                <p className="text-[12px] text-slate-400 tracking-refined mt-0.5">Minimum confidence for accepting extracted values</p>
              </div>
              <span className="text-[13px] font-semibold text-slate-700 tracking-refined">80%</span>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-apple-sm">
          <h3 className="text-[14px] font-semibold text-slate-900 mb-5 tracking-refined">About</h3>
          <div className="space-y-3.5 text-sm text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400 tracking-refined">Version</span>
              <span className="font-medium tracking-refined">2.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 tracking-refined">Build</span>
              <span className="font-medium tracking-refined">2026.02.10</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 tracking-refined">Framework</span>
              <span className="font-medium tracking-refined">React 18 + Vite</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 tracking-refined">License</span>
              <span className="font-medium tracking-refined">MIT</span>
            </div>
          </div>
        </div>
      </div>
    </SectionLayout>
  );
};

export default Settings;
