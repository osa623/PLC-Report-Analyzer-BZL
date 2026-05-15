import Svg, { Circle, Path, Rect, Line, Polyline } from 'react-native-svg';
import { useAppTheme } from '@/store/useThemeStore';

export type IconName =
  | 'dashboard' | 'financials' | 'patterns' | 'insights' | 'shield' | 'spark'
  | 'building' | 'filter' | 'back' | 'bell' | 'ratios' | 'chevronRight'
  | 'info' | 'check' | 'warning' | 'trend'
  // New icons for extraction module
  | 'upload' | 'document' | 'pipeline' | 'analytics' | 'cpu' | 'scan'
  | 'layers' | 'database' | 'clock' | 'refresh' | 'download' | 'export'
  | 'play' | 'pause' | 'settings' | 'user' | 'grid' | 'list'
  | 'file' | 'folder' | 'search' | 'zap' | 'activity' | 'eye'
  | 'share' | 'home' | 'reports' | 'alerts' | 'more';

export function IconGlyph({ name, color, size = 24 }: { name: IconName; color?: string; size?: number }) {
  const theme = useAppTheme();
  const stroke = color || theme.text;

  if (name === 'dashboard') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /></Svg>;
  }
  if (name === 'home') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /></Svg>;
  }
  if (name === 'financials') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="4" y="11" width="3" height="8" rx="1" stroke={stroke} fill="none" strokeWidth={1.6} /><Rect x="10.5" y="7" width="3" height="12" rx="1" stroke={stroke} fill="none" strokeWidth={1.6} /><Rect x="17" y="4" width="3" height="15" rx="1" stroke={stroke} fill="none" strokeWidth={1.6} /></Svg>;
  }
  if (name === 'patterns') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M5 17c2-7 4-10 7-10s5 3 7 10" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Circle cx="5" cy="17" r="2" stroke={stroke} fill="none" strokeWidth={1.6} /><Circle cx="12" cy="7" r="2" stroke={stroke} fill="none" strokeWidth={1.6} /><Circle cx="19" cy="17" r="2" stroke={stroke} fill="none" strokeWidth={1.6} /></Svg>;
  }
  if (name === 'insights' || name === 'spark') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 3l2.2 6L20 12l-5.8 3L12 21l-2.2-6L4 12l5.8-3z" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /></Svg>;
  }
  if (name === 'shield') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /><Path d="M9 12l2 2 4-5" stroke={stroke} strokeWidth={1.6} fill="none" strokeLinecap="round" /></Svg>;
  }
  if (name === 'building') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="5" y="4" width="14" height="16" rx="2" fill="none" stroke={stroke} strokeWidth={1.6} /><Path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h6" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /></Svg>;
  }
  if (name === 'filter') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M4 5h16l-6 7v5l-4 2v-7z" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /></Svg>;
  }
  if (name === 'bell') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  }
  if (name === 'ratios') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="9" fill="none" stroke={stroke} strokeWidth={1.6} /><Path d="M12 6v6l4 2" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /></Svg>;
  }
  if (name === 'chevronRight') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M9 5l7 7-7 7" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  }
  if (name === 'info') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="9" fill="none" stroke={stroke} strokeWidth={1.6} /><Path d="M12 16v-4M12 8h.01" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /></Svg>;
  }
  if (name === 'check') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M20 6L9 17l-5-5" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  }
  if (name === 'warning') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 9v4M12 17h.01" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="none" stroke={stroke} strokeWidth={1.6} /></Svg>;
  }
  if (name === 'trend') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M23 6l-9.5 9.5-5-5L1 18" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /><Path d="M17 6h6v6" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  }

  // ==============================
  // New icons for extraction module
  // ==============================
  if (name === 'upload') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /><Polyline points="17 8 12 3 7 8" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /><Line x1="12" y1="3" x2="12" y2="15" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /></Svg>;
  }
  if (name === 'document' || name === 'file') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /><Polyline points="14 2 14 8 20 8" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /><Line x1="16" y1="13" x2="8" y2="13" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Line x1="16" y1="17" x2="8" y2="17" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Polyline points="10 9 9 9 8 9" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /></Svg>;
  }
  if (name === 'pipeline') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="6" cy="6" r="3" fill="none" stroke={stroke} strokeWidth={1.6} /><Circle cx="18" cy="6" r="3" fill="none" stroke={stroke} strokeWidth={1.6} /><Circle cx="6" cy="18" r="3" fill="none" stroke={stroke} strokeWidth={1.6} /><Circle cx="18" cy="18" r="3" fill="none" stroke={stroke} strokeWidth={1.6} /><Line x1="9" y1="6" x2="15" y2="6" stroke={stroke} strokeWidth={1.6} /><Line x1="6" y1="9" x2="6" y2="15" stroke={stroke} strokeWidth={1.6} /><Line x1="18" y1="9" x2="18" y2="15" stroke={stroke} strokeWidth={1.6} /><Line x1="9" y1="18" x2="15" y2="18" stroke={stroke} strokeWidth={1.6} /></Svg>;
  }
  if (name === 'analytics') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M18 20V10" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Path d="M12 20V4" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Path d="M6 20v-6" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /></Svg>;
  }
  if (name === 'cpu' || name === 'scan') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke={stroke} strokeWidth={1.6} /><Rect x="9" y="9" width="6" height="6" rx="1" fill="none" stroke={stroke} strokeWidth={1.6} /><Line x1="9" y1="1" x2="9" y2="4" stroke={stroke} strokeWidth={1.6} /><Line x1="15" y1="1" x2="15" y2="4" stroke={stroke} strokeWidth={1.6} /><Line x1="9" y1="20" x2="9" y2="23" stroke={stroke} strokeWidth={1.6} /><Line x1="15" y1="20" x2="15" y2="23" stroke={stroke} strokeWidth={1.6} /><Line x1="20" y1="9" x2="23" y2="9" stroke={stroke} strokeWidth={1.6} /><Line x1="20" y1="14" x2="23" y2="14" stroke={stroke} strokeWidth={1.6} /><Line x1="1" y1="9" x2="4" y2="9" stroke={stroke} strokeWidth={1.6} /><Line x1="1" y1="14" x2="4" y2="14" stroke={stroke} strokeWidth={1.6} /></Svg>;
  }
  if (name === 'layers') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Polyline points="12 2 2 7 12 12 22 7 12 2" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /><Polyline points="2 17 12 22 22 17" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /><Polyline points="2 12 12 17 22 12" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /></Svg>;
  }
  if (name === 'database') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 2C6.48 2 4 3.79 4 5s2.48 3 8 3 8-1.79 8-3-2.48-3-8-3z" fill="none" stroke={stroke} strokeWidth={1.6} /><Path d="M4 5v14c0 1.1 3.58 3 8 3s8-1.9 8-3V5" fill="none" stroke={stroke} strokeWidth={1.6} /><Path d="M4 12c0 1.1 3.58 3 8 3s8-1.9 8-3" fill="none" stroke={stroke} strokeWidth={1.6} /></Svg>;
  }
  if (name === 'clock') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="10" fill="none" stroke={stroke} strokeWidth={1.6} /><Polyline points="12 6 12 12 16 14" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  }
  if (name === 'refresh') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Polyline points="23 4 23 10 17 10" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /><Polyline points="1 20 1 14 7 14" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /><Path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  }
  if (name === 'download') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /><Polyline points="7 10 12 15 17 10" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /><Line x1="12" y1="15" x2="12" y2="3" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /></Svg>;
  }
  if (name === 'export') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /><Polyline points="17 8 12 3 7 8" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /><Line x1="12" y1="3" x2="12" y2="15" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /></Svg>;
  }
  if (name === 'play') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M5 3l14 9-14 9V3z" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /></Svg>;
  }
  if (name === 'pause') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="6" y="4" width="4" height="16" fill="none" stroke={stroke} strokeWidth={1.6} /><Rect x="14" y="4" width="4" height="16" fill="none" stroke={stroke} strokeWidth={1.6} /></Svg>;
  }
  if (name === 'settings') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="3" fill="none" stroke={stroke} strokeWidth={1.6} /><Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" fill="none" stroke={stroke} strokeWidth={1.6} /></Svg>;
  }
  if (name === 'user') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /><Circle cx="12" cy="7" r="4" fill="none" stroke={stroke} strokeWidth={1.6} /></Svg>;
  }
  if (name === 'grid') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="3" y="3" width="7" height="7" fill="none" stroke={stroke} strokeWidth={1.6} /><Rect x="14" y="3" width="7" height="7" fill="none" stroke={stroke} strokeWidth={1.6} /><Rect x="14" y="14" width="7" height="7" fill="none" stroke={stroke} strokeWidth={1.6} /><Rect x="3" y="14" width="7" height="7" fill="none" stroke={stroke} strokeWidth={1.6} /></Svg>;
  }
  if (name === 'list') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Line x1="8" y1="6" x2="21" y2="6" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Line x1="8" y1="12" x2="21" y2="12" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Line x1="8" y1="18" x2="21" y2="18" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Line x1="3" y1="6" x2="3.01" y2="6" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Line x1="3" y1="12" x2="3.01" y2="12" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /><Line x1="3" y1="18" x2="3.01" y2="18" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /></Svg>;
  }
  if (name === 'folder') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /></Svg>;
  }
  if (name === 'search') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="11" cy="11" r="8" fill="none" stroke={stroke} strokeWidth={1.6} /><Line x1="21" y1="21" x2="16.65" y2="16.65" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" /></Svg>;
  }
  if (name === 'zap') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /></Svg>;
  }
  if (name === 'activity') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  }
  if (name === 'eye') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="none" stroke={stroke} strokeWidth={1.6} /><Circle cx="12" cy="12" r="3" fill="none" stroke={stroke} strokeWidth={1.6} /></Svg>;
  }
  if (name === 'share') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="18" cy="5" r="3" fill="none" stroke={stroke} strokeWidth={1.6} /><Circle cx="6" cy="12" r="3" fill="none" stroke={stroke} strokeWidth={1.6} /><Circle cx="18" cy="19" r="3" fill="none" stroke={stroke} strokeWidth={1.6} /><Line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke={stroke} strokeWidth={1.6} /><Line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke={stroke} strokeWidth={1.6} /></Svg>;
  }
  if (name === 'reports') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /><Polyline points="14 2 14 8 20 8" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" /></Svg>;
  }
  if (name === 'alerts') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  }
  if (name === 'more') {
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="1" fill={stroke} /><Circle cx="19" cy="12" r="1" fill={stroke} /><Circle cx="5" cy="12" r="1" fill={stroke} /></Svg>;
  }

  // default: back arrow
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M15 5l-7 7 7 7" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
