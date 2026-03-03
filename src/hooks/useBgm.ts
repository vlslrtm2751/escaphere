import { useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { useSettings } from '../context/SettingsContext';

export function useBgm() {
  const { settings, updateSettings } = useSettings();
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    // BGM would be loaded from assets; placeholder implementation
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (soundRef.current) {
      if (settings.bgmOn) {
        soundRef.current.playAsync().catch(() => {});
      } else {
        soundRef.current.pauseAsync().catch(() => {});
      }
    }
  }, [settings.bgmOn]);

  const toggleBgm = useCallback(() => {
    updateSettings({ bgmOn: !settings.bgmOn });
  }, [settings.bgmOn, updateSettings]);

  return { toggleBgm };
}
