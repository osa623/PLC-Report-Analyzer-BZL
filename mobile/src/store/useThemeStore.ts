import { create } from 'zustand';
import { ThemeMode, themes } from '@/theme/tokens';

type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'dark',
  setMode: (mode) => set({ mode }),
  toggleMode: () => set((state) => ({ mode: state.mode === 'dark' ? 'light' : 'dark' })),
}));

export const useAppTheme = () => {
  const mode = useThemeStore((state) => state.mode);
  return themes[mode];
};
