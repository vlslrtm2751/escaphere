import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppSettings } from '../types/game';
import { DEFAULT_SETTINGS } from '../logic/settings';
import { loadSettings, saveSettings } from '../storage/asyncStorage';

type SettingsContextType = {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  hydrated: boolean;
};

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  // Default context value is used only outside a provider; hydrated stays
  // true there so a screen rendered without a SettingsProvider is never
  // permanently gated.
  hydrated: true,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await loadSettings();
        setSettings(loaded);
      } finally {
        // Runs whether the read above succeeded, returned defaults, or threw --
        // the hydration gate must open either way, never stay closed forever.
        setHydrated(true);
      }
    })();
  }, []);

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings(s => {
      const next = { ...s, ...partial };
      saveSettings(next);
      return next;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, hydrated }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
