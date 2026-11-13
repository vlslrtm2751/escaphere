import test from 'node:test';
import assert from 'node:assert';
import { swipeDirection } from '../swipeDirection';

test('오른쪽으로 더 많이 움직이면 right', () => {
  assert.strictEqual(swipeDirection(50, 10), 'right');
});

test('왼쪽으로 더 많이 움직이면 left', () => {
  assert.strictEqual(swipeDirection(-50, 10), 'left');
});

test('아래로 더 많이 움직이면 down', () => {
  assert.strictEqual(swipeDirection(10, 50), 'down');
});

test('위로 더 많이 움직이면 up', () => {
  assert.strictEqual(swipeDirection(10, -50), 'up');
});

test('정확히 대각선(동률)이면 세로 쪽으로 판정한다', () => {
  assert.strictEqual(swipeDirection(40, 40), 'down');
  assert.strictEqual(swipeDirection(-40, -40), 'up');
});
