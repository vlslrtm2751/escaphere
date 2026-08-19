import { CellWalls, Direction, Position } from '../types/game';
import { simulateMove } from './moveLogic';

/**
 * BFS to find the shortest solution path (fewest moves) from start to exit.
 * Returns the path if one exists, or null if the puzzle is unsolvable.
 *
 * Multiple solution paths are allowed — what matters is that the shortest
 * one satisfies the minimum length requirement checked by the caller.
 */
export function findShortestSolution(
  grid: CellWalls[][],
  start: Position,
  exit: Position,
  gridSize: number
): Direction[] | null {
  type State = { pos: Position; path: Direction[] };
  const queue: State[] = [{ pos: start, path: [] }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;
    const key = `${pos.row},${pos.col}`;
    if (visited.has(key)) continue;
    visited.add(key);

    for (const dir of ['up', 'down', 'left', 'right'] as Direction[]) {
      const { landPos, result } = simulateMove(grid, pos, dir, gridSize, exit);

      if (result === 'exit') {
        return [...path, dir]; // BFS guarantees this is the shortest solution
      } else if (result === 'stop') {
        queue.push({ pos: landPos, path: [...path, dir] });
      }
    }
  }

  return null; // no solution exists
}
