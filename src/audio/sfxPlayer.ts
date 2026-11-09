import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import { SfxKey } from '../constants/sounds';
import { SFX_ASSETS } from './sfxAssets';

// Players are created lazily, per key, on first play — not eagerly at module
// import. Eager creation would load every sound (including ones that have no
// file yet) the moment this module is imported, which is riskier on web and
// wasted work for sounds nothing ever plays.
const players = new Map<SfxKey, AudioPlayer>();

export function playSfxSound(key: SfxKey): void {
  try {
    const source = SFX_ASSETS[key];
    if (!source) return;

    let player = players.get(key);
    if (!player) {
      player = createAudioPlayer(source);
      players.set(key, player);
    }

    // seekTo(0) then play() so a short effect restarts from the beginning on
    // every press, rather than overlapping itself mid-clip on rapid presses.
    // seekTo resolves asynchronously; the rejection is swallowed here since
    // the try/catch below only covers synchronous throws.
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // A missing or broken sound must never break the game — fail silently,
    // same as src/storage/asyncStorage.ts does for storage errors.
  }
}
