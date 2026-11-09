export type Difficulty = 'easy' | 'normal' | 'hard' | 'hardcore';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type WallPair = 'top-right' | 'right-bottom' | 'bottom-left' | 'left-top';

export type Face = 'top' | 'right' | 'bottom' | 'left';

export type Position = { row: number; col: number };

export type CellWalls = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

export type Wall = {
  pos: Position;
  pair: WallPair;
};

export type HintStep = {
  direction: Direction;
  pathCells: Position[];
};

export type HintState = {
  solutionPath: Direction[];
  steps: HintStep[];
  revealedCount: number;
  usedCount: number;
};

export type UndoSnapshot = {
  playerPos: Position;
  moveCount: number;
};

/**
 * What just happened to the board. Drives sound and vibration.
 *
 * `'none'` is the one kind no action ever produces: it is what a board is born
 * with, and it carries no feedback. Everything else is a real event.
 */
export type GameEventKind = 'none' | 'moved' | 'blocked' | 'out' | 'exit' | 'undo' | 'hint';

/**
 * `seq` rises by one per event, so a listener can tell two identical events
 * apart — walking into the same wall twice has to be felt twice. A listener
 * therefore watches `seq`, not `kind`.
 *
 * A fresh board carries `{ kind: 'none', seq: 0 }`: nothing has happened on it
 * yet. The neutral kind is what makes that safe. Regenerating mid-game
 * (재생성, next stage, restart) resets `seq` to 0, which a `[seq]`-keyed
 * listener sees as a change and fires on — so the kind it then reads has to be
 * one that maps to no sound and no vibration. `seq === 0` is still worth
 * guarding on, but with `'none'` it is no longer the only thing standing
 * between a regenerated board and a spurious noise.
 */
export type GameEvent = {
  kind: GameEventKind;
  seq: number;
};

export type GameState = {
  gridSize: number;
  difficulty: Difficulty;
  stageSeed: string;
  stageNumber: number;
  grid: CellWalls[][];
  exitPos: Position;
  playerPos: Position;
  moveCount: number;
  undoRemaining: number;
  status: 'playing' | 'cleared' | 'gameover' | 'respawning';
  respawnDir: Direction | null;
  hint: HintState;
  undoStack: UndoSnapshot[];
  lastEvent: GameEvent;
};

// A clear counts toward this whenever moveCount equals the board's optimal
// solution length — regardless of hint usage. Boards draw their optimal
// length from a per-difficulty range (see DIFFICULTY_CONFIG), so this is a
// count of optimal clears, not a comparable "best" across differently-sized
// boards the way a raw move count would be.
export type ClearRecord = {
  difficulty: Difficulty;
  optimalClearCount: number;
  lastUpdated: string;
};

export type AppSettings = {
  sfxOn: boolean;
  hapticOn: boolean;
  colorBlindMode: boolean;
  theme: 'dark' | 'light';
};

export type StreakData = {
  currentStreak: number;
  bestStreak: number;
};
