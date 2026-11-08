import test from 'node:test';
import assert from 'node:assert';
import { findShortestSolution } from '../pathValidator';
import { emptyGrid } from './fixtures';

test('해가 없는 보드에서는 null을 반환한다', () => {
  const grid = emptyGrid(7);
  for (const face of ['top', 'right', 'bottom', 'left'] as const) {
    grid[3][3][face] = true;                 // 시작 칸을 사방으로 가둔다
  }
  assert.strictEqual(findShortestSolution(grid, { row: 3, col: 3 }, { row: 0, col: 0 }, 7), null);
});

test('빈 보드에서 한 번에 닿는 탈출구는 길이 1의 해를 준다', () => {
  const grid = emptyGrid(7);
  const path = findShortestSolution(grid, { row: 3, col: 3 }, { row: 0, col: 3 }, 7);
  assert.deepStrictEqual(path, ['up']);
});
