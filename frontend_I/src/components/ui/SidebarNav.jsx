import React, { Fragment } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  Cog6ToothIcon,
  XMarkIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { label: 'Home', path: '/home', icon: HomeIcon },
  { label: 'Pricing', path: '/pricing', icon: BoltIcon },
  { label: 'Settings', path: '/settings', icon: Cog6ToothIcon },
];

const SidebarNav = ({ isOpen, onClose }) => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <Fragment>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`flex items-center top-0 left-0 z-40 h-16 w-full justify-between bg-white border-b border-slate-200 transition-transform duration-300 lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">BL</span>
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900">PDF Extractor</span>
              <span className="block text-[10px] text-slate-400 -mt-0.5 font-medium">Admin Panel</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden ml-3 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex items-center px-3 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <NavLink
                key={item.label}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Version badge */}
        <div className="px-5 shrink-0">
          <div className="bg-slate-50 rounded-xl px-3 py-1.5">
            <p className="text-xs font-medium text-slate-600">v2.0</p>
          </div>
        </div>
      </aside>
    </Fragment>
  );
};

export default SidebarNav;
