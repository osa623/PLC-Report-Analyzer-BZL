import React, { useMemo, useState } from 'react';

const ITEMS = [
  { key: 'financial_statements', label: 'Financial Statements' },
  { key: 'shareholding_structure', label: 'Shareholding' },
  { key: 'corporate_governance_summary', label: 'Corporate Governance' },
  { key: 'esg_summary', label: 'ESG' },
  { key: 'risk_analysis', label: 'Risk Analysis' },
  { key: 'strategic_insights', label: 'Strategy Insights' },
  { key: 'subsidiaries', label: 'Subsidiaries' },
  { key: 'future_outlook', label: 'Future Outlook' },
  { key: 'notes_to_financial_statements', label: 'Notes to Financial Statements' },
];

const FORMATS = ['pdf', 'docx', 'xlsx', 'json'];

const ReportBuilderPanel = ({ extractionData, analysisData, onGenerate, loading = false }) => {
  const [selected, setSelected] = useState(() => new Set(ITEMS.map((i) => i.key)));
  const [format, setFormat] = useState('pdf');

  const selectedList = useMemo(() => [...selected], [selected]);

  const toggle = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const generate = () => {
    if (!onGenerate) return;
    onGenerate({
      extraction_data: extractionData || {},
      analysis_data: analysisData || {},
      include_sections: selectedList,
      format,
      report_title: 'Financial Intelligence Report',
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-4 shadow-apple-sm">
      <div>
        <h3 className="text-[14px] font-semibold text-slate-800 tracking-refined">Report Builder</h3>
        <p className="text-[12px] text-slate-500 mt-0.5 tracking-refined">Select sections and generate downloadable report output.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {ITEMS.map((item) => (
          <label key={item.key} className="text-[12px] text-slate-700 flex items-center gap-2.5 border border-slate-200/80 rounded-xl px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors duration-150 tracking-refined">
            <input
              type="checkbox"
              checked={selected.has(item.key)}
              onChange={() => toggle(item.key)}
              className="accent-slate-900 w-3.5 h-3.5"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-2.5">
        <span className="text-[12px] text-slate-500 tracking-refined">Format</span>
        <select value={format} onChange={(e) => setFormat(e.target.value)} className="text-[12px] border border-slate-200/80 rounded-xl px-3 py-1.5 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all duration-200 ease-apple tracking-refined">
          {FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
        </select>
      </div>

      <button
        onClick={generate}
        disabled={loading}
        className="inline-flex items-center rounded-xl bg-slate-900 text-white text-[13px] font-medium px-4 py-2.5 hover:bg-slate-800 disabled:opacity-50 transition-all duration-200 ease-apple shadow-apple-sm hover:shadow-apple tracking-refined"
      >
        {loading ? 'Generating...' : 'Generate Full Report'}
      </button>
    </div>
  );
};

export default ReportBuilderPanel;
