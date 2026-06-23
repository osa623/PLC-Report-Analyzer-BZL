import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: string;
  name: string;
  email: string;
  organization: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (userUpdates: Partial<Omit<User, 'id'>>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,

      login: (user, token) => set({ user, token }),

      logout: () => {
        set({ user: null, token: null });
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("fdi.currentReportId");
          window.localStorage.removeItem("fdi.currentFileNames");
        }
      },

      updateUser: (userUpdates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userUpdates } : null,
        })),
    }),
    {
      name: "fdi-auth-storage",
    }
  )
);
