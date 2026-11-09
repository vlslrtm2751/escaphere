import test from 'node:test';
import assert from 'node:assert';
import { precomputeHintSteps, resolveHint, isOptimalClear } from '../hintLogic';
import { emptyGrid, makeState } from './fixtures';

test('더 공개할 단계가 없으면 resolveHint는 같은 객체를 그대로 돌려준다', () => {
  const state = makeState();                 // 기본 fixture의 hint.steps는 []
  // 구조가 같은 복사본이 아니라 같은 객체여야 한다: 죽은 힌트 누름은
  // 이벤트도, 리렌더도 만들지 않아야 한다
  assert.strictEqual(resolveHint(state), state);
});

test('공개할 단계가 남아 있으면 resolveHint는 단계를 열고 hint 이벤트를 싣는다', () => {
  const state = makeState({
    hint: {
      solutionPath: ['up'],
      steps: [{ direction: 'up', pathCells: [{ row: 2, col: 3 }] }],
      revealedCount: 0,
      usedCount: 0,
    },
  });
  const next = resolveHint(state);
  assert.strictEqual(next.hint.revealedCount, 1);
  assert.strictEqual(next.hint.usedCount, 1);
  assert.strictEqual(next.lastEvent.kind, 'hint');
  assert.strictEqual(next.lastEvent.seq, 1);
});

test('isOptimalClear는 이동수가 최적 경로 길이와 같으면 true다', () => {
  const state = makeState({
    moveCount: 3,
    hint: { solutionPath: ['up', 'up', 'right'], steps: [], revealedCount: 0, usedCount: 0 },
  });
  assert.strictEqual(isOptimalClear(state), true);
});

test('isOptimalClear는 이동수가 최적 경로보다 많으면 false다', () => {
  const state = makeState({
    moveCount: 5,
    hint: { solutionPath: ['up', 'up', 'right'], steps: [], revealedCount: 0, usedCount: 0 },
  });
  assert.strictEqual(isOptimalClear(state), false);
});

test('precomputeHintSteps는 방향마다 한 단계씩, 그 이동이 지나는 칸들을 담는다', () => {
  const grid = emptyGrid(7);
  grid[0][3].top = true;                     // 위로 가다 맨 윗줄에서 멈추게
  grid[0][6].right = true;                   // 오른쪽으로 가다 맨 오른쪽에서 멈추게
  const steps = precomputeHintSteps(
    grid,
    { row: 3, col: 3 },
    ['up', 'right'],
    { row: 6, col: 6 },
    7
  );

  assert.strictEqual(steps.length, 2);

  // pathCells는 출발 칸을 빼고, 도착 칸을 넣는다 — 힌트 오버레이가 그리는 경로다
  assert.strictEqual(steps[0].direction, 'up');
  assert.deepStrictEqual(steps[0].pathCells, [
    { row: 2, col: 3 },
    { row: 1, col: 3 },
    { row: 0, col: 3 },
  ]);

  // 두 번째 단계는 첫 단계가 멈춘 칸에서 이어진다
  assert.strictEqual(steps[1].direction, 'right');
  assert.deepStrictEqual(steps[1].pathCells, [
    { row: 0, col: 4 },
    { row: 0, col: 5 },
    { row: 0, col: 6 },
  ]);
});
