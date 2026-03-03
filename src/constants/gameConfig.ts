import { Difficulty, Direction, Face, WallPair, Position } from '../types/game';

export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { gridSize: number; minWalls: number; maxWalls: number; undoLimit: number; minSolutionLength: number }
> = {
  easy:   { gridSize: 7,  minWalls: 4,  maxWalls: 7,  undoLimit: 5, minSolutionLength: 5 },
  normal: { gridSize: 9,  minWalls: 8,  maxWalls: 13, undoLimit: 3, minSolutionLength: 7 },
  hard:   { gridSize: 11, minWalls: 14, maxWalls: 22, undoLimit: 1, minSolutionLength: 10 },
};

export const DIRECTION_TO_FACE: Record<Direction, Face> = {
  up: 'top', down: 'bottom', left: 'left', right: 'right',
};

export const OPPOSITE_FACE: Record<Face, Face> = {
  top: 'bottom', bottom: 'top', left: 'right', right: 'left',
};

export const OPPOSITE_DIR: Record<Direction, Direction> = {
  up: 'down', down: 'up', left: 'right', right: 'left',
};

export const DIR_DELTA: Record<Direction, Position> = {
  up:    { row: -1, col: 0 },
  down:  { row:  1, col: 0 },
  left:  { row:  0, col: -1 },
  right: { row:  0, col:  1 },
};

export const WALL_PAIR_FACES: Record<WallPair, [Face, Face]> = {
  'top-right':    ['top',    'right'],
  'right-bottom': ['right',  'bottom'],
  'bottom-left':  ['bottom', 'left'],
  'left-top':     ['left',   'top'],
};
