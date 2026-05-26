import React, { createContext, useContext, useState, useCallback } from 'react';

const CreditContext = createContext();

const STORAGE_KEY = 'pdf_extractor_credits';
const DEFAULT_FREE_CREDITS = 2;

function loadCredits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEFAULT_FREE_CREDITS;
}

function persistCredits(n) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(n));
}

export default function CreditProvider({ children }) {
  const [credits, setCreditsState] = useState(loadCredits);

  const setCredits = useCallback((n) => {
    setCreditsState(n);
    persistCredits(n);
  }, []);

  /** Deduct 1 credit. Returns true if successful, false if insufficient. */
  const useCredit = useCallback(() => {
    const current = loadCredits();
    if (current <= 0) return false;
    const next = current - 1;
    setCredits(next);
    return true;
  }, [setCredits]);

  /** Add credits (after purchase). */
  const addCredits = useCallback((amount) => {
    const current = loadCredits();
    setCredits(current + amount);
  }, [setCredits]);

  /** Reset to free tier (e.g. on logout). */
  const resetCredits = useCallback(() => {
    setCredits(DEFAULT_FREE_CREDITS);
  }, [setCredits]);

  return (
    <CreditContext.Provider value={{ credits, useCredit, addCredits, resetCredits }}>
      {children}
    </CreditContext.Provider>
  );
}

export const useCredits = () => useContext(CreditContext);
