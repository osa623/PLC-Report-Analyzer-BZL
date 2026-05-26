import React from 'react';
import { FileText } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV_TABS = ['Dashboard', 'Reports', 'Comparisons', 'Settings'];

export default function Navbar({ activeTab, onTabChange, connected }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isEngineering = location.pathname === '/engineering';

  return (
    <nav
      id="global-navbar"
      className="sticky top-0 z-50 h-14 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-6 lg:px-8 transition-all duration-300"
    >
      {/* Left: Logo + Title + Tabs */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
            <FileText size={14} color="#fff" />
          </div>
          <span className="text-[14px] font-semibold text-slate-900 tracking-[-0.01em]">
            {isEngineering ? 'Engineering Dashboard' : 'Report Analysis'}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-0.5">
          {NAV_TABS.map((tab) => (
            <button
              key={tab}
              id={`nav-tab-${tab.toLowerCase()}`}
              onClick={() => onTabChange(tab)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]
                ${activeTab === tab
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Nav links + status */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/home')}
          className="text-[12px] font-medium text-slate-400 hover:text-slate-700 transition-colors duration-200 tracking-[-0.01em]"
        >
          Extraction Hub
        </button>
        <button
          onClick={() => navigate(isEngineering ? '/pipeline' : '/engineering')}
          className="text-[12px] font-medium text-slate-400 hover:text-slate-700 transition-colors duration-200 tracking-[-0.01em]"
        >
          {isEngineering ? 'Pipeline' : 'Engineering'}
        </button>
        <div className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors duration-200
          ${connected
            ? 'bg-green-50/80 text-green-700 border-green-200/60'
            : 'bg-red-50/80 text-red-700 border-red-200/60'}`}
        >
          {connected ? '● Connected' : '● Disconnected'}
        </div>
      </div>
    </nav>
  );
}
