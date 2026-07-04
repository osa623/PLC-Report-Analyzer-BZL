'use client';

import { createContext, useContext, ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';

// App Context for global state management
interface AppContextType {
  // Add global state here as needed
  theme?: 'light' | 'dark';
}

const AppContext = createContext<AppContextType>({});

export function useApp() {
  return useContext(AppContext);
}

// App Provider component that wraps the entire application
export function AppProvider({ children }: { children: ReactNode }) {
  const value: AppContextType = {
    theme: 'light',
  };

  return (
    <AuthProvider>
      <AppContext.Provider value={value}>{children}</AppContext.Provider>
    </AuthProvider>
  );
}
