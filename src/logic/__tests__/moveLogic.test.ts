import test from 'node:test';
import assert from 'node:assert';
import { simulateMove } from '../moveLogic';
import { emptyGrid } from './fixtures';

test('가장자리 칸에서 진행 방향에 벽이 있으면 out이 아니라 stop이다', () => {
  const grid = emptyGrid(7);
  grid[0][3].top = true;                     // 맨 윗줄, 위쪽 면에 벽
  const r = simulateMove(grid, { row: 0, col: 3 }, 'up', 7, { row: 6, col: 6 });
  assert.strictEqual(r.result, 'stop');
  assert.deepStrictEqual(r.landPos, { row: 0, col: 3 });
});

test('가장자리 칸에서 벽이 없으면 out이다', () => {
  const grid = emptyGrid(7);
  const r = simulateMove(grid, { row: 0, col: 3 }, 'up', 7, { row: 6, col: 6 });
  assert.strictEqual(r.result, 'out');
});

test('다음 칸의 진입 면에 벽이 있으면 직전 칸에서 멈춘다', () => {
  const grid = emptyGrid(7);
  grid[2][3].bottom = true;                  // 아래에서 올라오는 것을 막는다
  const r = simulateMove(grid, { row: 5, col: 3 }, 'up', 7, { row: 6, col: 6 });
  assert.strictEqual(r.result, 'stop');
  assert.deepStrictEqual(r.landPos, { row: 3, col: 3 });
});

test('경로가 탈출구를 지나면 exit이다', () => {
  const grid = emptyGrid(7);
  const r = simulateMove(grid, { row: 6, col: 3 }, 'up', 7, { row: 2, col: 3 });
  assert.strictEqual(r.result, 'exit');
  assert.deepStrictEqual(r.landPos, { row: 2, col: 3 });
});
