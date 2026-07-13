import { useEffect, useRef, useState } from "react";
import { searchCompanies, getCompany } from "@/lib/company-api";
import { useCompanyStore } from "@/lib/store/company-store";
import {
  Building2,
  Briefcase,
  Loader2,
  Search,
  SlidersHorizontal,
  ChevronDown
} from "lucide-react";

type Company = {
  companyName: string;
  ticker: string;
  sector: string;
  logo: string;
};

export default function CompanyForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const company = useCompanyStore((s) => s.company);
  const setCompany = useCompanyStore((s) => s.setCompany);

  const debounceRef = useRef<any>(null);

  // ---------------------------
  // LIVE SEARCH (AUTO FETCH)
  // ---------------------------
  const handleSearch = (value: string) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);

      const data = await searchCompanies(value);

      console.log("🔍 SEARCH RESULT:", data);

      setResults(data || []);
      setLoading(false);
    }, 400);
  };

  // ---------------------------
  // SELECT COMPANY (AUTO FILL)
  // ---------------------------
  const selectCompany = async (symbol: string) => {
    setLoading(true);

    const res = await getCompany(symbol);

    console.log("📦 PROFILE RESPONSE:", res);

    const data = res?.data || res;

    const normalized: Company = {
      companyName:
        data?.companyName ||
        data?.name ||
        data?.reqComSumInfo?.[0]?.name ||
        "",

      ticker:
        data?.ticker ||
        data?.symbol ||
        data?.reqComSumInfo?.[0]?.symbol ||
        "",

      sector:
        data?.sector ||
        data?.reqComSumInfo?.[0]?.sector ||
        "",

      logo: data?.logo || ""
    };

    setCompany(normalized);
    setQuery(normalized.companyName);
    setResults([]);
    setLoading(false);
  };

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Search Input */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search company name or symbol..."
          className="w-full h-11 pl-11 pr-11 rounded-xl border border-gray-200 bg-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
        />
        {loading ? (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        ) : (
          <SlidersHorizontal className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors" />
        )}

        {/* DROPDOWN */}
        {results.length > 0 && (
          <div className="absolute z-50 mt-2 w-full bg-white border border-gray-150 rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {results.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectCompany(item.symbol)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 flex justify-between items-center transition-colors border-b last:border-b-0 border-gray-100"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {item.symbol}
                  </p>
                </div>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {item.sector}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid: Name & Ticker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Company Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">
            Company Name
          </label>
          <div className="relative">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={company.companyName}
              readOnly
              placeholder="Enter company name"
              className="w-full h-11 pl-10 px-3 border border-gray-200 rounded-xl bg-slate-50/50 text-sm outline-none text-slate-700 font-medium"
            />
          </div>
        </div>

        {/* Ticker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">
            Ticker
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">#</span>
            <input
              value={company.ticker}
              readOnly
              placeholder="Enter ticker symbol"
              className="w-full h-11 pl-10 px-3 border border-gray-200 rounded-xl bg-slate-50/50 text-sm outline-none text-slate-700 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Sector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">
          Sector
        </label>
        <div className="relative">
          <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={company.sector}
            onChange={(e) =>
              setCompany({ ...company, sector: e.target.value })
            }
            placeholder="Select sector"
            className="w-full h-11 pl-10 pr-10 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-700 font-medium transition-all"
          />
          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}