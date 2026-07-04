export default function AboutPage() {
  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-[#0A0E1A] via-[#0D1425] to-[#182039] text-gray-100 p-6 sm:p-10 font-sans">

      {/* HERO / INTRO */}
      <section className="max-w-7xl mx-auto py-16 text-center">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#DFBD69] to-white font-encode mb-4">
          Built for Smarter Stock Market Decisions
        </h1>
        <p className="text-lg text-gray-300 max-w-3xl mx-auto">
          A modern financial analysis platform focused on the Colombo Stock Exchange —
          combining clean data, powerful fundamentals, and intuitive dashboards.
        </p>
      </section>

      {/* MISSION */}
      <section className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 py-16 items-center">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#DFBD69] to-white font-encode mb-4">
            Our Mission
          </h2>
          <p className="text-gray-300 mb-4">
            We aim to simplify stock market analysis by giving investors access to
            professional-grade financial data without unnecessary complexity.
          </p>
          <p className="text-gray-300">
            Whether you are a beginner or an experienced investor, our goal is to help
            you understand businesses, not just stock prices.
          </p>
        </div>

        <div className="bg-[#121C33] border border-white/10 rounded-xl p-8">
          <ul className="space-y-4 text-gray-300">
            <li>• Clean and structured financial statements</li>
            <li>• Accurate ratio and valuation models</li>
            <li>• Investor-focused dashboards</li>
            <li>• Colombo Stock Exchange specialization</li>
          </ul>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto py-16">
        <h2 className="text-3xl text-center font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#DFBD69] to-white font-encode mb-12">
          Core Features
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Financial Statements",
              desc: "Income statements, balance sheets, and cash flows structured for clear analysis."
            },
            {
              title: "Ratios & Metrics",
              desc: "Profitability, liquidity, leverage, and efficiency ratios calculated automatically."
            },
            {
              title: "Valuation Models",
              desc: "DCF, FCFE, dividend-based models, and intrinsic value comparisons."
            },
            {
              title: "Portfolio Tracking",
              desc: "Track holdings, performance, gainers, losers, and win rate in one place."
            },
            {
              title: "Clean Dashboards",
              desc: "Minimal, distraction-free dashboards designed for focus and clarity."
            },
            {
              title: "CSE Focused",
              desc: "Built specifically for Sri Lankan investors and the Colombo Stock Exchange."
            }
          ].map((f, i) => (
            <div key={i} className="bg-[#121C33] p-6 rounded-xl border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHO IT’S FOR */}
      <section className="max-w-7xl mx-auto py-16">
        <h2 className="text-3xl text-center font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#DFBD69] to-white font-encode mb-12">
          Who This Platform Is For
        </h2>

        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div className="bg-[#121C33] p-6 rounded-xl border border-white/10">
            <h3 className="text-white font-semibold mb-2">Long-Term Investors</h3>
            <p className="text-gray-400 text-sm">
              Analyze business fundamentals and intrinsic value with confidence.
            </p>
          </div>
          <div className="bg-[#121C33] p-6 rounded-xl border border-white/10">
            <h3 className="text-white font-semibold mb-2">Active Traders</h3>
            <p className="text-gray-400 text-sm">
              Monitor performance, win rates, and portfolio movements efficiently.
            </p>
          </div>
          <div className="bg-[#121C33] p-6 rounded-xl border border-white/10">
            <h3 className="text-white font-semibold mb-2">Students & Researchers</h3>
            <p className="text-gray-400 text-sm">
              Learn valuation, ratios, and financial analysis using real market data.
            </p>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="max-w-7xl mx-auto py-16">
        <div className="grid md:grid-cols-4 gap-8 text-center">
          {[
            ["80%+", "Analytical Accuracy"],
            ["1K+", "Active Users"],
            ["250+", "CSE Stocks Covered"],
            ["24/7", "Data Availability"]
          ].map(([value, label], i) => (
            <div key={i}>
              <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#DFBD69] to-white font-encode mb-2">
                {value}
              </div>
              <div className="text-gray-400 text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
