import { AppSettings } from '../types/game';

/**
 * sfxOn/hapticOn default on, colorBlindMode off, theme dark.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  sfxOn: true,
  hapticOn: true,
  colorBlindMode: false,
  theme: 'dark',
};

/**
 * Turns whatever `JSON.parse` of arbitrary stored text produced into a valid
 * `AppSettings`. `raw` may be `null` (nothing stored / a failed read), a
 * stale shape from an older build (`bgmOn`, `animationSpeed`), a wrong-typed
 * field, or not even an object (a stray string, number, or array).
 *
 * The result is built field-by-field from `DEFAULT_SETTINGS` rather than by
 * spreading `raw` — that is what makes unknown keys fall away on their own
 * and keeps this function from ever throwing or returning `undefined`, no
 * matter what garbage comes in.
 */
export function mergeSettings(raw: unknown): AppSettings {
  const input: Record<string, unknown> =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    sfxOn: typeof input.sfxOn === 'boolean' ? input.sfxOn : DEFAULT_SETTINGS.sfxOn,
    hapticOn: typeof input.hapticOn === 'boolean' ? input.hapticOn : DEFAULT_SETTINGS.hapticOn,
    colorBlindMode:
      typeof input.colorBlindMode === 'boolean'
        ? input.colorBlindMode
        : DEFAULT_SETTINGS.colorBlindMode,
    theme: input.theme === 'dark' || input.theme === 'light' ? input.theme : DEFAULT_SETTINGS.theme,
  };
}
