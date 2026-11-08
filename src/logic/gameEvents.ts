import { GameEventKind, GameState } from '../types/game';

/**
 * Stamp "this just happened" onto a state.
 *
 * The sequence number is what makes a repeat event observable: a player who
 * walks into the same wall three times in a row produces three 'blocked'
 * events whose kind is identical, and only the rising `seq` tells them apart.
 * A listener therefore watches `seq`, not `kind`.
 */
export function withEvent(state: GameState, kind: GameEventKind): GameState {
  return {
    ...state,
    lastEvent: { kind, seq: state.lastEvent.seq + 1 },
  };
}
