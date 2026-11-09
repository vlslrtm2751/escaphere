import { AudioSource } from 'expo-audio';
import { SfxKey } from '../constants/sounds';

// Every key starts out `null` because no sound file exists yet — the user is
// still preparing them. When a file is added under assets/sounds/, swap that
// key's value for a require() of it, e.g.:
//   move: require('../../assets/sounds/move.wav'),
// require() is used (not import) because there is no module declaration for
// .wav/.mp3, so `import` fails `tsc --noEmit`.
//
// The Record<SfxKey, ...> type forces every key to be listed here — leaving
// one out fails the compiler instead of failing silently at runtime.
export const SFX_ASSETS: Record<SfxKey, AudioSource | null> = {
  move:  null,
  wall:  null,
  out:   null,
  clear: null,
  hint:  null,
  undo:  null,
};
