import { CellWalls, Direction, GameState, Position, WallPair } from '../types/game';
import { DIFFICULTY_CONFIG, WALL_PAIR_FACES, OPPOSITE_FACE } from '../constants/gameConfig';
import { findUniqueSolution } from './pathValidator';
import { precomputeHintSteps } from './hintLogic';

function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  let s = Math.abs(hash) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function initEmptyGrid(gridSize: number): CellWalls[][] {
  return Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => ({
      top: false, right: false, bottom: false, left: false,
    }))
  );
}

function applyWall(grid: CellWalls[][], pos: Position, pair: WallPair, gridSize: number) {
  const [face1, face2] = WALL_PAIR_FACES[pair];
  grid[pos.row][pos.col][face1] = true;

  const oppFace = OPPOSITE_FACE[face2];

  // Find the adjacent cell in the direction corresponding to face2
  const adjacentDir = (() => {
    if (face2 === 'top') return { row: -1, col: 0 };
    if (face2 === 'bottom') return { row: 1, col: 0 };
    if (face2 === 'left') return { row: 0, col: -1 };
    return { row: 0, col: 1 };
  })();

  const adjRow = pos.row + adjacentDir.row;
  const adjCol = pos.col + adjacentDir.col;

  grid[pos.row][pos.col][face2] = true;
  if (adjRow >= 0 && adjRow < gridSize && adjCol >= 0 && adjCol < gridSize) {
    grid[adjRow][adjCol][oppFace] = true;
  }
}

function getAllPositions(gridSize: number): Position[] {
  const positions: Position[] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      positions.push({ row: r, col: c });
    }
  }
  return positions;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomBetween(min: number, max: number, rand: () => number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function pickRandomPos(gridSize: number, forbidden: Set<string>, rand: () => number): Position {
  const all = getAllPositions(gridSize).filter(p => !forbidden.has(`${p.row},${p.col}`));
  return all[Math.floor(rand() * all.length)];
}

const WALL_PAIRS: WallPair[] = ['top-right', 'right-bottom', 'bottom-left', 'left-top'];

function pickRandomWallPair(rand: () => number): WallPair {
  return WALL_PAIRS[Math.floor(rand() * WALL_PAIRS.length)];
}

export function generateMap(
  difficulty: import('../types/game').Difficulty,
  seed?: string,
  stageNumber: number = 1
): GameState {
  const { gridSize, minWalls, maxWalls, undoLimit } = DIFFICULTY_CONFIG[difficulty];
  const center = Math.floor(gridSize / 2);
  const playerPos: Position = { row: center, col: center };

  const forbidden = new Set<string>();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      forbidden.add(`${center + dr},${center + dc}`);
    }
  }

  const stageSeed = seed ?? `${difficulty}-${stageNumber}-${Date.now()}`;
  let rand = seededRandom(stageSeed);

  let grid: CellWalls[][];
  let exitPos: Position;
  let solutionPath: Direction[];
  let attempts = 0;

  do {
    attempts++;
    rand = seededRandom(stageSeed + '-' + attempts);

    grid = initEmptyGrid(gridSize);
    exitPos = pickRandomPos(gridSize, forbidden, rand);

    const wallCount = randomBetween(minWalls, maxWalls, rand);
    const wallCandidates = getAllPositions(gridSize).filter(
      p => !forbidden.has(`${p.row},${p.col}`) && !(p.row === exitPos.row && p.col === exitPos.col)
    );

    const selected = shuffle(wallCandidates, rand).slice(0, wallCount);
    for (const pos of selected) {
      const pair = pickRandomWallPair(rand);
      applyWall(grid, pos, pair, gridSize);
    }

    const result = findUniqueSolution(grid, playerPos, exitPos, gridSize);
    solutionPath = result!;
  } while (solutionPath === null && attempts < 200);

  if (!solutionPath) {
    // fallback: generate a trivially solvable map
    grid = initEmptyGrid(gridSize);
    exitPos = { row: 0, col: center };
    solutionPath = ['up'];
  }

  const hintSteps = precomputeHintSteps(grid, playerPos, solutionPath, exitPos, gridSize);

  return {
    gridSize,
    difficulty,
    stageSeed,
    stageNumber,
    grid,
    exitPos,
    playerPos,
    moveCount: 0,
    undoRemaining: undoLimit,
    status: 'playing',
    hint: {
      solutionPath,
      steps: hintSteps,
      revealedCount: 0,
      usedCount: 0,
    },
    undoStack: [],
  };
}
