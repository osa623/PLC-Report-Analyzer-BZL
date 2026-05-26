import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DocumentTextIcon,
  BoltIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  TableCellsIcon,
  CurrencyDollarIcon,
  CloudArrowDownIcon,
  ChartBarSquareIcon,
  ArrowUpTrayIcon,
  DocumentArrowDownIcon,
  CheckCircleIcon,
  StarIcon,
} from '@heroicons/react/24/outline';

/* ─── Feature data ────────────────────────────────────────────────────── */
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

/* ─── Showcase data ───────────────────────────────────────────────────── */
const showcases = [
  {
    title: 'Intelligent Document Understanding',
    description: 'Our AI engine reads complex annual reports the way a financial analyst would — parsing multi-column layouts, footnotes, and comparative tables with contextual awareness.',
    highlights: ['Multi-column layout parsing', 'Footnote recognition', 'Comparative table detection'],
  },
  {
    title: 'Structured Data, Ready to Use',
    description: 'Get clean, structured output in your preferred format. Every extracted value is mapped to standardized financial taxonomy with automatic unit normalization.',
    highlights: ['Standardized taxonomy mapping', 'Automatic unit normalization', 'Cross-reference validation'],
  },
];

/* ─── Workflow steps ──────────────────────────────────────────────────── */
const steps = [
  { icon: ArrowUpTrayIcon, title: 'Upload', description: 'Drop your annual report PDF into the extraction interface.' },
  { icon: ChartBarSquareIcon, title: 'Extract', description: 'Select specific statements or extract all at once with AI.' },
  { icon: DocumentArrowDownIcon, title: 'Export', description: 'Download structured data in JSON, Excel, CSV, PDF, or Word.' },
];

/* ─── Testimonials ────────────────────────────────────────────────────── */
const testimonials = [
  { quote: 'Cut our annual report processing time by 80%. The accuracy is remarkable.', name: 'S. Fernando', role: 'Financial Analyst' },
  { quote: 'Finally, a tool that handles Sri Lankan annual report formats properly.', name: 'R. Perera', role: 'Audit Manager' },
  { quote: 'The multi-format export saves us hours of manual formatting every week.', name: 'K. Silva', role: 'Research Associate' },
];

/* ─── Trust logos placeholder ──────────────────────────────────────────── */
const trustBadges = ['Enterprise Ready', 'SOC 2 Compliant', 'Bank-Grade Security', 'GDPR Ready', '99.9% Uptime'];

/* ─── Intersection Observer hook ──────────────────────────────────────── */
const useInView = (options = {}) => {
  const ref = useRef(null);
  const [isInView, setIsInView] = React.useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsInView(true); observer.unobserve(el); }
    }, { threshold: 0.15, ...options });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, isInView];
};

/* ─── Animated section wrapper ────────────────────────────────────────── */
const AnimatedSection = ({ children, className = '', delay = '' }) => {
  const [ref, isInView] = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-apple ${isInView ? `opacity-100 translate-y-0 ${delay}` : 'opacity-0 translate-y-6'} ${className}`}
    >
      {children}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════ */
/*  COMPONENT                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */
const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">

      {/* ── Primary Navbar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 h-14 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-6 lg:px-12 transition-all duration-300">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-[11px] font-bold tracking-wide">BL</span>
            </div>
            <span className="text-[15px] font-semibold text-slate-900 tracking-refined">PDF Extractor</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors duration-200">Features</a>
            <a href="#how-it-works" className="text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors duration-200">How it Works</a>
            <button onClick={() => navigate('/pricing')} className="text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors duration-200">Pricing</button>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/login')}
            className="text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors duration-200 px-3 py-1.5 rounded-lg hover:bg-slate-50"
          >
            Sign in
          </button>
          <button
            onClick={() => navigate('/register')}
            className="text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-800 px-4 py-1.5 rounded-lg transition-all duration-200 shadow-apple-sm hover:shadow-apple"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* ── Secondary Navbar ───────────────────────────────────────── */}
      <div className="sticky top-14 z-40 h-11 bg-slate-50/90 backdrop-blur-lg border-b border-slate-200/40 flex items-center justify-center gap-6 px-6">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 tracking-wide uppercase">
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          Financial Data
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 tracking-wide uppercase">
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          AI Powered
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 tracking-wide uppercase">
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          8 Statement Types
        </span>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 tracking-wide uppercase">
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          Multi-Format Export
        </span>
      </div>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="animate-slide-up">
          <div className="inline-flex items-center gap-2 bg-slate-100/80 rounded-full px-3.5 py-1 mb-8 border border-slate-200/50">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[11px] font-medium text-slate-500 tracking-wide">2 free credits — no card required</span>
          </div>
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-display tracking-display animate-slide-up-delay-1">
          Extract financial data<br />from annual reports
        </h1>
        <p className="mt-5 text-lg text-slate-500 max-w-2xl mx-auto leading-rhythm tracking-refined animate-slide-up-delay-2">
          Upload a PDF, select the statements you need, and get structured data in seconds.
          Income statements, balance sheets, cash flows, and more — all powered by AI.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3 animate-slide-up-delay-3">
          <button
            onClick={() => navigate('/home')}
            className="group inline-flex items-center gap-2 bg-slate-900 text-white px-7 py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-all duration-200 shadow-apple-sm hover:shadow-apple tracking-refined"
          >
            Start extracting
            <ArrowRightIcon className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
          <button
            onClick={() => navigate('/pricing')}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-7 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-apple-sm tracking-refined"
          >
            View pricing
          </button>
        </div>
      </section>

      {/* ── Trust Strip ────────────────────────────────────────────── */}
      <section className="border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest text-center mb-5">Trusted by financial professionals</p>
          <div className="flex items-center justify-center flex-wrap gap-x-8 gap-y-3">
            {trustBadges.map((badge, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-400">
                <ShieldCheckIcon className="w-3.5 h-3.5 text-slate-300" />
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ──────────────────────────────────────────── */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-24">
        <AnimatedSection>
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 tracking-heading leading-heading">
              Everything you need to extract financial data
            </h2>
            <p className="mt-3 text-[15px] text-slate-500 max-w-2xl mx-auto leading-rhythm tracking-refined">
              Powerful AI-driven extraction with professional-grade accuracy and flexibility.
            </p>
          </div>
        </AnimatedSection>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <AnimatedSection key={i}>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 hover:border-slate-300 hover:shadow-apple transition-all duration-300 ease-apple group">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 group-hover:bg-slate-900 group-hover:border-slate-900 transition-all duration-300">
                    <Icon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-slate-800 mb-1.5 tracking-refined">{f.title}</h3>
                  <p className="text-[13px] text-slate-500 leading-relaxed tracking-refined">{f.desc}</p>
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </section>

      {/* ── Product Showcase ───────────────────────────────────────── */}
      <section className="bg-slate-50/50 border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-24 space-y-24">
          {showcases.map((item, idx) => (
            <AnimatedSection key={idx}>
              <div className={`flex flex-col lg:flex-row items-center gap-12 ${idx % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
                <div className="flex-1 space-y-5">
                  <h3 className="text-2xl font-bold text-slate-900 tracking-heading leading-heading">{item.title}</h3>
                  <p className="text-[15px] text-slate-500 leading-rhythm tracking-refined">{item.description}</p>
                  <ul className="space-y-2.5">
                    {item.highlights.map((h, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-[13px] text-slate-600 tracking-refined">
                        <CheckCircleIcon className="w-4 h-4 text-slate-400 shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex-1 w-full">
                  <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200/60 flex items-center justify-center">
                    <div className="text-center px-8">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-white border border-slate-200 shadow-apple-sm flex items-center justify-center mb-4">
                        {idx === 0 ? <DocumentTextIcon className="w-7 h-7 text-slate-400" /> : <TableCellsIcon className="w-7 h-7 text-slate-400" />}
                      </div>
                      <p className="text-[13px] text-slate-400 font-medium tracking-refined">Dashboard Preview</p>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-4xl mx-auto px-6 py-24">
        <AnimatedSection>
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 tracking-heading leading-heading">
              Three simple steps
            </h2>
            <p className="mt-3 text-[15px] text-slate-500 max-w-xl mx-auto leading-rhythm tracking-refined">
              From PDF upload to structured data export in under a minute.
            </p>
          </div>
        </AnimatedSection>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-px bg-slate-200" />
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <AnimatedSection key={i}>
                <div className="flex flex-col items-center text-center px-6 relative">
                  <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 shadow-apple-sm flex items-center justify-center mb-5 relative z-10">
                    <Icon className="w-8 h-8 text-slate-500" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Step {i + 1}</span>
                  <h3 className="text-[16px] font-semibold text-slate-900 mb-2 tracking-refined">{step.title}</h3>
                  <p className="text-[13px] text-slate-500 leading-relaxed tracking-refined">{step.description}</p>
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────── */}
      <section className="bg-slate-50/50 border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <AnimatedSection>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-slate-900 tracking-heading leading-heading">
                What professionals say
              </h2>
              <p className="mt-3 text-[15px] text-slate-500 max-w-xl mx-auto leading-rhythm tracking-refined">
                Trusted by analysts, auditors, and research teams.
              </p>
            </div>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map((t, i) => (
              <AnimatedSection key={i}>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 hover:shadow-apple transition-all duration-300 ease-apple">
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(5)].map((_, si) => (
                      <StarIcon key={si} className="w-4 h-4 text-slate-300 fill-slate-300" />
                    ))}
                  </div>
                  <p className="text-[14px] text-slate-600 leading-relaxed tracking-refined mb-5">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <span className="text-[11px] font-semibold text-slate-500">{t.name[0]}</span>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-slate-800 tracking-refined">{t.name}</p>
                      <p className="text-[11px] text-slate-400 tracking-refined">{t.role}</p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-28 text-center">
        <AnimatedSection>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-heading leading-heading">
            Ready to extract?
          </h2>
          <p className="mt-4 text-[15px] text-slate-500 max-w-lg mx-auto leading-rhythm tracking-refined">
            Start with 2 free credits. No credit card required. Extract your first annual report in under a minute.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/register')}
              className="group inline-flex items-center gap-2 bg-slate-900 text-white px-8 py-3.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-all duration-200 shadow-apple hover:shadow-apple-md tracking-refined"
            >
              Get Started Free
              <ArrowRightIcon className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => navigate('/pricing')}
              className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-8 py-3.5 rounded-xl text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-apple-sm tracking-refined"
            >
              View Pricing
            </button>
          </div>
        </AnimatedSection>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200/80 bg-slate-50/50">
        <div className="max-w-5xl mx-auto px-6 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">BL</span>
                </div>
                <span className="text-[14px] font-semibold text-slate-900 tracking-refined">PDF Extractor</span>
              </div>
              <p className="text-[12px] text-slate-400 leading-relaxed tracking-refined">
                AI-powered financial data extraction from annual report PDFs.
              </p>
            </div>
            {/* Product */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-4">Product</p>
              <ul className="space-y-2.5">
                <li><a href="#features" className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors tracking-refined">Features</a></li>
                <li><button onClick={() => navigate('/pricing')} className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors tracking-refined">Pricing</button></li>
                <li><a href="#how-it-works" className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors tracking-refined">How it Works</a></li>
              </ul>
            </div>
            {/* Resources */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-4">Resources</p>
              <ul className="space-y-2.5">
                <li><span className="text-[13px] text-slate-500 tracking-refined">Documentation</span></li>
                <li><span className="text-[13px] text-slate-500 tracking-refined">API Reference</span></li>
                <li><span className="text-[13px] text-slate-500 tracking-refined">Changelog</span></li>
              </ul>
            </div>
            {/* Legal */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-4">Legal</p>
              <ul className="space-y-2.5">
                <li><span className="text-[13px] text-slate-500 tracking-refined">Privacy Policy</span></li>
                <li><span className="text-[13px] text-slate-500 tracking-refined">Terms of Service</span></li>
                <li><span className="text-[13px] text-slate-500 tracking-refined">Contact</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-200/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400 tracking-refined">PDF Extractor v2.0</span>
            <span className="text-[11px] text-slate-400 tracking-refined">&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
