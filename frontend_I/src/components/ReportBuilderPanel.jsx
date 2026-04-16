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
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Report Builder</h3>
        <p className="text-xs text-slate-500">Select sections and generate downloadable report output.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {ITEMS.map((item) => (
          <label key={item.key} className="text-xs text-slate-700 flex items-center gap-2 border border-slate-200 rounded px-2 py-1.5">
            <input
              type="checkbox"
              checked={selected.has(item.key)}
              onChange={() => toggle(item.key)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Format</span>
        <select value={format} onChange={(e) => setFormat(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1">
          {FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
        </select>
      </div>

      <button
        onClick={generate}
        disabled={loading}
        className="inline-flex items-center rounded-lg bg-slate-900 text-white text-xs font-medium px-3 py-2 hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate Full Report'}
      </button>
    </div>
  );
};

export default ReportBuilderPanel;
