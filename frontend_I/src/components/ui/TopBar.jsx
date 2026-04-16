import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { useCredits } from '../../utils/CreditContext';
import {
  ChevronRightIcon,
  Bars3Icon,
  UserCircleIcon,
  ArrowLeftOnRectangleIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

const breadcrumbMap = {
  '/home': ['Home'],
  '/settings': ['Settings'],
  '/pricing': ['Pricing'],
};

const TopBar = ({ onToggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { credits } = useCredits();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Build breadcrumb
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (breadcrumbMap[path]) return breadcrumbMap[path];
    if (path.startsWith('/profile/')) return ['Profile'];
    return ['Home'];
  };

  const crumbs = getBreadcrumbs();
  const pageTitle = crumbs[crumbs.length - 1];

  const displayedUser = user || (() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  })();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white  border-b border-slate-200 flex items-center justify-between lg:px-12 shrink-0">
      {/* Left: hamburger + breadcrumb */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
        >
          <Bars3Icon className="w-5 h-5 text-slate-600" />
        </button>

        <div className="hidden sm:flex items-center gap-1.5 text-sm">
          <span className="text-slate-400 font-medium">PDF Extractor Panel</span>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRightIcon className="w-3.5 h-3.5 text-slate-300" />
              <span className={i === crumbs.length - 1 ? 'text-slate-900 font-semibold' : 'text-slate-400 font-medium'}>
                {c}
              </span>
            </span>
          ))}
        </div>

        <span className="sm:hidden text-sm font-semibold text-slate-900">{pageTitle}</span>
      </div>

      {/* Right: credits, profile */}
      <div className="flex items-center gap-2">
        {/* Credits badge */}
        <button
          onClick={() => navigate('/pricing')}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <BoltIcon className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-slate-800">{credits}</span>
          <span className="hidden sm:inline text-slate-400">credit{credits !== 1 ? 's' : ''}</span>
        </button>

        {/* Profile */}
        {displayedUser ? (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="hidden md:block text-right">
                <div className="text-xs font-semibold text-slate-900">{displayedUser.email || 'User'}</div>
                <div className="text-[10px] text-slate-400">{credits} credits remaining</div>
              </div>
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                {displayedUser.email ? displayedUser.email[0].toUpperCase() : <UserCircleIcon className="w-5 h-5" />}
              </div>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 min-w-[180px]">
                <button
                  onClick={() => { navigate(`/profile/${displayedUser._id || displayedUser.id}`); setProfileOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <UserCircleIcon className="w-4 h-4" />
                  View Profile
                </button>
                <button
                  onClick={() => { navigate('/pricing'); setProfileOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <BoltIcon className="w-4 h-4" />
                  Buy Credits
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <ArrowLeftOnRectangleIcon className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Guest user */
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/register')}
              className="text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors"
            >
              Register
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default TopBar;
