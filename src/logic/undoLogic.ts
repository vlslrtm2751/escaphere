import { GameState } from '../types/game';

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
  if (state.undoStack.length === 0) return state;
  const prev = state.undoStack[state.undoStack.length - 1];
  return {
    ...state,
    playerPos: prev.playerPos,
    moveCount: prev.moveCount,
    undoStack: state.undoStack.slice(0, -1),
    undoRemaining: state.undoRemaining - 1,
  };
}
