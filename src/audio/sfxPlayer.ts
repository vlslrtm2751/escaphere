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

    // Always seek before playing, unconditionally — no `playing` check. Two
    // facts rule that out: seekTo is genuinely async on native, so play() has
    // to wait for it to land rather than firing right after it; and a player
    // whose clip already finished reports `playing: false` with its position
    // parked at the end, not at 0, so a bare play() from there replays nothing
    // and a `playing` guard would wrongly treat "finished" the same as "never
    // played" and skip the seek it still needs. Seeking first is what actually
    // moves the player out of that ended position, in all three states a
    // cached player can be in — never played, mid-clip, or finished. The
    // chain carries its own .catch() so a rejected seek (or a throw inside
    // play()) never escapes as an unhandled rejection.
    player.seekTo(0).then(() => player.play()).catch(() => {});
  } catch {
    // A missing or broken sound must never break the game — fail silently,
    // same as src/storage/asyncStorage.ts does for storage errors.
  }
}
