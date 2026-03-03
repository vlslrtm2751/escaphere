import { CellWalls, Direction, Position } from '../types/game';
import { simulateMove } from './moveLogic';

export function findUniqueSolution(
  grid: CellWalls[][],
  start: Position,
  exit: Position,
  gridSize: number
): Direction[] | null {
  type State = { pos: Position; path: Direction[] };
  const queue: State[] = [{ pos: start, path: [] }];
  const visited = new Set<string>();
  const solutions: Direction[][] = [];

  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;
    const key = `${pos.row},${pos.col}`;
    if (visited.has(key)) continue;
    visited.add(key);

    for (const dir of ['up', 'down', 'left', 'right'] as Direction[]) {
      const { landPos, result } = simulateMove(grid, pos, dir, gridSize, exit);

      if (result === 'exit') {
        solutions.push([...path, dir]);
        if (solutions.length > 1) return null;
      } else if (result === 'stop') {
        queue.push({ pos: landPos, path: [...path, dir] });
      }
    }
  }

  return solutions.length === 1 ? solutions[0] : null;
}
