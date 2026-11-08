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

/** What just happened to the board. Drives sound and vibration. */
export type GameEventKind = 'moved' | 'blocked' | 'out' | 'exit' | 'undo' | 'hint';

/**
 * `seq` rises by one per event, so a listener can tell two identical events
 * apart — walking into the same wall twice has to be felt twice. `seq: 0`
 * means nothing has happened yet on this board.
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

export type ClearRecord = {
  difficulty: Difficulty;
  bestMoveCount: number;
  lastUpdated: string;
};

export type AppSettings = {
  bgmOn: boolean;
  sfxOn: boolean;
  theme: 'dark' | 'light';
  animationSpeed: 'fast' | 'normal';
  hapticOn: boolean;
  colorBlindMode: boolean;
};

export type StreakData = {
  currentStreak: number;
  bestStreak: number;
};
