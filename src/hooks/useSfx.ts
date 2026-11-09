import { useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { SfxKey } from '../constants/sounds';
import { playSfxSound } from '../audio/sfxPlayer';

export function useSfx() {
  const { settings } = useSettings();

  const playSfx = useCallback((key: SfxKey) => {
    if (!settings.sfxOn) return;
    playSfxSound(key);
  }, [settings.sfxOn]);

  return { playSfx };
}
