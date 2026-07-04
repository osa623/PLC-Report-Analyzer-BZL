import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { navigationItems, routes } from "@/lib/app.config";
import { useState, useEffect, useMemo } from "react";
import styles from './Header.module.css';
import { useAuthStore } from "@/lib/store/auth-store";



import {
  useTradeSummary,
} from "@/hooks/useCseApi";

//images
//import webicon_I from '../assets/Header/bullNavBar.png';
//import { ProgressPanel } from './Common/ProgressPanel';
import webicon_I from '../assets/Header/buyzonlabslogo.png';



export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { firebaseUser, backendUser, signOut, registrationInProgress } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const { data: stocks } = useTradeSummary({ refetchInterval : 10_000});

  const displayName = backendUser
    ? `${backendUser.first_name} ${backendUser.last_name}`
    : firebaseUser?.email?.split('@')[0] || '';

  const firstName = backendUser?.first_name || '';

  const displayImage = backendUser?.avatar_url || null;  

  const displayEmail = backendUser?.email || firebaseUser?.email || '';
  // Only show authenticated UI when not in the middle of multi-step registration
  const isAuthenticated = !!firebaseUser && !registrationInProgress;

  const userStatus = backendUser ? backendUser.subscription_status : 'Free Plan';



  // Market indicators (mock data - replace with real API)
  const marketData = [
    { symbol: 'S&P 500', value: '4,783.45', change: '+0.89%', isPositive: true },
    { symbol: 'NASDAQ', value: '15,011.35', change: '+1.24%', isPositive: true },
    { symbol: 'DOW', value: '37,545.33', change: '-0.32%', isPositive: false },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  return (
    <>
      {/* Top Bar with Market Indicators */}
      <div className="bg-gradient-to-r from-[#0D1325] via-[#182847] to-[#0D1325] text-white border-b border-[#306B99]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-10 text-xs sm:text-sm">
            {/* Marquee Market Data */}
            <div className="flex-1 overflow-hidden">
              <div className="relative w-full h-10">
                <div className="absolute left-0 top-0 h-full w-full overflow-hidden">
                  <div
                    className="flex items-center h-full animate-horizontal-marquee whitespace-nowrap"
                    style={{ minWidth: '200%' }}
                  >
                   {stocks?.reqTradeSummery?.map((stock, index) => (
                      <div key={index} className="flex items-cent space-x-2 mx-6">
                        <span className="text-white font-jetbrains">{stock.symbol}</span>
                        <span className="text-gray-300">{stock.closingPrice}</span>
                        <span className={`font-medium ${stock.percentageChange ? 'text-green-400' : 'text-red-400'}`}>{stock.change}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <style jsx>{`
                  @keyframes horizontal-marquee {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                  }
                  .animate-horizontal-marquee {
                    animation: horizontal-marquee 18s linear infinite;
                  }
                `}</style>
              </div>
            </div>
            <div className="hidden md:flex items-center lg:px-12 space-x-4 text-xs">
              {/*
              <button className="text-gray-300 hover:text-[#E9D37E] transition-colors">
                <span className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span>Alerts</span>
                </span>
              </button>
              <div className="h-4 w-px bg-[#306B99]" />
              */}
              {isAuthenticated ? (
                <span className="text-[#E9D37E] font-medium truncate max-w-[120px]">
                  {displayName}
                </span>
              ) : (
                <Link href={routes.login.path} className="text-gray-300 hover:text-[#E9D37E] transition-colors">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled
          ? 'bg-white backdrop-blur-xl shadow-lg shadow-[#306B99]/20'
          : 'bg-white'
          }`}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">

            {/* Logo */}
            <div className="flex items-center px-6">
              <Link href="/" className="group flex items-center">
                <div className="relative">
                  <div className="flex items-center justify-center inset-0 group-hover:opacity-75 transition-opacity" />
                  <img src={webicon_I} alt="Logo" className="w-15 auto object-cover object-center flex" />
                </div>
                {/*<div className="flex flex-col">
                  <span className="text-xl sm:text-2xl font-bowlby text-white group-hover:text-[#E9D37E] transition-colors">
                    BUYZONLAB
                  </span>
                  <span className="text-[10px] sm:text-xs font-encode text-[#B28D41] -mt-1">
                    Stock Analytics
                  </span>
                </div> */}
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative px-3 py-2 text-sm font-encode font-medium text-[#0D1325] hover:text-white transition-colors group"
                >
                  <span className="relative z-10">{item.label}</span>
                  <div className="absolute inset-0 bg-[#0D1325]/0 group-hover:bg-[#0d1b46] rounded-lg transition-all duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#B28D41] to-[#E9D37E] scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                </Link>
              ))}

              {/* Markets Dropdown 
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'markets' ? null : 'markets')}
                  className="flex items-center space-x-1 px-4 py-2 text-sm font-encode font-medium text-gray-300 hover:text-white transition-colors"
                >
                  <span>Markets</span>
                  <svg className={`w-4 h-4 transition-transform ${activeDropdown === 'markets' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {activeDropdown === 'markets' && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-[#0D1325]/95 backdrop-blur-xl border border-[#306B99]/30 rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-2">
                      {['Stock Market', 'Crypto', 'Forex', 'Commodities', 'Indices'].map((market) => (
                        <Link
                          key={market}
                          href="#"
                          className="block px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-[#306B99]/20 rounded-lg transition-all"
                        >
                          {market}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div> */}
            </div>

            {/* Search Bar */}
            <ProgressPanel/>


            {/* Action Buttons */}
            
            <div className="hidden lg:flex items-center space-x-3">
              {isAuthenticated ? (
                /* === Authenticated User Menu === */
                <div className="relative">
                  <button
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-3 px-4 py-2 rounded-lg border border-[#306B99]/30 text-gray-300 hover:text-white hover:bg-[#306B99]/10 hover:border-[#B28D41] transition-all"
                  >
                  {/* Avatar circle */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#B28D41] to-[#E9D37E] flex-shrink-0 overflow-hidden">
                    <img
                    alt="avatarImage"
                    className="w-full h-full object-cover"
                    src={displayImage || '/default-avatar.png'}
                    />
                  </div>

                  {/* User Info */}
                  <div className="hidden sm:flex flex-col justify-center items-start">
                    <span className="text-xs font-encode font-medium text-white">{displayName}</span>
                    <span className="text-[10px] font-encode text-[#B28D41]">{userStatus}</span>
                  </div>

                  {/* Dropdown Arrow */}
                  <svg
                    className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                    />
                  </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-[#0D1325]/98 backdrop-blur-xl border border-[#306B99]/30 rounded-xl shadow-2xl shadow-[#306B99]/20 overflow-hidden z-50">
                    <div className="p-4 border-b border-[#306B99]/30 bg-gradient-to-r from-[#182847]/50 to-transparent">
                    <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                    <p className="text-xs text-gray-400 truncate">{displayEmail}</p>
                    {backendUser && (
                      <span
                      className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-semibold ${
                        backendUser.subscription_status === 'premium'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-[#306B99]/30 text-[#B28D41]'
                      }`}
                      >
                      {backendUser.subscription_status === 'premium'
                        ? 'PREMIUM'
                        : 'FREE PLAN'}
                      </span>
                    )}
                    </div>
                    <div className="p-2 space-y-1">
                    <Link
                      href="/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#306B99]/20 rounded-lg transition-all group"
                    >
                      <svg
                      className="w-4 h-4 text-[#B28D41] group-hover:text-[#E9D37E]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                      </svg>
                      <span>Profile</span>
                    </Link>
                    <Link
                      href="/portfolio"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#306B99]/20 rounded-lg transition-all group"
                    >
                      <svg
                      className="w-4 h-4 text-[#B28D41] group-hover:text-[#E9D37E]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                      </svg>
                      <span>Portfolio</span>
                    </Link>
                    </div>
                    <div className="p-2 border-t border-[#306B99]/30">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all group"
                    >
                      <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                      </svg>
                      <span>Sign Out</span>
                    </button>
                    </div>
                  </div>
                  )}
                </div>
              ) : (
                /* === Not Authenticated === */
                <>
                  <Link
                    href={routes.register.path}
                    className="px-4 py-2 text-sm cursor-pointer font-encode font-medium bg-gradient-to-r from-[#0D1325] via-[#182847] to-[#0D1325] text-white rounded-lg hover:shadow-lg hover:shadow-[#B28D41]/30 transition-all duration-300 hover:scale-105"
                  >
                    Get Started
                  </Link>

                  <Link
                    href={routes.login.path}
                    className="p-2 rounded-lg border border-[#306B99]/30 text-[#0D1325] hover:text-[#0D1325] hover:border-[#B28D41] transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-[#0D1325] hover:text-white hover:bg-[#306B99]/20 transition-all"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-[#306B99]/30 bg-[#0D1325]/98 backdrop-blur-xl">
            <div className="px-4 py-4 space-y-3">
              {/* Mobile Search */}
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search stocks..."
                  className="w-full bg-[#182847]/50 border border-[#306B99]/30 text-white placeholder-gray-500 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B28D41]/50"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Mobile Navigation Links */}
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-4 py-3 text-base font-encode text-gray-300 hover:text-white hover:bg-[#306B99]/20 rounded-lg transition-all"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}

              {/* Mobile Markets Section */}
              <div className="pt-4 border-t border-[#306B99]/30">
                <p className="px-4 text-xs font-semibold text-[#B28D41] uppercase tracking-wider mb-2">Markets</p>
                {['Stock Market', 'Crypto', 'Forex', 'Commodities'].map((market) => (
                  <Link
                    key={market}
                    href="#"
                    className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-[#306B99]/20 rounded-lg transition-all"
                  >
                    {market}
                  </Link>
                ))}
              </div>

              {/* Mobile Action Buttons */}
              <div className="pt-4 space-y-2">
                {isAuthenticated ? (
                  <>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#B28D41] to-[#E9D37E] flex items-center justify-center text-[#0D1325] font-bold">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{displayName}</p>
                        <p className="text-xs text-gray-400">{displayEmail}</p>
                      </div>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 text-sm font-encode font-medium border border-[#306B99]/30 text-gray-300 rounded-lg hover:text-white hover:border-[#B28D41] transition-all text-center"
                    >
                      Profile
                    </Link>
                    <button
                      onClick={() => { handleSignOut(); setIsMobileMenuOpen(false); }}
                      className="w-full px-4 py-3 text-sm font-encode font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href={routes.register.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 text-sm font-encode font-medium bg-gradient-to-r from-[#B28D41] to-[#E9D37E] text-[#0D1325] rounded-lg hover:shadow-lg transition-all text-center"
                    >
                      Get Started
                    </Link>
                    <Link
                      href={routes.login.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 text-sm font-encode font-medium border border-[#306B99]/30 text-gray-300 rounded-lg hover:text-white hover:border-[#B28D41] transition-all text-center"
                    >
                      Sign In
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
