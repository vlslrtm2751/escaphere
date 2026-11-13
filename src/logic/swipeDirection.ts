import { Direction } from '../types/game';

/**
 * Resolves a pan gesture's translation into one of the four move directions.
 * Whichever axis moved further decides it; a tie (rare -- an exact diagonal)
 * falls to vertical. Shared by every swipe-sensitive zone (the board itself,
 * the side margins on a wide screen) so they can't disagree on what a given
 * drag means.
 */
export function swipeDirection(translationX: number, translationY: number): Direction {
  return Math.abs(translationX) > Math.abs(translationY)
    ? (translationX > 0 ? 'right' : 'left')
    : (translationY > 0 ? 'down' : 'up');
}
