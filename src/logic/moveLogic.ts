import { CellWalls, Direction, Position } from '../types/game';
import { DIRECTION_TO_FACE, OPPOSITE_FACE, DIR_DELTA } from '../constants/gameConfig';

export function getNextPos(pos: Position, direction: Direction): Position {
  const delta = DIR_DELTA[direction];
  return { row: pos.row + delta.row, col: pos.col + delta.col };
}

export function isInBounds(pos: Position, gridSize: number): boolean {
  return pos.row >= 0 && pos.row < gridSize && pos.col >= 0 && pos.col < gridSize;
}

export function canPassBetween(
  grid: CellWalls[][],
  from: Position,
  direction: Direction
): boolean {
  const exitFace = DIRECTION_TO_FACE[direction];
  const enterFace = OPPOSITE_FACE[exitFace];
  const next = getNextPos(from, direction);

  if (grid[from.row][from.col][exitFace]) return false;
  if (grid[next.row][next.col][enterFace]) return false;

  return true;
}

export function simulateMove(
  grid: CellWalls[][],
  start: Position,
  direction: Direction,
  gridSize: number,
  exitPos: Position
): { landPos: Position; pathCells: Position[]; result: 'stop' | 'exit' | 'out' } {
  let cur = start;
  const pathCells: Position[] = [];

  while (true) {
    const next = getNextPos(cur, direction);

    if (!isInBounds(next, gridSize)) {
      return { landPos: cur, pathCells, result: 'out' };
    }

    if (!canPassBetween(grid, cur, direction)) {
      return { landPos: cur, pathCells, result: 'stop' };
    }

    cur = next;
    pathCells.push(cur);

    if (cur.row === exitPos.row && cur.col === exitPos.col) {
      return { landPos: cur, pathCells, result: 'exit' };
    }
  }
}
