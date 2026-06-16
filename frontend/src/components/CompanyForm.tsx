import { useEffect, useRef, useState } from "react";
import { searchCompanies, getCompany } from "@/lib/company-api";
import { useCompanyStore } from "@/lib/store/company-store";
import {
  Building2,
  BadgeDollarSign,
  Briefcase,
  Loader2
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
    <div className="w-full max-w-3xl mx-auto">
      {/* CARD */}
      <div className="rounded-3xl border border-border/60 bg-white/80 backdrop-blur-xl shadow-[0_30px_80px_-40px_rgba(0,0,0,0.25)] p-6">

        {/* HEADER */}
        <div className="text-start w-full items-center justify-start mb-6">
          <p className="text-xs text-muted-foreground mt-1">
            Search for the company name and select the correct company from the results.
          </p>
           <p className="text-xs font-italic text-muted-foreground mt-1">
            You may update the sector to the most appropriate category. </p>
        </div>



        {/* LOGO AND FORM */}
        <div className="mt-6 relative flex items-center gap-4 justify-start">

          <div className="h-20 rounded-full w-20 border overflow-hidden flex items-center justify-center bg-white">
            {company.logo ? (
              <img
                src={company.logo}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-xs text-gray-400">Logo</span>
            )}
          </div>
          <div className="relative w-[30vw]">

          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

          <input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search company name or symbol..."
            className="w-full h-10 pl-11 pr-4 rounded-2xl border bg-white text-sm focus:ring-2 focus:ring-black/10 outline-none"
          />

          {loading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-500" />
          )}

          {/* DROPDOWN */}
          {results.length > 0 && (
            <div className="absolute z-50 mt-2 w-full bg-white border rounded-2xl shadow-lg overflow-hidden">

              {results.map((item, i) => (
                <button
                  key={i}
                  onClick={() => selectCompany(item.symbol)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.symbol}
                    </p>
                  </div>

                  <span className="text-xs text-gray-400">
                    {item.sector}
                  </span>
                </button>
              ))}
            </div>
          )}
          </div>

        </div>

        {/* FORM */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">

          {/* NAME */}
          <div>
            <label className="text-sm font-medium">
              Company Name
            </label>
            <input
              value={company.companyName}
              readOnly
              className="w-full mt-2 h-11 px-3 border rounded-xl bg-gray-50"
            />
          </div>

          {/* TICKER */}
          <div>
            <label className="text-sm font-medium">
              Ticker
            </label>
            <input
              value={company.ticker}
              readOnly
              className="w-full mt-2 h-11 px-3 border rounded-xl bg-gray-50"
            />
          </div>

          {/* SECTOR */}
          <div className="md:col-span-2">
            <label className="text-sm font-medium">
              Sector
            </label>
            <div className="relative mt-2">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />

              <input
                value={company.sector}
                onChange={(e) =>
                  setCompany({ ...company, sector: e.target.value })
                }
                className="w-full h-11 pl-10 px-3 border rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* STATUS 
        <div className="flex flex-wrap gap-2 mt-6">
          {["API Connected", "Auto Fill Active", "CSE Live Data"].map(
            (t) => (
              <span
                key={t}
                className="text-xs px-3 py-1 rounded-full border bg-gray-50"
              >
                {t}
              </span>
            )
          )}
        </div> */}

      </div>
    </div>
  );
}