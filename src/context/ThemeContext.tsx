import React, { createContext, useContext, ReactNode } from 'react';
import { DARK_THEME, LIGHT_THEME, Theme } from '../constants/theme';
import { useSettings } from './SettingsContext';

type ThemeMode = 'dark' | 'light';

type ThemeContextType = {
  mode: ThemeMode;
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  theme: DARK_THEME,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings();
  const mode = settings.theme;

  const toggleTheme = () => {
    updateSettings({ theme: mode === 'dark' ? 'light' : 'dark' });
  };

  const theme = mode === 'dark' ? DARK_THEME : LIGHT_THEME;

  return (
    <ThemeContext.Provider value={{ mode, theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
