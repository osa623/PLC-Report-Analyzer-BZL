// App Routes Configuration
// This file defines all available routes in the application

export const routes = {
  home: {
    path: '/',
    name: 'Home',
    description: 'Home page',
  },
  dashboard: {
    path: '/dashboard',
    name: 'Dashboard',
    description: 'Stock analysis dashboard',
  },
  stock: {
    path: '/stockpage',
    name: 'Stock Fundamentals',
    description: 'Stock fundamentals analysis',
  },
  Sectors: {
    path: '/sector_page',
    name: 'Sectors',
    description: 'Sectors',
  },
  landingPage: {
    path: '/about',
    name: 'About',
    description: 'About the platform',
  },

  watchlist: {
    path: '/watchlist',
    name: 'Watchlist',
    description: 'Favorite stocks watchlist',
  },

  portfolio: {
    path: '/portfolio',
    name: 'portfolio',
    description: 'User portfolio',
  },

  marketData: {
    path: '/market-data',
    name: 'Market Data',
    description: 'Live CSE market data, trades, sectors & announcements',
  },

  login: {
    path: '/welcome-page/login-page',
    name: 'Login',
    description: 'Login to your account',
  },
  register: {
    path: '/welcome-page/register-page',
    name: 'Register',
    description: 'Register a new account',
  },
} as const;

// Navigation items for the header
export const navigationItems = [
  {
    label: 'Home',
    href: routes.home.path,
  },
  {
    label: 'Dashboard',
    href: routes.dashboard.path,
  },
  {
    label: 'Stock',
    href: routes.stock.path,
  },
  {
    label: 'Sectors',
    href: routes.Sectors.path,
  },
  {
    label: 'Watchlist',
    href: routes.watchlist.path,
  },
  {
    label: 'Portfolio',
    href: routes.portfolio.path,
  }


];

// Helper to get route by key
export function getRoute(key: keyof typeof routes) {
  return routes[key];
}
