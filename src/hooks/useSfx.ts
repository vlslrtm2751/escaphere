import { useCallback } from 'react';
import { Audio } from 'expo-av';
import { useSettings } from '../context/SettingsContext';
import { SfxKey } from '../constants/sounds';

const SFX_MAP: Record<SfxKey, any> = {
  move:     null,
  wall:     null,
  gameover: null,
  clear:    null,
  hint:     null,
  undo:     null,
};

export function useSfx() {
  const { settings } = useSettings();

  const playSfx = useCallback(async (key: SfxKey) => {
    if (!settings.sfxOn) return;
    // Sound files would be loaded from assets; placeholder implementation
    const source = SFX_MAP[key];
    if (!source) return;
    try {
      const { sound } = await Audio.Sound.createAsync(source);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch {}
  }, [settings.sfxOn]);

  return { playSfx };
}
