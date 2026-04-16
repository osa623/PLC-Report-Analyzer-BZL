import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DocumentTextIcon,
  BoltIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  TableCellsIcon,
  CurrencyDollarIcon,
  CloudArrowDownIcon,
} from '@heroicons/react/24/outline';

const features = [
  {
    icon: DocumentTextIcon,
    title: 'Smart PDF Parsing',
    desc: 'Upload any annual report PDF and let our AI extract structured financial data automatically.',
  },
  {
    icon: TableCellsIcon,
    title: '8 Statement Types',
    desc: 'Income statement, balance sheet, cash flow, OCI, changes in equity, auditor\'s report and more.',
  },
  {
    icon: BoltIcon,
    title: 'Per-Statement Extraction',
    desc: 'Extract each financial statement independently — no need to wait for everything at once.',
  },
  {
    icon: CloudArrowDownIcon,
    title: 'Multi-Format Export',
    desc: 'Download results in JSON, Excel, CSV, PDF, or Word with a single click.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Accurate & Reliable',
    desc: 'Powered by Gemini 2.0 with built-in repair logic for truncated or malformed responses.',
  },
  {
    icon: CurrencyDollarIcon,
    title: 'Pay As You Go',
    desc: 'Start with 2 free credits. Purchase more when you need them — no subscriptions required.',
  },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">

      {/* ── Navbar ──────────────────────────────────────────────── */}
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">BL</span>
          </div>
          <span className="text-sm font-bold text-slate-900">PDF Extractor</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
          >
            Sign in
          </button>
          <button
            onClick={() => navigate('/register')}
            className="text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1 mb-6">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
          <span className="text-xs font-medium text-slate-600">2 free credits — no card required</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight tracking-tight">
          Extract financial data<br />from annual reports
        </h1>
        <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          Upload a PDF, select the statements you need, and get structured data in seconds.
          Income statements, balance sheets, cash flows, and more — all powered by AI.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/home')}
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Start extracting
            <ArrowRightIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/pricing')}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            View pricing
          </button>
        </div>
      </section>

      {/* ── Features Grid ───────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-sm transition-all">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center mb-3">
                  <Icon className="w-4.5 h-4.5 text-slate-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 mb-1">{f.title}</h3>
                <p className="text-[13px] text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-xs text-slate-400">PDF Extractor v2.0</span>
          <span className="text-xs text-slate-400">&copy; {new Date().getFullYear()} All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
