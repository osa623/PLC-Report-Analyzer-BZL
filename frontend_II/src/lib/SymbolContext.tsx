"use client";

import { createContext, useContext, type ReactNode } from "react";

interface SymbolContextValue {
  symbol: string;
  companyName: string;
}

// Allow undefined so we can detect misuse
const SymbolContext = createContext<SymbolContextValue | undefined>(undefined);

/** Hook — use inside any Client Component to read the active stock symbol */
export function useSymbol(): SymbolContextValue {
  const context = useContext(SymbolContext);

  if (!context) {
    throw new Error("useSymbol must be used within a SymbolProvider");
  }

  return context;
}

/** Client wrapper used by Server Component pages to pass the symbol into the tree */
export function SymbolProvider({
  symbol,
  companyName = "",
  children,
}: {
  symbol: string;
  companyName?: string;
  children: ReactNode;
}) {
  return (
    <SymbolContext.Provider value={{ symbol, companyName }}>
      {children}
    </SymbolContext.Provider>
  );
}