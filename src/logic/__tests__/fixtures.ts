import { CellWalls, GameState } from '../../types/game';

export function emptyGrid(size: number): CellWalls[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({
      top: false,
      right: false,
      bottom: false,
      left: false,
    }))
  );
}

export function makeState(overrides: Partial<GameState> = {}): GameState {
  const gridSize = 7;
  return {
    gridSize,
    difficulty: 'easy',
    stageSeed: 'test-seed',
    stageNumber: 1,
    grid: emptyGrid(gridSize),
    exitPos: { row: 6, col: 6 },
    playerPos: { row: 3, col: 3 },
    moveCount: 0,
    undoRemaining: 5,
    status: 'playing',
    respawnDir: null,
    hint: {
      solutionPath: [],
      steps: [],
      revealedCount: 0,
      usedCount: 0,
    },
    undoStack: [],
    lastEvent: { kind: 'none', seq: 0 },
    ...overrides,
  };
}
