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
import { simulateMove } from './moveLogic';
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

type Board = {
  grid: CellWalls[][];
  exitPos: Position;
  solutionPath: Direction[];
  /** Every cell the ball stops on along the solution, starting at the spawn. */
  pathCells: Position[];
  /** Cells already carrying a WallPair — a cell may never carry two. */
  walled: Set<string>;
};
type AttemptResult = Board | null;

/** A wrong turn must stay alive at least this many stops to be a real decoy. */
const MIN_BRANCH_CELLS = 3;

/** Reachable stop cells that must sit off the solution, so there is something to rule out. */
const MIN_OFFPATH_CELLS = 3;

type Move = { dir: Direction; exit: boolean; landPos: Position };

/** The moves a player would actually consider: ones that land somewhere, or exit. */
function moveOptions(
  grid: CellWalls[][],
  pos: Position,
  gridSize: number,
  exitPos: Position
): Move[] {
  const moves: Move[] = [];
  for (const dir of ALL_DIRS) {
    const { landPos, result } = simulateMove(grid, pos, dir, gridSize, exitPos);
    if (result === 'exit') moves.push({ dir, exit: true, landPos });
    else if (result === 'stop' && (landPos.row !== pos.row || landPos.col !== pos.col))
      moves.push({ dir, exit: false, landPos });
  }
  return moves;
}

/**
 * Walks from the spawn always taking the only move available, never turning
 * back. If the exit arrives that way the board asked the player to decide
 * nothing — which is the failure this generator exists to avoid.
 */
function solvableWithoutChoosing(
  grid: CellWalls[][],
  start: Position,
  gridSize: number,
  exitPos: Position
): boolean {
  let pos = start;
  let prev: Direction | null = null;
  for (let guard = 0; guard < 100; guard++) {
    const opts = moveOptions(grid, pos, gridSize, exitPos)
      .filter(o => !prev || o.dir !== OPPOSITE_DIR[prev]);
    if (opts.some(o => o.exit)) return true;
    if (opts.length !== 1) return false;
    pos = opts[0].landPos;
    prev = opts[0].dir;
  }
  return false;
}

/** Stop cells reachable from `from`, itself included. */
function territoryFrom(
  grid: CellWalls[][],
  from: Position,
  gridSize: number,
  exitPos: Position
): number {
  const seen = new Set([key(from)]);
  const queue: Position[] = [from];
  while (queue.length) {
    for (const o of moveOptions(grid, queue.shift()!, gridSize, exitPos)) {
      if (o.exit) continue;
      if (seen.has(key(o.landPos))) continue;
      seen.add(key(o.landPos));
      queue.push(o.landPos);
    }
  }
  return seen.size;
}

/** Reachable stop cells that are NOT on the solution — the territory to rule out. */
function offPathCells(board: Board, gridSize: number, playerPos: Position): number {
  const { grid, exitPos } = board;
  const onPath = new Set([key(playerPos)]);
  let cur = playerPos;
  for (const dir of board.solutionPath) {
    const { landPos, result } = simulateMove(grid, cur, dir, gridSize, exitPos);
    if (result === 'exit') break;
    cur = landPos;
    onPath.add(key(cur));
  }

  const seen = new Set([key(playerPos)]);
  const queue: Position[] = [playerPos];
  while (queue.length) {
    for (const o of moveOptions(grid, queue.shift()!, gridSize, exitPos)) {
      if (o.exit || seen.has(key(o.landPos))) continue;
      seen.add(key(o.landPos));
      queue.push(o.landPos);
    }
  }

  let off = 0;
  for (const k of seen) if (!onPath.has(k)) off++;
  return off;
}

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
  const pathCells: Position[] = [playerPos];

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
        pathCells.push(stop);
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

  return { grid, exitPos, solutionPath, pathCells, walled };
}

/**
 * Grafts one decoy branch onto `anchor`, heading `dir` — a short chain of stops
 * built the same blocker-first way as the solution.
 *
 * Scattering loose walls does not work: a wall the ball can never reach adds no
 * choice, which is why boards used to be corridors. A branch has to be *walked
 * into*, so it is grown move by move from a cell the player already visits.
 *
 * The whole branch is rolled back unless it leaves the board strictly better:
 * no shortcut to the exit, and no cell whose every move flies off the grid.
 * That last one matters because sliding back the way you came does not return
 * you to where you were — the cells behind you are empty, so you keep going.
 * A branch tip with no landing move is a forced respawn, not a puzzle.
 *
 * Returns the branch's stop cells, or null if it was rejected.
 */
function graftBranch(
  grid: CellWalls[][],
  anchor: Position,
  dir: Direction,
  gridSize: number,
  playerPos: Position,
  exitPos: Position,
  walled: Set<string>,
  minLength: number,
  maxStops: number,
  rand: () => number
): Position[] | null {
  const placed: { pos: Position; pair: WallPair }[] = [];
  const cells: Position[] = [];

  const rollback = () => {
    for (const p of placed) {
      removeWall(grid, p.pos, p.pair);
      walled.delete(key(p.pos));
    }
  };

  let pos = anchor;
  let heading: Direction | null = dir;
  const stops = 3 + Math.floor(rand() * Math.max(1, maxStops - 2));

  for (let i = 0; i < stops; i++) {
    if (!heading) break;
    const travelled: Direction = heading;

    const run = runCells(grid, pos, travelled, gridSize);
    if (run.length === 0) break;

    const exitFace = DIRECTION_TO_FACE[travelled];
    let advanced = false;

    for (const stop of shuffle(run, rand)) {
      if (walled.has(key(stop))) continue;
      if (stop.row === exitPos.row && stop.col === exitPos.col) continue;
      if (stop.row === playerPos.row && stop.col === playerPos.col) continue;

      // Both pairs stop the ball here; keep one that still leaves a way onward,
      // since a pair also blocks one of the two perpendicular directions.
      for (const pair of shuffle(PAIRS_WITH_FACE[exitFace], rand)) {
        applyWall(grid, stop, pair);
        const onward: Direction | undefined = shuffle(
          ALL_DIRS.filter(d => d !== travelled && d !== OPPOSITE_DIR[travelled]),
          rand
        ).find(d => runCells(grid, stop, d, gridSize).length > 0);

        if (onward || i === stops - 1) {
          walled.add(key(stop));
          placed.push({ pos: stop, pair });
          cells.push(stop);
          pos = stop;
          heading = onward ?? null;
          advanced = true;
          break;
        }
        removeWall(grid, stop, pair);
      }
      if (advanced) break;
    }
    if (!advanced) break;
  }

  // Fewer than three stops and a wrong turn dies before the player has had to
  // commit to it, which is the whole point of the branch.
  if (cells.length < 3) { rollback(); return null; }

  for (const cell of cells) {
    if (moveOptions(grid, cell, gridSize, exitPos).length === 0) { rollback(); return null; }
  }

  const solution = findShortestSolution(grid, playerPos, exitPos, gridSize);
  if (!solution || solution.length < minLength) { rollback(); return null; }

  return cells;
}

/**
 * Grows decoy branches until the board offers real choices, starting at the
 * spawn — that is where "there is only one way to go" is most obvious, and
 * where a wrong option has to look just as plausible as the right one.
 */
function growBranches(
  board: Board,
  gridSize: number,
  playerPos: Position,
  minLength: number,
  minStartOptions: number,
  wallBudget: number,
  rand: () => number
) {
  const { grid, exitPos, walled, pathCells } = board;
  const solutionFirst = board.solutionPath[0];

  // The spawn comes first and is retried until it has enough ways out; the rest
  // of the path is then swept repeatedly, because one branch per cell is not
  // enough to lift the average number of choices along the whole solution.
  const anchors: Position[] = [playerPos, ...shuffle(pathCells.slice(1), rand)];

  for (let pass = 0; pass < 3; pass++) {
    // Snapshot: later passes branch off branches too, which is what turns a few
    // stubs into territory the player has to actually rule out.
    for (const anchor of [...anchors]) {
      if (walled.size >= wallBudget) return;

      const atSpawn = anchor.row === playerPos.row && anchor.col === playerPos.col;
      const open = moveOptions(grid, anchor, gridSize, exitPos);
      if (atSpawn && open.length >= minStartOptions && pass > 0) continue;

      // Only directions the ball can actually travel but currently flies off
      // the board are worth branching into: that is where a blocker turns a
      // lost move into a choice. A direction blocked by this cell's own wall
      // has nowhere to put one without dismantling the solution.
      const taken = new Set(open.map(o => o.dir));
      const candidates = shuffle(
        ALL_DIRS.filter(d =>
          !taken.has(d) &&
          !(atSpawn && d === solutionFirst) &&
          runCells(grid, anchor, d, gridSize).length > 0
        ),
        rand
      );

      for (const d of candidates) {
        if (walled.size >= wallBudget) return;
        const branch = graftBranch(grid, anchor, d, gridSize, playerPos, exitPos, walled, minLength, 4, rand);
        if (branch) { anchors.push(...branch); break; }
      }
    }
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
    return { grid, exitPos: exit, solutionPath: [dir], pathCells: [playerPos], walled: new Set() };
  }
  return {
    grid,
    exitPos: { row: 0, col: Math.floor(gridSize / 2) },
    solutionPath: ['up'],
    pathCells: [playerPos],
    walled: new Set(),
  };
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
  const { gridSize, minWalls, maxWalls, undoLimit, minSolutionLength, maxSolutionLength, minStartOptions } =
    DIFFICULTY_CONFIG[difficulty];
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

  /**
   * One full attempt: lay a solution path, then grow decoy branches until the
   * board asks the player to choose. A board that still reads as a corridor is
   * thrown away rather than patched — the same reject-and-retry the path itself
   * uses.
   */
  const attempt = (tag: string, i: number, targetLen: number): AttemptResult => {
    const rand = seededRandom(`${stageSeed}-${tag}${i}`);
    const board = buildBlockerPath(gridSize, playerPos, forbidden, rand, targetLen);
    if (!board) return null;

    growBranches(
      board, gridSize, playerPos, targetLen, minStartOptions,
      randomBetween(minWalls, maxWalls, rand), rand
    );

    // Branches change the shortest route, so re-derive it before judging which
    // opening is the "right" one.
    const solution = findShortestSolution(board.grid, playerPos, board.exitPos, gridSize);
    if (!solution || solution.length < targetLen) return null;
    board.solutionPath = solution;

    const starts = moveOptions(board.grid, playerPos, gridSize, board.exitPos);
    if (starts.length < minStartOptions) return null;
    if (solvableWithoutChoosing(board.grid, playerPos, gridSize, board.exitPos)) return null;

    // A wrong opening has to look as plausible as the right one: if it dies on
    // the next keypress the player has learned the answer for free.
    for (const s of starts) {
      if (s.exit || s.dir === solution[0]) continue;
      if (territoryFrom(board.grid, s.landPos, gridSize, board.exitPos) < MIN_BRANCH_CELLS) return null;
    }

    // There must be somewhere wrong to go, or there is nothing to rule out.
    if (offPathCells(board, gridSize, playerPos) < MIN_OFFPATH_CELLS) return null;

    return board;
  };

  // Each board draws its own target length, so boards of one difficulty are not
  // all the same size.
  let targetLength = randomBetween(
    minSolutionLength, maxSolutionLength, seededRandom(`${stageSeed}-len`)
  );

  // Branching narrows acceptance considerably, so this pass gets more tries
  // than path construction alone needed.
  let result: AttemptResult = null;
  for (let i = 0; i < 120 && !result; i++) result = attempt('bp', i, targetLength);

  // The drawn target may be more than this seed can fit; fall back to the
  // difficulty's floor before giving up on a proper board.
  if (!result && targetLength > minSolutionLength) {
    targetLength = minSolutionLength;
    for (let i = 0; i < 120 && !result; i++) result = attempt('floor', i, targetLength);
  }

  // Relaxed pass — shorter but still a real puzzle.
  if (!result) {
    targetLength = Math.max(3, minSolutionLength - 3);
    for (let i = 0; i < 120 && !result; i++) result = attempt('relaxed', i, targetLength);
  }

  if (!result) {
    result = buildTrivialMap(gridSize, playerPos, forbidden);
    targetLength = result.solutionPath.length;
  }

  const { grid, exitPos } = result;

  // Branches can lengthen the solution, so re-derive it for the hint system.
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
