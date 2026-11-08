import { GameState } from '../types/game';
import { withEvent } from './gameEvents';

export function pushUndo(state: GameState): GameState {
  if (state.undoRemaining <= 0) return state;
  return {
    ...state,
    undoStack: [
      ...state.undoStack,
      {
        playerPos: state.playerPos,
        moveCount: state.moveCount,
      },
    ],
  };
}

export function applyUndo(state: GameState): GameState {
  // Both guards return the state untouched — event included. A refused undo
  // is not an undo, so nothing should sound.
  if (state.undoRemaining <= 0) return state;
  if (state.undoStack.length === 0) return state;
  const prev = state.undoStack[state.undoStack.length - 1];
  return withEvent(
    {
      ...state,
      playerPos: prev.playerPos,
      moveCount: prev.moveCount,
      undoStack: state.undoStack.slice(0, -1),
      undoRemaining: state.undoRemaining - 1,
    },
    'undo'
  );
}
