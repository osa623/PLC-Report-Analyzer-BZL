import React, { useState, useEffect } from 'react';
import {
  BanknotesIcon,
  BuildingLibraryIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

const FIELD_LABELS = {
  // Income Statement
  "revenue": "Revenue / Turnover",
  "cost_of_sales": "Cost of Sales / Cost of Revenue",
  "gross_profit": "Gross Profit",
  "operating_profit": "Operating Profit / EBIT",
  "profit_before_tax": "Profit Before Tax",
  "net_profit": "Net Profit After Tax",
  "finance_cost": "Finance Costs / Interest Expense",
  "tax_expense": "Income Tax Expense",
  "eps": "Earnings Per Share (EPS)",
  "total_operating_income": "Total Operating Income",
  "total_operating_expenses": "Total Operating Expenses",
  "impairment_charge": "Impairment Charge",
  
  // Balance Sheet
  "total_assets": "Total Assets",
  "current_assets": "Current Assets",
  "inventory": "Inventory / Inventories",
  "receivables": "Trade & Other Receivables",
  "cash": "Cash & Cash Equivalents",
  "equity": "Total Shareholders Equity",
  "total_liabilities": "Total Liabilities",
  "current_liabilities": "Current Liabilities",
  "noncurrent_liabilities": "Non-Current Liabilities",
  "borrowings": "Borrowings / Total Debt",
  "deposits": "Customer Deposits",
  "loans": "Loans & Advances to Customers",
  "shares_outstanding": "Ordinary Shares Outstanding",
  "market_price": "Market Price per Share",
  
  // Cash Flow
  "operating_cash_flow": "Net Cash Flow from Operating Activities",
  "investing_cash_flow": "Net Cash Flow from Investing Activities",
  "financing_cash_flow": "Net Cash Flow from Financing Activities",
  "net_cash_flow": "Net Increase/Decrease in Cash",
  "opening_cash": "Cash at Beginning of Year",
  "closing_cash": "Cash at End of Year",
  "capex": "Capital Expenditure (CapEx)",
  "dividends_paid": "Dividends Paid",
};

const getLabel = (key) => {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const ReviewPanel = ({ companyId, financials, companyName, onSave, onReanalyse }) => {
  const [editedFinancials, setEditedFinancials] = useState({});
  const [activeYear, setActiveYear] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isReanalysing, setIsReanalysing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (financials) {
      setEditedFinancials(JSON.parse(JSON.stringify(financials)));
      const years = Object.keys(financials).sort().reverse();
      if (years.length > 0 && !years.includes(activeYear)) {
        setActiveYear(years[0]);
      }
    }
  }, [financials]);

  const years = Object.keys(editedFinancials).sort().reverse();

  if (years.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-xl border border-slate-100 rounded-2xl p-6 text-center text-slate-500">
        No financial data available for review.
      </div>
    );
  }

  const handleValueChange = (year, statement, key, val) => {
    setEditedFinancials(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (!copy[year]) copy[year] = {};
      if (!copy[year][statement]) copy[year][statement] = {};
      copy[year][statement][key] = val;
      return copy;
    });
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      // Cleanup values to numbers or null
      const clean = JSON.parse(JSON.stringify(editedFinancials));
      Object.keys(clean).forEach(yr => {
        Object.keys(clean[yr]).forEach(stmt => {
          Object.keys(clean[yr][stmt]).forEach(fld => {
            const v = clean[yr][stmt][fld];
            if (v === '' || v === null || v === undefined) {
              clean[yr][stmt][fld] = null;
            } else {
              const num = Number(v);
              clean[yr][stmt][fld] = Number.isFinite(num) ? num : null;
            }
          });
        });
      });
      await onSave(companyId, clean);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save edits:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReanalyseClick = async () => {
    setIsReanalysing(true);
    try {
      // Make sure we save first
      await handleSave();
      await onReanalyse(companyId);
    } catch (err) {
      console.error('Failed to reanalyse:', err);
    } finally {
      setIsReanalysing(false);
    }
  };

  const currentYearData = editedFinancials[activeYear] || {};
  const statements = [
    { key: 'income_statement', title: 'Income Statement', icon: BanknotesIcon },
    { key: 'balance_sheet', title: 'Financial Position', icon: BuildingLibraryIcon },
    { key: 'cash_flow', title: 'Cash Flow Statement', icon: CurrencyDollarIcon },
  ];

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-100 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">Review Extracted Financials</h2>
          <p className="text-[13px] text-slate-500 tracking-refined">
            Verify and edit the statement values for <span className="font-semibold text-slate-700">{companyName}</span>
          </p>
        </div>
        
        {/* Year Selector Tabs */}
        <div className="flex gap-1.5 bg-slate-100/80 p-1 rounded-xl">
          {years.map(yr => (
            <button
              key={yr}
              onClick={() => setActiveYear(yr)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeYear === yr
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* Forms Section */}
      <div className="space-y-6">
        {statements.map(({ key: stmtKey, title, icon: Icon }) => {
          const fields = currentYearData[stmtKey] || {};
          const fieldKeys = Object.keys(fields);
          
          if (fieldKeys.length === 0) return null;

          return (
            <div key={stmtKey} className="border border-slate-100 rounded-xl bg-slate-50/50 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Icon className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-700">{title}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {fieldKeys.map(fieldKey => {
                  const rawVal = fields[fieldKey];
                  const displayVal = rawVal === null || rawVal === undefined ? '' : rawVal;

                  return (
                    <div key={fieldKey} className="flex justify-between items-center gap-4 py-1 border-b border-slate-100/50">
                      <label className="text-[12px] font-medium text-slate-600 tracking-refined leading-5 select-none" htmlFor={`input-${activeYear}-${stmtKey}-${fieldKey}`}>
                        {getLabel(fieldKey)}
                      </label>
                      <input
                        id={`input-${activeYear}-${stmtKey}-${fieldKey}`}
                        type="text"
                        value={displayVal}
                        onChange={(e) => handleValueChange(activeYear, stmtKey, fieldKey, e.target.value)}
                        placeholder="n/a"
                        className="w-40 bg-white/80 border border-slate-200 rounded-lg px-2.5 py-1 text-right text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all select-all shadow-sm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-6 pt-6 border-t border-slate-100">
        <button
          onClick={handleSave}
          disabled={isSaving || isReanalysing}
          className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold tracking-refined transition-all ${
            saveSuccess
              ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
              : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-sm'
          }`}
        >
          {saveSuccess ? (
            <>
              <CheckIcon className="w-4 h-4" />
              Saved Successfully
            </>
          ) : (
            <>
              {isSaving && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
              Save Edits
            </>
          )}
        </button>
        
        <button
          onClick={handleReanalyseClick}
          disabled={isSaving || isReanalysing}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold tracking-refined shadow-sm shadow-indigo-600/10 transition-all"
        >
          {isReanalysing ? (
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowPathIcon className="w-4 h-4" />
          )}
          Re-run Analysis
        </button>
      </div>
    </div>
  );
};

export default ReviewPanel;
