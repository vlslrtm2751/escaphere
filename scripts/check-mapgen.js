/**
 * Map generator verification.
 *
 * No test framework in this project, so this is a plain-node runner over the
 * compiled TypeScript (see scripts/tsconfig.mapgen.json).
 *
 *   npm run check:mapgen
 *
 * It generates many maps per difficulty and asserts the invariants a playable
 * map must satisfy. Exits non-zero on the first failing invariant.
 */
const { generateMap } = require('../.mapgen-build/logic/mapGenerator');
const { simulateMove } = require('../.mapgen-build/logic/moveLogic');
const { findShortestSolution } = require('../.mapgen-build/logic/pathValidator');
const { DIFFICULTY_CONFIG } = require('../.mapgen-build/constants/gameConfig');

const DIFFICULTIES = ['easy', 'normal', 'hard', 'hardcore'];

// A board should make the player choose. These turn "solvable" into "worth
// solving": without them a board can be a corridor. The per-difficulty start
// requirement lives in DIFFICULTY_CONFIG, which the generator reads too.
const MIN_BRANCH_CELLS = 3;   // a wrong turn must stay alive this long
const MIN_OFFPATH_CELLS = 3;  // stop cells off the solution: territory to rule out

// NOT gated: options per solution step. A stop cell always carries a WallPair,
// which blocks the direction of travel plus one perpendicular, so the only
// non-reverse move left is the solution's own. The figure is capped near 1.0 by
// the wall model and says nothing about board quality - it is printed, not
// asserted.
const SAMPLES = 300;

// Perf ceilings. generateMap runs synchronously on the JS thread, so a stall
// here is a visible freeze on device. Measured steady-state cost is well under
// 3 ms average, so these leave generous headroom for slower machines.
// Gates are the average and the median: both are robust to the isolated GC
// pauses this harness provokes, while a real regression moves them together.
// p99/max are printed for diagnosis only -- on a GC'd runtime a single slow
// sample says nothing about the generator.
const MAX_AVG_MS = 10;
const MAX_MEDIAN_MS = 5;

// Timing the first calls would measure module load and JIT warmup rather than
// generation, which is worth hundreds of milliseconds on a cold process.
const WARMUP = 50;

let failures = 0;
const fail = (msg) => { failures++; console.error('  FAIL: ' + msg); };

function walledFaceCount(cell) {
  return (cell.top ? 1 : 0) + (cell.right ? 1 : 0) + (cell.bottom ? 1 : 0) + (cell.left ? 1 : 0);
}

function isCorner(pos, n) {
  const last = n - 1;
  return (pos.row === 0 || pos.row === last) && (pos.col === 0 || pos.col === last);
}


const DIRS = ['up', 'down', 'left', 'right'];
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const samePos = (a, b) => a.row === b.row && a.col === b.col;

/** Moves a player would actually consider: ones that land somewhere, or exit. */
function options(grid, pos, n, exit) {
  const out = [];
  for (const d of DIRS) {
    const r = simulateMove(grid, pos, d, n, exit);
    if (r.result === 'exit') out.push({ d, exit: true, landPos: r.landPos });
    else if (r.result === 'stop' && !samePos(r.landPos, pos)) out.push({ d, exit: false, landPos: r.landPos });
  }
  return out;
}

/**
 * Walk from the start always taking the ONLY move available, never turning
 * back. Reaching the exit this way means the board asked nothing of the player.
 */
function forcedWalk(grid, start, n, exit) {
  let pos = start, prev = null;
  for (let i = 0; i < 100; i++) {
    const opts = options(grid, pos, n, exit).filter(o => !prev || o.d !== OPP[prev]);
    if (opts.some(o => o.exit)) return 'exit';
    if (opts.length !== 1) return opts.length === 0 ? 'deadend' : 'choice';
    pos = opts[0].landPos; prev = opts[0].d;
  }
  return 'loop';
}

/** Stop cells reachable after committing to `firstDir` from the start. */
function branchSize(grid, start, n, exit, firstDir) {
  const first = simulateMove(grid, start, firstDir, n, exit);
  if (first.result !== 'stop' || samePos(first.landPos, start)) return 0;
  const seen = new Set([first.landPos.row + ',' + first.landPos.col]);
  const q = [first.landPos];
  while (q.length) {
    for (const o of options(grid, q.shift(), n, exit)) {
      if (o.exit) continue;
      const k = o.landPos.row + ',' + o.landPos.col;
      if (!seen.has(k)) { seen.add(k); q.push(o.landPos); }
    }
  }
  return seen.size;
}

/** Replay a direction list and report whether it truly reaches the exit. */
function replayReachesExit(map) {
  let cur = map.playerPos;
  for (const dir of map.hint.solutionPath) {
    const { landPos, result } = simulateMove(map.grid, cur, dir, map.gridSize, map.exitPos);
    if (result === 'exit') return true;
    if (result === 'out') return false;
    cur = landPos;
  }
  return false;
}

for (const difficulty of DIFFICULTIES) {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const n = cfg.gridSize;
  const center = Math.floor(n / 2);

  console.log('--- ' + difficulty + ' (grid ' + n + ', minSolutionLength ' + cfg.minSolutionLength + ') ---');

  for (let i = 0; i < WARMUP; i++) generateMap(difficulty, difficulty + '-warmup-' + i, 1);

  // Timing goes first, on a heap the correctness pass has not yet filled with
  // garbage, and reports a percentile rather than the single worst sample: on a
  // GC'd runtime an isolated pause says nothing about the generator, while a
  // real regression moves the whole distribution.
  const timings = [];
  for (let i = 0; i < SAMPLES; i++) {
    const s0 = process.hrtime.bigint();
    generateMap(difficulty, difficulty + '-check-' + i, 1);
    timings.push(Number(process.hrtime.bigint() - s0) / 1e6);
  }
  const avgMs = timings.reduce((a, b) => a + b, 0) / SAMPLES;
  const sorted = [...timings].sort((a, b) => a - b);
  const medianMs = sorted[Math.floor(SAMPLES / 2)];
  const p99Ms = sorted[Math.floor(SAMPLES * 0.99)];
  const maxMs = sorted[SAMPLES - 1];

  let tooShort = 0, worstLen = Infinity, badExit = 0, badWalls = 0, badReplay = 0;
  let sumLen = 0;
  // branching: does the board actually make the player choose?
  let noDecision = 0, thinStart = 0, worstStart = Infinity, shallowBranch = 0;
  let sumPathOptions = 0, pathSteps = 0;
  let sumOffPath = 0, worstOffPath = Infinity, thinTerritory = 0;

  for (let i = 0; i < SAMPLES; i++) {
    const map = generateMap(difficulty, difficulty + '-check-' + i, 1);

    // 1. the shortest solution must be at least minSolutionLength
    const shortest = findShortestSolution(map.grid, map.playerPos, map.exitPos, n);
    if (!shortest) {
      tooShort++;
      worstLen = 0;
    } else {
      sumLen += shortest.length;
      if (shortest.length < worstLen) worstLen = shortest.length;
      if (shortest.length < cfg.minSolutionLength) tooShort++;
    }

    // 2. the stored solution path must actually reach the exit
    if (!replayReachesExit(map)) badReplay++;

    // 3. exit must be outside the 3x3 spawn zone and off the corners
    const e = map.exitPos;
    const inSpawnZone = Math.abs(e.row - center) <= 1 && Math.abs(e.col - center) <= 1;
    if (inSpawnZone || isCorner(e, n)) badExit++;

    // 5. the board must present choices, not a corridor
    const startOpts = options(map.grid, map.playerPos, n, map.exitPos);
    if (startOpts.length < worstStart) worstStart = startOpts.length;
    if (startOpts.length < cfg.minStartOptions) thinStart++;
    if (forcedWalk(map.grid, map.playerPos, n, map.exitPos) === 'exit') noDecision++;

    // a wrong turn at the start has to stay alive for a few moves
    const firstDir = map.hint.solutionPath[0];
    for (const o of startOpts) {
      if (o.exit || o.d === firstDir) continue;
      if (branchSize(map.grid, map.playerPos, n, map.exitPos, o.d) < MIN_BRANCH_CELLS) shallowBranch++;
    }

    // options available at each step of the solution, ignoring turning back
    const onPath = new Set([map.playerPos.row + ',' + map.playerPos.col]);
    let cur = map.playerPos, prev = null;
    for (const d of map.hint.solutionPath) {
      sumPathOptions += options(map.grid, cur, n, map.exitPos)
        .filter(o => !prev || o.d !== OPP[prev]).length;
      pathSteps++;
      const r = simulateMove(map.grid, cur, d, n, map.exitPos);
      if (r.result === 'exit') break;
      cur = r.landPos; prev = d;
      onPath.add(cur.row + ',' + cur.col);
    }

    // territory off the solution — what the player has to explore and rule out
    const reach = new Set([map.playerPos.row + ',' + map.playerPos.col]);
    const queue = [map.playerPos];
    while (queue.length) {
      for (const o of options(map.grid, queue.shift(), n, map.exitPos)) {
        if (o.exit) continue;
        const k = o.landPos.row + ',' + o.landPos.col;
        if (!reach.has(k)) { reach.add(k); queue.push(o.landPos); }
      }
    }
    let offPath = 0;
    for (const k of reach) if (!onPath.has(k)) offPath++;
    sumOffPath += offPath;
    if (offPath < worstOffPath) worstOffPath = offPath;
    if (offPath < MIN_OFFPATH_CELLS) thinTerritory++;

    // 4. every walled cell carries exactly one WallPair (two adjacent faces)
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cnt = walledFaceCount(map.grid[r][c]);
        if (cnt !== 0 && cnt !== 2) { badWalls++; break; }
      }
    }
  }

  console.log('  shortest-solution length: min ' + worstLen + ', avg ' + (sumLen / SAMPLES).toFixed(2));
  console.log('  timing: avg ' + avgMs.toFixed(2) + ' ms/map, median ' + medianMs.toFixed(2) +
    ' ms  (p99 ' + p99Ms.toFixed(1) + ' ms, max ' + maxMs.toFixed(1) + ' ms - both GC-sensitive)');

  if (tooShort > 0) fail(tooShort + '/' + SAMPLES + ' maps have a shortest solution below minSolutionLength ' + cfg.minSolutionLength + ' (shortest seen: ' + worstLen + ')');
  if (badReplay > 0) fail(badReplay + '/' + SAMPLES + ' maps store a solutionPath that does not reach the exit');
  if (badExit > 0) fail(badExit + '/' + SAMPLES + ' maps place the exit in the spawn zone or on a corner');
  if (badWalls > 0) fail(badWalls + '/' + SAMPLES + ' maps contain a cell whose wall face count is not 0 or 2');

  const avgPathOptions = sumPathOptions / pathSteps;
  console.log('  branching: ' + (noDecision * 100 / SAMPLES).toFixed(1) + '% solvable with no decision, ' +
    'fewest start options ' + worstStart + ', off-solution cells avg ' + (sumOffPath / SAMPLES).toFixed(1) +
    ' (min ' + worstOffPath + ')');
  console.log('             options/step ' + avgPathOptions.toFixed(2) + ' - capped near 1.0 by the wall model, not gated');

  if (noDecision > 0) fail(noDecision + '/' + SAMPLES + ' maps reach the exit by always taking the only available move - the player chooses nothing');
  if (thinStart > 0) fail(thinStart + '/' + SAMPLES + ' maps offer fewer than ' + cfg.minStartOptions + ' moves at the start (fewest: ' + worstStart + ')');
  if (thinTerritory > 0) fail(thinTerritory + '/' + SAMPLES + ' maps have fewer than ' + MIN_OFFPATH_CELLS + ' reachable cells off the solution (min: ' + worstOffPath + ') - nothing to rule out');
  if (shallowBranch > 0) fail(shallowBranch + ' wrong turns at the start dead-end within ' + MIN_BRANCH_CELLS + ' cells');
  if (avgMs > MAX_AVG_MS) fail('avg generation time ' + avgMs.toFixed(1) + ' ms exceeds ' + MAX_AVG_MS + ' ms');
  if (medianMs > MAX_MEDIAN_MS) fail('median generation time ' + medianMs.toFixed(2) + ' ms exceeds ' + MAX_MEDIAN_MS + ' ms');

  // 5. same seed must produce the same map (generateMap has to stay pure —
  //    useGameState calls it and React may invoke an updater twice)
  const a = generateMap(difficulty, 'determinism-probe', 1);
  const b = generateMap(difficulty, 'determinism-probe', 1);
  if (JSON.stringify(a.grid) !== JSON.stringify(b.grid) ||
      JSON.stringify(a.exitPos) !== JSON.stringify(b.exitPos)) {
    fail('generateMap is not deterministic for a fixed seed');
  }
}

console.log('');
if (failures > 0) {
  console.error(failures + ' invariant(s) FAILED');
  process.exit(1);
}
console.log('all map generator invariants hold');
