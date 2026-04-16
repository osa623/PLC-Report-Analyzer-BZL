import React from 'react';
import SectionLayout from '../components/ui/SectionLayout';

const Settings = () => {
  return (
    <SectionLayout
      title="Settings"
      description="Configure application preferences, API connections, and extraction defaults."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">General</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Default Report Year</label>
              <select className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400">
                <option>2024</option>
                <option>2023</option>
                <option>2022</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Date Format</label>
              <select className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400">
                <option>YYYY-MM-DD</option>
                <option>DD/MM/YYYY</option>
                <option>MM/DD/YYYY</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Currency Display</label>
              <select className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400">
                <option>LKR (Sri Lankan Rupee)</option>
                <option>USD (US Dollar)</option>
                <option>EUR (Euro)</option>
              </select>
            </div>
          </div>
        </div>

        {/* API Configuration */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">API Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Backend API URL</label>
              <input
                type="text"
                readOnly
                value="http://localhost:5000/api"
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">ML Service URL</label>
              <input
                type="text"
                readOnly
                value="http://localhost:5050"
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-600"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <div className="w-2 h-2 bg-slate-900 rounded-full" />
              <span className="text-xs font-medium text-slate-500">Services status: <span className="text-slate-900">OK</span> (UI placeholder)</span>
            </div>
          </div>
        </div>

        {/* Extraction Defaults */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Extraction Defaults</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Auto-save results</p>
                <p className="text-xs text-slate-400">Save extracted data automatically after processing</p>
              </div>
              <button className="w-10 h-6 bg-slate-900 rounded-full relative transition-colors">
                <span className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">OCR Enhancement</p>
                <p className="text-xs text-slate-400">Apply image enhancement before OCR processing</p>
              </div>
              <button className="w-10 h-6 bg-slate-300 rounded-full relative transition-colors">
                <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Confidence Threshold</p>
                <p className="text-xs text-slate-400">Minimum confidence for accepting extracted values</p>
              </div>
              <span className="text-sm font-medium text-slate-700">80%</span>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">About</h3>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Version</span>
              <span className="font-medium">2.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Build</span>
              <span className="font-medium">2026.02.10</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Framework</span>
              <span className="font-medium">React 18 + Vite</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">License</span>
              <span className="font-medium">MIT</span>
            </div>
          </div>
        </div>
      </div>
    </SectionLayout>
  );
};

export default Settings;
