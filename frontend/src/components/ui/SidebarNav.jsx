import React, { Fragment } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Cog6ToothIcon,
  XMarkIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { label: 'Pipeline', path: '/pipeline', icon: BoltIcon },
  { label: 'Engineering', path: '/engineering', icon: BoltIcon },
  { label: 'Pricing', path: '/pricing', icon: BoltIcon },
  { label: 'Settings', path: '/settings', icon: Cog6ToothIcon },
];

const SidebarNav = ({ isOpen, onClose }) => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <Fragment>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200 bg-white shadow-sm transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">BL</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">PDF Extractor</p>
                <p className="-mt-0.5 text-[10px] font-medium text-slate-400">Admin Panel</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100"
            >
              <XMarkIcon className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <NavLink
                  key={item.label}
                  to={item.path}
                  onClick={onClose}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-[18px] h-[18px] ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'}`} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 px-4 py-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Version</p>
              <p className="text-xs font-medium text-slate-700">v2.0</p>
            </div>
          </div>
        </div>
      </aside>
    </Fragment>
  );
};

export default SidebarNav;
