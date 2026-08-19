import { CellWalls, Direction, Face, GameState, Position, WallPair } from '../types/game';
import {
  DIFFICULTY_CONFIG,
  WALL_PAIR_FACES,
  DIRECTION_TO_FACE,
  OPPOSITE_FACE,
  OPPOSITE_DIR,
  DIR_DELTA,
} from '../constants/gameConfig';
import { findShortestSolution } from './pathValidator';
import { precomputeHintSteps } from './hintLogic';

// ─── Utilities ────────────────────────────────────────────────────────────────

function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  let s = Math.abs(hash) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

function initEmptyGrid(gridSize: number): CellWalls[][] {
  return Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => ({
      top: false, right: false, bottom: false, left: false,
    }))
  );
}

/**
 * Apply a WallPair (exactly two adjacent faces) to a cell.
 * Only the target cell is marked — never the neighbour — so a shared boundary
 * renders once. simulateMove checks both sides, so blocking stays symmetric.
 *
 * NEVER call this twice on the same cell: a cell must carry 0 or 2 faces.
 */
function applyWall(grid: CellWalls[][], pos: Position, pair: WallPair) {
  const [face1, face2] = WALL_PAIR_FACES[pair];
  grid[pos.row][pos.col][face1] = true;
  grid[pos.row][pos.col][face2] = true;
}

function removeWall(grid: CellWalls[][], pos: Position, pair: WallPair) {
  const [face1, face2] = WALL_PAIR_FACES[pair];
  grid[pos.row][pos.col][face1] = false;
  grid[pos.row][pos.col][face2] = false;
}

function getAllPositions(gridSize: number): Position[] {
  const positions: Position[] = [];
  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++)
      positions.push({ row: r, col: c });
  return positions;
}

function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
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

function isInBounds(pos: Position, gridSize: number): boolean {
  return pos.row >= 0 && pos.row < gridSize && pos.col >= 0 && pos.col < gridSize;
}

function isCorner(pos: Position, gridSize: number): boolean {
  const last = gridSize - 1;
  return (pos.row === 0 || pos.row === last) && (pos.col === 0 || pos.col === last);
}

function getNextPos(pos: Position, dir: Direction): Position {
  const d = DIR_DELTA[dir];
  return { row: pos.row + d.row, col: pos.col + d.col };
}

const key = (pos: Position) => `${pos.row},${pos.col}`;

/**
 * The cells the ball would travel through sliding from `pos` toward `dir`,
 * excluding `pos` itself. Empty when the ball cannot move at all.
 *
 * Every cell in this list is a place the ball *could* be made to stop by
 * putting a wall on its far face — that is what the generator exploits.
 */
function runCells(
  grid: CellWalls[][],
  pos: Position,
  dir: Direction,
  gridSize: number
): Position[] {
  const cells: Position[] = [];
  const exitFace = DIRECTION_TO_FACE[dir];
  const enterFace = OPPOSITE_FACE[exitFace];
  let cur = pos;
  while (true) {
    if (grid[cur.row][cur.col][exitFace]) break;
    const next = getNextPos(cur, dir);
    if (!isInBounds(next, gridSize)) break;
    if (grid[next.row][next.col][enterFace]) break;
    cur = next;
    cells.push(cur);
  }
  return cells;
}

const ALL_DIRS: Direction[] = ['up', 'down', 'left', 'right'];
const ALL_WALL_PAIRS: WallPair[] = ['top-right', 'right-bottom', 'bottom-left', 'left-top'];

/** The two WallPairs that contain a given face. */
const PAIRS_WITH_FACE: Record<Face, [WallPair, WallPair]> = {
  top:    ['top-right', 'left-top'],
  right:  ['top-right', 'right-bottom'],
  bottom: ['right-bottom', 'bottom-left'],
  left:   ['bottom-left', 'left-top'],
};

type AttemptResult = { grid: CellWalls[][]; exitPos: Position; solutionPath: Direction[] } | null;

// ─── Blocker-First Construction ──────────────────────────────────────────────

/**
 * Builds a map by walking a solution path and *creating* each stop.
 *
 * The key move: on an empty board every slide runs to the border, so a
 * generator that walls the cell where the ball naturally stopped only ever
 * decorates the rim and traps itself in a corner. Instead this picks a cell
 * part-way along the run and places the blocker on its far face, which makes
 * the ball halt there. Stops can therefore land anywhere on the board.
 *
 * The last slide gets no blocker — wherever it ends becomes the exit.
 *
 * Returns null when the walk dead-ends, or when the finished board turns out
 * to admit a shortcut shorter than `targetLength`. Callers simply retry with a
 * fresh seed; that is far cheaper and more reliable than patching shortcuts.
 */
function buildBlockerPath(
  gridSize: number,
  playerPos: Position,
  forbidden: Set<string>,
  rand: () => number,
  targetLength: number
): AttemptResult {
  const grid = initEmptyGrid(gridSize);
  const walled = new Set<string>();
  const visited = new Set<string>([key(playerPos)]);

  let pos = playerPos;
  let lastDir: Direction | null = null;

  for (let step = 0; step < targetLength; step++) {
    const isLast = step === targetLength - 1;

    // Turn every step: never repeat the previous axis.
    const dirs = shuffle(ALL_DIRS, rand).filter(
      d => !lastDir || (d !== lastDir && d !== OPPOSITE_DIR[lastDir])
    );

    let takenDir: Direction | null = null;

    for (const dir of dirs) {
      const run = runCells(grid, pos, dir, gridSize);
      if (run.length === 0) continue;

      if (isLast) {
        // No blocker on the final slide — the ball flies out at the far end.
        const end = run[run.length - 1];
        if (forbidden.has(key(end))) continue;
        if (isCorner(end, gridSize)) continue;
        pos = end;
        takenDir = dir;
        break;
      }

      const exitFace = DIRECTION_TO_FACE[dir];

      for (const stop of shuffle(run, rand)) {
        if (visited.has(key(stop)) || walled.has(key(stop))) continue;

        // Of the two WallPairs containing exitFace, keep one that still leaves
        // the ball somewhere new to go — otherwise the path dead-ends here.
        let placed: WallPair | null = null;
        for (const pair of shuffle(PAIRS_WITH_FACE[exitFace], rand)) {
          applyWall(grid, stop, pair);
          const hasOnwardMove = ALL_DIRS.some(nextDir => {
            if (nextDir === dir || nextDir === OPPOSITE_DIR[dir]) return false;
            const onward = runCells(grid, stop, nextDir, gridSize);
            return onward.length > 0 && !visited.has(key(onward[onward.length - 1]));
          });
          if (hasOnwardMove) { placed = pair; break; }
          removeWall(grid, stop, pair);
        }
        if (!placed) continue;

        walled.add(key(stop));
        visited.add(key(stop));
        pos = stop;
        takenDir = dir;
        break;
      }

      if (takenDir) break;
    }

    if (!takenDir) return null;
    lastDir = takenDir;
  }

  const exitPos = pos;
  const solutionPath = findShortestSolution(grid, playerPos, exitPos, gridSize);
  if (!solutionPath || solutionPath.length < targetLength) return null;

  return { grid, exitPos, solutionPath };
}

/**
 * Sprinkle extra wall pairs that are not part of the solution, so boards look
 * designed rather than sparse. Any decoy that shortens or breaks the solution
 * is rolled back immediately.
 */
function addDecoyWalls(
  grid: CellWalls[][],
  playerPos: Position,
  exitPos: Position,
  gridSize: number,
  minLength: number,
  targetWallCount: number,
  currentWallCount: number,
  rand: () => number
) {
  let budget = targetWallCount - currentWallCount;
  if (budget <= 0) return;

  const occupied = ({ row, col }: Position) => {
    const cell = grid[row][col];
    return cell.top || cell.right || cell.bottom || cell.left;
  };

  const candidates = shuffle(
    getAllPositions(gridSize).filter(
      p => !(p.row === playerPos.row && p.col === playerPos.col)
        && !(p.row === exitPos.row && p.col === exitPos.col)
    ),
    rand
  );

  for (const pos of candidates) {
    if (budget <= 0) break;
    if (occupied(pos)) continue;

    const pair = ALL_WALL_PAIRS[Math.floor(rand() * ALL_WALL_PAIRS.length)];
    applyWall(grid, pos, pair);

    const solution = findShortestSolution(grid, playerPos, exitPos, gridSize);
    if (!solution || solution.length < minLength) {
      removeWall(grid, pos, pair);
      continue;
    }
    budget--;
  }
}

// ─── Guaranteed Fallback ──────────────────────────────────────────────────────

/**
 * Simplest possible valid map: no walls, one slide straight to the exit.
 * Never fails. Only reachable if every seeded attempt above fell through,
 * which the verification script (npm run check:mapgen) asserts does not happen.
 */
function buildTrivialMap(
  gridSize: number,
  playerPos: Position,
  forbidden: Set<string>
): NonNullable<AttemptResult> {
  const grid = initEmptyGrid(gridSize);
  const last = gridSize - 1;
  for (const dir of ALL_DIRS) {
    let exit: Position;
    if (dir === 'up')         exit = { row: 0,             col: playerPos.col };
    else if (dir === 'down')  exit = { row: last,          col: playerPos.col };
    else if (dir === 'left')  exit = { row: playerPos.row, col: 0    };
    else                      exit = { row: playerPos.row, col: last };

    if (forbidden.has(key(exit))) continue;
    if (isCorner(exit, gridSize)) continue;
    return { grid, exitPos: exit, solutionPath: [dir] };
  }
  return { grid, exitPos: { row: 0, col: Math.floor(gridSize / 2) }, solutionPath: ['up'] };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Deterministic for a given (difficulty, seed, stageNumber) — the same seed
 * always rebuilds the same board, which is what `restart` relies on.
 * Only an omitted seed draws a fresh stage from the clock.
 */
export function generateMap(
  difficulty: import('../types/game').Difficulty,
  seed?: string,
  stageNumber: number = 1
): GameState {
  const { gridSize, minWalls, maxWalls, undoLimit, minSolutionLength } = DIFFICULTY_CONFIG[difficulty];
  const center = Math.floor(gridSize / 2);
  const playerPos: Position = { row: center, col: center };

  // Exit may not sit in the 3×3 spawn zone, nor on a corner.
  const forbidden = new Set<string>();
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      forbidden.add(`${center + dr},${center + dc}`);
  const last = gridSize - 1;
  forbidden.add(`0,0`);
  forbidden.add(`0,${last}`);
  forbidden.add(`${last},0`);
  forbidden.add(`${last},${last}`);

  const stageSeed = seed ?? `${difficulty}-${stageNumber}-${Date.now()}`;

  // Each attempt succeeds ~50% of the time, so 40 makes falling through to the
  // relaxed pass astronomically unlikely while costing ~1ms in the common case.
  let result: AttemptResult = null;
  let targetLength = minSolutionLength;

  for (let i = 0; i < 40 && !result; i++) {
    result = buildBlockerPath(
      gridSize, playerPos, forbidden,
      seededRandom(`${stageSeed}-bp${i}`),
      minSolutionLength
    );
  }

  // Relaxed pass — shorter but still a real puzzle.
  if (!result) {
    targetLength = Math.max(3, minSolutionLength - 3);
    for (let i = 0; i < 40 && !result; i++) {
      result = buildBlockerPath(
        gridSize, playerPos, forbidden,
        seededRandom(`${stageSeed}-relaxed${i}`),
        targetLength
      );
    }
  }

  if (!result) {
    result = buildTrivialMap(gridSize, playerPos, forbidden);
    targetLength = result.solutionPath.length;
  }

  const { grid, exitPos } = result;

  // Path walls are one per intermediate stop; top up toward the difficulty's
  // wall budget with decoys that provably do not shorten the solution.
  let wallCount = 0;
  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++)
      if (grid[r][c].top || grid[r][c].right || grid[r][c].bottom || grid[r][c].left) wallCount++;

  const decoyRand = seededRandom(`${stageSeed}-decoy`);
  addDecoyWalls(
    grid, playerPos, exitPos, gridSize,
    targetLength,
    randomBetween(minWalls, maxWalls, decoyRand),
    wallCount,
    decoyRand
  );

  // Decoys can lengthen the solution, so re-derive it for the hint system.
  const solutionPath = findShortestSolution(grid, playerPos, exitPos, gridSize) ?? result.solutionPath;
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
    respawnDir: null,
    hint: {
      solutionPath,
      steps: hintSteps,
      revealedCount: 0,
      usedCount: 0,
    },
    undoStack: [],
  };
}
