import { CellWalls, Direction, GameState, Position, WallPair } from '../types/game';
import {
  DIFFICULTY_CONFIG,
  WALL_PAIR_FACES,
  DIRECTION_TO_FACE,
  OPPOSITE_FACE,
  OPPOSITE_DIR,
  DIR_DELTA,
} from '../constants/gameConfig';
import { findUniqueSolution } from './pathValidator';
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

/**
 * Apply a wall pair to a cell.
 * Only sets walls on the target cell itself (NOT on the adjacent cell) to avoid
 * double-rendering at shared boundaries. simulateMove checks both sides, so
 * blocking behaviour is fully preserved.
 */
function applyWall(grid: CellWalls[][], pos: Position, pair: WallPair) {
  const [face1, face2] = WALL_PAIR_FACES[pair];
  grid[pos.row][pos.col][face1] = true;
  grid[pos.row][pos.col][face2] = true;
}

function getAllPositions(gridSize: number): Position[] {
  const positions: Position[] = [];
  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++)
      positions.push({ row: r, col: c });
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

function isInBounds(pos: Position, gridSize: number): boolean {
  return pos.row >= 0 && pos.row < gridSize && pos.col >= 0 && pos.col < gridSize;
}

function getNextPos(pos: Position, dir: Direction): Position {
  const d = DIR_DELTA[dir];
  return { row: pos.row + d.row, col: pos.col + d.col };
}

/**
 * Slide ball from `start` in `dir` using current grid walls.
 * Returns the final landing position (no exit check — used for path construction).
 */
function slideToEnd(
  grid: CellWalls[][],
  start: Position,
  dir: Direction,
  gridSize: number
): Position {
  let cur = start;
  const exitFace = DIRECTION_TO_FACE[dir];
  const enterFace = OPPOSITE_FACE[exitFace];
  while (true) {
    if (grid[cur.row][cur.col][exitFace]) return cur;
    const next = getNextPos(cur, dir);
    if (!isInBounds(next, gridSize)) return cur;
    if (grid[next.row][next.col][enterFace]) return cur;
    cur = next;
  }
}

/** Select up to `count` positions with no two 4-directionally adjacent. */
function selectNonAdjacentPositions(candidates: Position[], count: number): Position[] {
  const selected: Position[] = [];
  const blocked = new Set<string>();
  for (const pos of candidates) {
    if (selected.length >= count) break;
    if (blocked.has(`${pos.row},${pos.col}`)) continue;
    selected.push(pos);
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][])
      blocked.add(`${pos.row + dr},${pos.col + dc}`);
  }
  return selected;
}

const ALL_DIRS: Direction[] = ['up', 'down', 'left', 'right'];
const WALL_PAIRS: WallPair[] = ['top-right', 'right-bottom', 'bottom-left', 'left-top'];

type AttemptResult = { grid: CellWalls[][]; exitPos: Position; solutionPath: Direction[] } | null;

// ─── Path-First Algorithm ─────────────────────────────────────────────────────

/**
 * Builds a map by constructing the solution path first, then verifying uniqueness.
 *
 * Strategy:
 *  1. From playerPos, slide in a random direction and place a stop-wall so the ball
 *     halts there. Repeat for (minLength - 1) steps.
 *  2. The final slide has no stop-wall — the landing cell becomes the exit.
 *  3. After building the path, block direct shortcuts from each path position to any
 *     later path position (to reduce alternative routes).
 *  4. Run findUniqueSolution to confirm uniqueness and correct path length.
 */
function buildForcedPath(
  gridSize: number,
  playerPos: Position,
  forbidden: Set<string>,
  rand: () => number,
  minLength: number
): AttemptResult {
  const grid = initEmptyGrid(gridSize);
  const pathDirs: Direction[] = [];
  const pathPositions: Position[] = [playerPos];
  const visited = new Set<string>([`${playerPos.row},${playerPos.col}`]);

  let pos = playerPos;
  let lastDir: Direction | null = null;

  for (let step = 0; step < minLength; step++) {
    const isLast = step === minLength - 1;

    // Prefer perpendicular directions (avoids going back or repeating same axis)
    const shuffled: Direction[] = shuffle([...ALL_DIRS], rand);
    const reverseOfLast: Direction | null = lastDir ? OPPOSITE_DIR[lastDir] : null;
    const preferred: Direction[] = lastDir
      ? shuffled.filter(d => d !== lastDir && d !== reverseOfLast)
      : shuffled;
    const candidates: Direction[] = preferred.length > 0
      ? preferred
      : shuffled.filter(d => d !== reverseOfLast);

    let moved = false;
    for (const dir of candidates as Direction[]) {
      const slideEnd = slideToEnd(grid, pos, dir, gridSize);

      // Reject if no movement
      if (slideEnd.row === pos.row && slideEnd.col === pos.col) continue;

      // Reject if we'd revisit a position already in the path
      if (visited.has(`${slideEnd.row},${slideEnd.col}`)) continue;

      // Reject if last step and landing is in forbidden zone
      if (isLast && forbidden.has(`${slideEnd.row},${slideEnd.col}`)) continue;

      if (!isLast) {
        // Place a stop-wall so the ball halts here on future moves in this direction
        const nextPos = getNextPos(slideEnd, dir);
        if (isInBounds(nextPos, gridSize)) {
          // Not at boundary — place explicit stop-wall on slideEnd's exit face
          grid[slideEnd.row][slideEnd.col][DIRECTION_TO_FACE[dir]] = true;
        }
        // At boundary: ball stops naturally, no wall needed
      }

      pathDirs.push(dir);
      pathPositions.push(slideEnd);
      visited.add(`${slideEnd.row},${slideEnd.col}`);
      pos = slideEnd;
      lastDir = dir;
      moved = true;
      break;
    }

    if (!moved) return null; // stuck — this attempt fails
  }

  const exitPos = pos;

  // Block shortcuts: from each path position, if any other direction would slide
  // directly to a later path position (skipping steps) or to the exit, block it.
  for (let i = 0; i < pathPositions.length - 1; i++) {
    const pathPos = pathPositions[i];
    const intendedDir = pathDirs[i];
    // Positions that would represent a "shortcut" from pathPos[i]
    const shortcutTargets = new Set(
      pathPositions.slice(i + 2).map(p => `${p.row},${p.col}`)
    );
    // Also treat reaching exitPos from any non-final path position as a shortcut
    if (i < pathPositions.length - 2) {
      shortcutTargets.add(`${exitPos.row},${exitPos.col}`);
    }

    for (const dir of ALL_DIRS) {
      if (dir === intendedDir) continue;
      const slideEnd = slideToEnd(grid, pathPos, dir, gridSize);
      if (slideEnd.row === pathPos.row && slideEnd.col === pathPos.col) continue;
      if (shortcutTargets.has(`${slideEnd.row},${slideEnd.col}`)) {
        // Block this shortcut direction from pathPos
        grid[pathPos.row][pathPos.col][DIRECTION_TO_FACE[dir]] = true;
      }
    }
  }

  // Confirm uniqueness and minimum path length
  const solution = findUniqueSolution(grid, playerPos, exitPos, gridSize);
  if (solution && solution.length >= minLength) {
    return { grid, exitPos, solutionPath: solution };
  }
  return null;
}

// ─── Random Generation (fallback) ─────────────────────────────────────────────

function tryGenerateBatch(
  gridSize: number,
  playerPos: Position,
  forbidden: Set<string>,
  seedBase: string,
  startAttempt: number,
  numAttempts: number,
  minWalls: number,
  maxWalls: number,
  minSolutionLength: number,
  nonAdjacent: boolean
): AttemptResult {
  for (let i = 0; i < numAttempts; i++) {
    const rand = seededRandom(seedBase + '-r' + (startAttempt + i));

    const grid = initEmptyGrid(gridSize);
    const exitPos = pickRandomPos(gridSize, forbidden, rand);

    const wallCount = randomBetween(minWalls, maxWalls, rand);
    const wallCandidates = getAllPositions(gridSize).filter(
      p => !forbidden.has(`${p.row},${p.col}`) && !(p.row === exitPos.row && p.col === exitPos.col)
    );

    const shuffled = shuffle(wallCandidates, rand);
    const selected = nonAdjacent
      ? selectNonAdjacentPositions(shuffled, wallCount)
      : shuffled.slice(0, wallCount);

    for (const pos of selected)
      applyWall(grid, pos, WALL_PAIRS[Math.floor(rand() * WALL_PAIRS.length)]);

    const solutionPath = findUniqueSolution(grid, playerPos, exitPos, gridSize);
    if (solutionPath && solutionPath.length >= minSolutionLength)
      return { grid, exitPos, solutionPath };
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateMap(
  difficulty: import('../types/game').Difficulty,
  seed?: string,
  stageNumber: number = 1
): GameState {
  const { gridSize, minWalls, maxWalls, undoLimit, minSolutionLength } = DIFFICULTY_CONFIG[difficulty];
  const center = Math.floor(gridSize / 2);
  const playerPos: Position = { row: center, col: center };

  const forbidden = new Set<string>();
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      forbidden.add(`${center + dr},${center + dc}`);

  const stageSeed = seed ?? `${difficulty}-${stageNumber}-${Date.now()}`;

  let result: AttemptResult = null;

  // Phase 1 — Path-first (guaranteed ≥ minSolutionLength, unique)
  // Builds the solution path explicitly, then verifies uniqueness.
  if (!result) {
    for (let i = 0; i < 200 && !result; i++) {
      const rand = seededRandom(stageSeed + '-fp' + i);
      result = buildForcedPath(gridSize, playerPos, forbidden, rand, minSolutionLength);
    }
  }

  // Phase 2 — Random (non-adjacent walls, same minSolutionLength)
  if (!result) {
    result = tryGenerateBatch(
      gridSize, playerPos, forbidden, stageSeed,
      1, 600, minWalls, maxWalls, minSolutionLength, true
    );
  }

  // Phase 3 — Emergency (adjacent walls allowed, minSolutionLength still enforced)
  if (!result) {
    result = tryGenerateBatch(
      gridSize, playerPos, forbidden, stageSeed,
      601, 400, minWalls, maxWalls, minSolutionLength, false
    );
  }

  // Final fallback — should essentially never be reached
  let grid: CellWalls[][];
  let exitPos: Position;
  let solutionPath: Direction[];

  if (result) {
    ({ grid, exitPos, solutionPath } = result);
  } else {
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
