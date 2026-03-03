import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../context/SettingsContext';

export function useHaptic() {
  const { settings } = useSettings();

  const triggerMove = useCallback(() => {
    if (!settings.hapticOn) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [settings.hapticOn]);

  const triggerWall = useCallback(() => {
    if (!settings.hapticOn) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [settings.hapticOn]);

  const triggerGameover = useCallback(() => {
    if (!settings.hapticOn) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, 150);
  }, [settings.hapticOn]);

  const triggerClear = useCallback(() => {
    if (!settings.hapticOn) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [settings.hapticOn]);

  return { triggerMove, triggerWall, triggerGameover, triggerClear };
}
