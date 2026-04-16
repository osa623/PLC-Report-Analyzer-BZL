import React from 'react';
import { FileText } from 'lucide-react';

const NAV_TABS = ['Dashboard', 'Reports', 'Comparisons', 'Settings'];

export default function Navbar({ activeTab, onTabChange, connected }) {
  return (
    <nav
      id="global-navbar"
      style={{
        background: '#2d3a8c',
        padding: '0 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 52,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Left: Logo + Title + Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 8,
              padding: '6px 7px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <FileText size={20} color="#fff" />
          </div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>
            Report Analysis
          </span>
        </div>

        <div style={{ display: 'flex', gap: 2 }}>
          {NAV_TABS.map((tab) => (
            <button
              key={tab}
              id={`nav-tab-${tab.toLowerCase()}`}
              onClick={() => onTabChange(tab)}
              style={{
                background: activeTab === tab ? 'rgba(255,255,255,0.15)' : 'transparent',
                border: 'none',
                color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.7)',
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Help + Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500 }}>Help</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>Admin</span>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: connected ? '#22c55e' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            A
          </div>
        </div>
      </div>
    </nav>
  );
}
