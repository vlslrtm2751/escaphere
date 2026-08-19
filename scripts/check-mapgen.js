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

const DIFFICULTIES = ['easy', 'normal', 'hard'];
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
