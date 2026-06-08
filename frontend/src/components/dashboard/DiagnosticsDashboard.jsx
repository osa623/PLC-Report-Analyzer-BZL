import React, { useState, useMemo } from 'react';
import { safeGet, extractYears } from '../../utils/formatters';
import { MagnifyingGlassIcon, FunnelIcon, BugAntIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

const DiagnosticsDashboard = ({ data }) => {
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedEntity, setSelectedEntity] = useState('All');
  const [expandedRow, setExpandedRow] = useState(null);

  const years = extractYears(data);

  // Harvest all failed or not applicable metrics across years, entities and calculations
  const harvestedDiagnostics = useMemo(() => {
    if (!data) return [];
    const results = [];

    const entities = ['bank', 'group'];
    entities.forEach((ent) => {
      years.forEach((yr) => {
        // 1. Ratios
        const ratios = safeGet(data, `ratio_analysis.${ent}.${yr}`, {});
        Object.entries(ratios).forEach(([ratioName, ratioVal]) => {
          if (ratioVal.status === 'FAILED' || ratioVal.status === 'NOT_APPLICABLE') {
            results.push({
              id: `${ent}-${yr}-ratio-${ratioName.replace(/\s+/g, '-')}`,
              entity: ent,
              year: yr,
              metricType: 'Ratio',
              name: ratioName,
              status: ratioVal.status,
              reason: ratioVal.diagnostics?.reason || 'Could not resolve dependent fields',
              calculation: ratioVal.diagnostics?.calculation || '',
              missing: ratioVal.diagnostics?.missing_fields || [],
              available: ratioVal.diagnostics?.available_keys || []
            });
          }
        });

        // 2. Growth
        const growth = safeGet(data, `growth_analysis.${ent}.${yr}`, {});
        Object.entries(growth).forEach(([growthName, growthVal]) => {
          if (growthVal.status === 'FAILED' || growthVal.status === 'NOT_APPLICABLE') {
            results.push({
              id: `${ent}-${yr}-growth-${growthName.replace(/\s+/g, '-')}`,
              entity: ent,
              year: yr,
              metricType: 'Growth',
              name: growthName,
              status: growthVal.status,
              reason: growthVal.diagnostics?.reason || 'Dependent previous or current period fields are missing',
              calculation: growthVal.diagnostics?.calculation || '',
              missing: growthVal.diagnostics?.missing_fields || [],
              available: growthVal.diagnostics?.available_keys || []
            });
          }
        });
      });
    });

    return results;
  }, [data, years]);

  // Filtering and Searching
  const filteredDiagnostics = useMemo(() => {
    return harvestedDiagnostics.filter((d) => {
      const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
                            d.reason.toLowerCase().includes(search.toLowerCase());
      const matchesYear = selectedYear === 'All' || String(d.year) === selectedYear;
      const matchesEntity = selectedEntity === 'All' || d.entity === selectedEntity;
      return matchesSearch && matchesYear && matchesEntity;
    });
  }, [harvestedDiagnostics, search, selectedYear, selectedEntity]);

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800 tracking-tight">Calculation Diagnostics & Audit Table</h3>
          <p className="text-xs text-slate-500">Traceability audit dashboard for tracking metric failures and missing normalized fields.</p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search metric or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        {/* Year Filter */}
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Year:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="flex-grow text-xs font-semibold px-2.5 py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
          >
            <option value="All">All Years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Entity Filter */}
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Entity:</span>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="flex-grow text-xs font-semibold px-2.5 py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
          >
            <option value="All">All Entities</option>
            <option value="bank">Bank / Standalone</option>
            <option value="group">Consolidated Group</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Metric / Calculation</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Year</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Pipeline Status</th>
                <th className="py-3 px-4">Diagnostic Failure Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredDiagnostics.length > 0 ? (
                filteredDiagnostics.map((d) => {
                  const isFailed = d.status === 'FAILED';
                  return (
                    <React.Fragment key={d.id}>
                      <tr
                        onClick={() => toggleRow(d.id)}
                        className="hover:bg-slate-50/50 cursor-pointer transition-all duration-200"
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-800">{d.name}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-500 capitalize">{d.entity}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-600">{d.year}</td>
                        <td className="py-3.5 px-4 text-slate-500">{d.metricType}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            isFailed ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 text-slate-400 border border-slate-200'
                          }`}>
                            {d.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-medium max-w-xs truncate">{d.reason}</td>
                      </tr>
                      {expandedRow === d.id && (
                        <tr className="bg-slate-50/30">
                          <td colSpan={6} className="p-4 border-t border-slate-100">
                            <div className="space-y-3 max-w-3xl pl-4">
                              {d.calculation && (
                                <div className="flex gap-2 items-start text-[11px]">
                                  <BugAntIcon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <span className="font-semibold text-slate-600 block">Calculation Formula:</span>
                                    <code className="text-indigo-600 font-mono text-[10px] mt-0.5 block bg-indigo-50/50 px-2 py-1 rounded border border-indigo-100/30 max-w-fit">{d.calculation}</code>
                                  </div>
                                </div>
                              )}

                              {d.missing.length > 0 && (
                                <div className="flex gap-2 items-start text-[11px]">
                                  <ExclamationCircleIcon className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <span className="font-semibold text-red-600 block">Missing Dependent Fields:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {d.missing.map((m) => (
                                        <span key={m} className="bg-red-50 text-red-600 font-mono text-[10px] px-1.5 py-0.5 rounded border border-red-100/20">{m}</span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {d.available.length > 0 && (
                                <div className="flex gap-2 items-start text-[11px]">
                                  <InformationCircleIcon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <span className="font-semibold text-slate-600 block">Available Normalized Fields for Year:</span>
                                    <div className="flex flex-wrap gap-1 mt-1.5 max-h-[80px] overflow-y-auto pr-1">
                                      {d.available.map((a) => (
                                        <span key={a} className="bg-slate-100 text-slate-500 font-mono text-[9px] px-1 py-0.2 rounded">{a}</span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No failed or skipped metrics match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticsDashboard;
