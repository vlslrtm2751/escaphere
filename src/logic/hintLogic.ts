import { CellWalls, Direction, HintState, HintStep, Position } from '../types/game';
import { simulateMove } from './moveLogic';

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
