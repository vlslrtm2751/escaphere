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

    // A repeat press should restart the clip from 0, not overlap it. If the
    // player is idle, play() alone already starts at 0. If it's mid-clip,
    // play() has to wait for the seek to actually land first: seekTo is a
    // genuinely async operation on native (its type is Promise<void>, unlike
    // the plain synchronous `playing`/`volume`/`loop` properties) even though
    // its web implementation happens to run synchronously under the hood.
    // Guarding on `playing` keeps the common (idle) press fully synchronous —
    // feedback stays immediate — and only pays the promise-chain cost on the
    // actual restart path, which carries its own .catch() so a rejected seek
    // never escapes as an unhandled rejection.
    if (player.playing) {
      // Mid-clip: restart from the top. seekTo is genuinely async on native, so
      // play() has to wait for it or the restart may not land.
      player.seekTo(0).then(() => player.play()).catch(() => {});
    } else {
      player.play();
    }
  } catch {
    // A missing or broken sound must never break the game — fail silently,
    // same as src/storage/asyncStorage.ts does for storage errors.
  }
}
