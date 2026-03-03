import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AppSettings } from '../types/game';

const DEFAULT_SETTINGS: AppSettings = {
  bgmOn: true,
  sfxOn: true,
  theme: 'dark',
  animationSpeed: 'normal',
  hapticOn: true,
  colorBlindMode: false,
};

type SettingsContextType = {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
};

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings(s => ({ ...s, ...partial }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
