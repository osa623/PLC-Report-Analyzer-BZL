import React, { useMemo } from 'react';

function normalizeLabel(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sortYears(values = []) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => Number(a) - Number(b));
}

function formatCurrency(value, currency = 'LKR') {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const prefix = currency === 'USD' ? '$' : 'LKR ';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${prefix}${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${prefix}${(value / 1e3).toFixed(1)}K`;
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatByType(value, valueType, currency = 'LKR') {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (valueType === 'percent') {
    const normalized = Math.abs(value) <= 1 ? value * 100 : value;
    return `${normalized.toFixed(2)}%`;
  }
  if (valueType === 'ratio') return value.toFixed(2);
  if (valueType === 'number') return value.toFixed(2);
  return formatCurrency(value, currency);
}

function valueFromRows(rows, aliases, year) {
  const normalizedAliases = aliases.map((alias) => normalizeLabel(alias));
  const candidates = (Array.isArray(rows) ? rows : []).filter((row) => {
    if (String(row?.year || '') !== String(year)) return false;
    const label = normalizeLabel(row?.canonical_label || row?.original_label || '');
    return normalizedAliases.some((alias) => label.includes(alias));
  });

  if (candidates.length === 0) return null;
  const best = candidates.sort((a, b) => Math.abs(b?.value || 0) - Math.abs(a?.value || 0))[0];
  return typeof best?.value === 'number' && Number.isFinite(best.value) ? best.value : null;
}

function valueFromRatioYear(metricMap, aliases) {
  if (!metricMap || typeof metricMap !== 'object') return null;
  for (const alias of aliases) {
    const exact = metricMap[alias];
    if (typeof exact === 'number' && Number.isFinite(exact)) return exact;
  }
  const keys = Object.keys(metricMap);
  for (const alias of aliases) {
    const foundKey = keys.find((key) => key.toLowerCase().includes(alias.toLowerCase()));
    if (!foundKey) continue;
    const foundValue = metricMap[foundKey];
    if (typeof foundValue === 'number' && Number.isFinite(foundValue)) return foundValue;
  }
  return null;
}

function StatementTable({ title, caption, years, rows, currency = 'LKR' }) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white">
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <h3 className="text-[14px] font-semibold text-slate-900 tracking-[-0.02em]">{title}</h3>
        <p className="text-[11px] text-slate-500 mt-1 tracking-[-0.01em]">{caption}</p>
      </div>

      <div className="max-h-[320px] overflow-y-auto overflow-x-auto">
        <table className="data-table min-w-[680px]">
          <thead>
            <tr>
              <th className="sticky top-0 z-20 bg-slate-50">Line Item</th>
              {years.map((year) => (
                <th key={year} className="sticky top-0 z-20 bg-slate-50 text-right">{year}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.kind === 'divider') {
                return (
                  <tr key={row.label}>
                    <td
                      colSpan={years.length + 1}
                      className="bg-slate-50/80 text-[10px] uppercase font-semibold text-slate-500 tracking-wider border-t border-slate-200/80"
                    >
                      {row.label}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={row.label}>
                  <td className="font-medium text-slate-700">{row.label}</td>
                  {years.map((year) => (
                    <td key={`${row.label}-${year}`} className="text-right font-semibold text-slate-900">
                      {formatByType(row.values?.[year], row.valueType, currency)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ValidatedDataTable({ data, analytics = null, currency = 'LKR' }) {
  const rows = useMemo(() => {
    const validatedRows = data?.validated?.validated_rows;
    return Array.isArray(validatedRows) ? validatedRows : [];
  }, [data]);

  const grouped = useMemo(() => {
    return rows.reduce((acc, row) => {
      const key = row?.statement_type || 'unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});
  }, [rows]);

  const statementYears = useMemo(() => {
    const years = rows
      .map((row) => String(row?.year || ''))
      .filter((year) => /^\d{4}$/.test(year));
    const sorted = sortYears(years);
    return sorted.length > 0 ? sorted : ['Latest'];
  }, [rows]);

  const ratioByYear = analytics?.ratios?.by_year && typeof analytics.ratios.by_year === 'object'
    ? analytics.ratios.by_year
    : {};
  const marketYears = sortYears(Object.keys(ratioByYear).filter((year) => /^\d{4}$/.test(year)));
  const effectiveMarketYears = marketYears.length > 0 ? marketYears : statementYears;

  if (rows.length === 0) {
    return (
      <div className="card">
        <div className="card-header">Investor Statement View</div>
        <div className="card-body text-center text-slate-400 py-10 text-[13px] tracking-[-0.01em]">
          No validated data available yet. Pipeline must complete validation stage.
        </div>
      </div>
    );
  }

  const incomeConfig = [
    { label: 'Revenue', aliases: ['revenue', 'total_revenue', 'turnover', 'sales'], valueType: 'currency' },
    { label: 'Cost of Revenue', aliases: ['cost_of_revenue', 'cost of revenue', 'cost_of_sales'], valueType: 'currency' },
    { label: 'Gross Profit', aliases: ['gross_profit', 'gross profit'], valueType: 'currency' },
    { label: 'Operating Expenses', aliases: ['operating_expenses', 'operating expenses'], valueType: 'currency' },
    { label: 'Operating Profit', aliases: ['operating_profit', 'operating income', 'ebit'], valueType: 'currency' },
    { label: 'Finance Cost', aliases: ['finance_cost', 'finance cost', 'interest_expense'], valueType: 'currency' },
    { label: 'Profit Before Tax', aliases: ['profit_before_tax', 'profit before tax', 'pbt'], valueType: 'currency' },
    { label: 'Income Tax', aliases: ['income_tax', 'tax_expense'], valueType: 'currency' },
    { label: 'Net Income', aliases: ['net_income', 'net_profit', 'profit_after_tax'], valueType: 'currency' },
  ];

  const balanceSections = [
    {
      section: 'Assets',
      rows: [
        { label: 'Total Assets', aliases: ['total_assets', 'total assets'], valueType: 'currency' },
        { label: 'Current Assets', aliases: ['current_assets', 'current assets'], valueType: 'currency' },
        { label: 'Non-Current Assets', aliases: ['non_current_assets', 'non-current assets'], valueType: 'currency' },
      ],
    },
    {
      section: 'Liabilities',
      rows: [
        { label: 'Total Liabilities', aliases: ['total_liabilities', 'total liabilities'], valueType: 'currency' },
        { label: 'Current Liabilities', aliases: ['current_liabilities', 'current liabilities'], valueType: 'currency' },
        { label: 'Non-Current Liabilities', aliases: ['non_current_liabilities', 'non-current liabilities'], valueType: 'currency' },
      ],
    },
    {
      section: 'Equity',
      rows: [
        { label: 'Total Equity', aliases: ['total_equity', 'equity'], valueType: 'currency' },
        { label: 'Share Capital', aliases: ['share_capital', 'share capital'], valueType: 'currency' },
        { label: 'Retained Earnings', aliases: ['retained_earnings', 'retained earnings'], valueType: 'currency' },
      ],
    },
  ];

  const cashFlowConfig = [
    { label: 'Operating Activities', aliases: ['operating_cash_flow', 'cash flow from operating'], valueType: 'currency' },
    { label: 'Investing Activities', aliases: ['investing_cash_flow', 'cash flow from investing'], valueType: 'currency' },
    { label: 'Financing Activities', aliases: ['financing_cash_flow', 'cash flow from financing'], valueType: 'currency' },
    { label: 'Net Cash Flow', aliases: ['net_cash_flow', 'total_cash_flow'], valueType: 'currency' },
  ];

  const marketConfig = [
    { label: 'EPS', aliases: ['eps', 'earnings_per_share'], valueType: 'number' },
    { label: 'BVPS', aliases: ['book_value_per_share', 'bvps'], valueType: 'number' },
    { label: 'Market Cap', aliases: ['market_capitalization', 'market_cap'], valueType: 'currency' },
    { label: 'Enterprise Value', aliases: ['enterprise_value'], valueType: 'currency' },
    { label: 'P/E', aliases: ['price_to_earnings_ratio', 'pe_ratio', 'p_e'], valueType: 'ratio' },
    { label: 'P/B', aliases: ['price_to_book_ratio', 'pb_ratio', 'p_b'], valueType: 'ratio' },
    { label: 'Dividend Yield', aliases: ['dividend_yield'], valueType: 'percent' },
  ];

  const incomeRows = incomeConfig.map((metric) => ({
    ...metric,
    values: Object.fromEntries(
      statementYears.map((year) => [year, valueFromRows(grouped.income_statement || [], metric.aliases, year)])
    ),
  }));

  const balanceRows = balanceSections.flatMap((section) => {
    const sectionRows = section.rows.map((metric) => ({
      ...metric,
      values: Object.fromEntries(
        statementYears.map((year) => [year, valueFromRows(grouped.balance_sheet || [], metric.aliases, year)])
      ),
    }));
    return [{ kind: 'divider', label: section.section }, ...sectionRows];
  });

  const cashFlowRows = cashFlowConfig.map((metric) => ({
    ...metric,
    values: Object.fromEntries(
      statementYears.map((year) => [year, valueFromRows(grouped.cashflow_statement || [], metric.aliases, year)])
    ),
  }));

  const marketRows = marketConfig.map((metric) => ({
    ...metric,
    values: Object.fromEntries(
      effectiveMarketYears.map((year) => [year, valueFromRatioYear(ratioByYear[year], metric.aliases)])
    ),
  }));

  return (
    <div className="card fade-in">
      <div className="card-header">Investor Statement View ({currency})</div>
      <div className="card-body space-y-4">
        <StatementTable
          title="Income Statement"
          caption="Consolidated Income Statement (Group - LKR)"
          years={statementYears}
          rows={incomeRows}
          currency={currency}
        />

        <StatementTable
          title="Balance Sheet"
          caption="Consolidated Balance Sheet (Group - LKR)"
          years={statementYears}
          rows={balanceRows}
          currency={currency}
        />

        <StatementTable
          title="Cash Flow Statement"
          caption="Consolidated Cash Flow Statement (Group - LKR)"
          years={statementYears}
          rows={cashFlowRows}
          currency={currency}
        />

        <StatementTable
          title="Market & Share Metrics"
          caption="Market & Per-Share Metrics"
          years={effectiveMarketYears}
          rows={marketRows}
          currency={currency}
        />
      </div>
    </div>
  );
}
