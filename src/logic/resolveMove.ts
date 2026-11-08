import { Direction, GameState } from '../types/game';
import { DIFFICULTY_CONFIG } from '../constants/gameConfig';
import { simulateMove } from './moveLogic';
import { pushUndo } from './undoLogic';
import { withEvent } from './gameEvents';

/**
 * Decide what one direction press does to the board.
 *
 * This used to live inside `useGameState`'s setState updater, where nothing
 * could observe it: a press into a wall returned the previous state unchanged,
 * so the screen had no way to learn the move had been refused and the player
 * got no answer at all. Here the same decision is a pure function that always
 * reports what happened, and the hook just hands its result to setState.
 */
export function resolveMove(state: GameState, direction: Direction): GameState {
  if (state.status !== 'playing') return state;

  const withUndo = pushUndo(state);
  const { landPos, result } = simulateMove(
    state.grid,
    state.playerPos,
    direction,
    state.gridSize,
    state.exitPos
  );

  if (result === 'out') {
    // Enter 'respawning' state — PlayerOrb plays the fly-out animation, then
    // calls completeRespawn() to reset to center. No undo snapshot: the
    // respawn wipes the stack anyway.
    return withEvent(
      {
        ...state,
        playerPos: landPos,    // stay at edge for the fly-out animation
        status: 'respawning',
        respawnDir: direction, // tells PlayerOrb which way to animate
      },
      'out'
    );
  }

  if (result === 'exit') {
    return withEvent(
      { ...withUndo, playerPos: landPos, status: 'cleared', moveCount: state.moveCount + 1 },
      'exit'
    );
  }

  // Only 'stop' can reach here, and a stop that never left the starting cell
  // is a blocked move: a wall was in the way. The state must not change — no
  // move was spent, nothing to undo — but the event still has to fire, which
  // is the whole reason this function exists. 'blocked' is decided here rather
  // than inside simulateMove on purpose; simulateMove's three results are
  // consumed by untyped scripts that compare against them directly.
  if (landPos.row === state.playerPos.row && landPos.col === state.playerPos.col) {
    return withEvent(state, 'blocked');
  }

  return withEvent({ ...withUndo, playerPos: landPos, moveCount: state.moveCount + 1 }, 'moved');
}

/**
 * Finish a fly-out: put the ball back in the middle and start the board over.
 * Called once PlayerOrb's animation ends. No event — 'out' already fired when
 * the ball left the grid, and the landing is the same beat.
 */
export function resolveRespawn(state: GameState): GameState {
  if (state.status !== 'respawning') return state;

  const center = Math.floor(state.gridSize / 2);
  const { undoLimit } = DIFFICULTY_CONFIG[state.difficulty];
  return {
    ...state,
    playerPos: { row: center, col: center },
    moveCount: 0,
    undoStack: [],
    undoRemaining: undoLimit,
    status: 'playing',
    respawnDir: null,
  };
}
