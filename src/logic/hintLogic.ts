import { CellWalls, Direction, GameState, HintState, HintStep, Position } from '../types/game';
import { simulateMove } from './moveLogic';
import { withEvent } from './gameEvents';

export function precomputeHintSteps(
  grid: CellWalls[][],
  startPos: Position,
  solutionPath: Direction[],
  exitPos: Position,
  gridSize: number
): HintStep[] {
  const steps: HintStep[] = [];
  let cur = startPos;

  for (const direction of solutionPath) {
    const { landPos, pathCells } = simulateMove(grid, cur, direction, gridSize, exitPos);
    steps.push({ direction, pathCells });
    cur = landPos;
  }
  return steps;
}

export function revealNextHint(hint: HintState): HintState {
  if (hint.revealedCount >= hint.steps.length) return hint;
  return {
    ...hint,
    revealedCount: hint.revealedCount + 1,
    usedCount: hint.usedCount + 1,
  };
}

/**
 * Reveal one more hint step and say so. When there is nothing left to reveal
 * `revealNextHint` hands back the very hint it was given, and this returns the
 * state untouched — no event, so a dead press stays silent.
 */
export function resolveHint(state: GameState): GameState {
  const hint = revealNextHint(state.hint);
  if (hint === state.hint) return state;
  return withEvent({ ...state, hint }, 'hint');
}
