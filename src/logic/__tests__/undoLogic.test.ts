import test from 'node:test';
import assert from 'node:assert';
import { applyUndo, pushUndo } from '../undoLogic';
import { makeState } from './fixtures';

test('applyUndo는 undoRemaining이 0이면 스택이 남아 있어도 상태를 바꾸지 않는다', () => {
  const state = makeState({
    undoRemaining: 0,
    undoStack: [{ playerPos: { row: 1, col: 1 }, moveCount: 3 }],
    playerPos: { row: 5, col: 5 },
    moveCount: 9,
  });
  assert.deepStrictEqual(applyUndo(state), state);
});

test('applyUndo는 스택이 비어 있으면 상태를 바꾸지 않는다', () => {
  const state = makeState({ undoRemaining: 3, undoStack: [] });
  assert.deepStrictEqual(applyUndo(state), state);
});

test('applyUndo는 마지막 스냅샷을 복원하고 남은 횟수를 하나 줄인다', () => {
  const state = makeState({
    undoRemaining: 2,
    undoStack: [{ playerPos: { row: 1, col: 1 }, moveCount: 1 }],
    playerPos: { row: 4, col: 4 },
    moveCount: 7,
  });
  const next = applyUndo(state);
  assert.deepStrictEqual(next.playerPos, { row: 1, col: 1 });
  assert.strictEqual(next.moveCount, 1);
  assert.strictEqual(next.undoRemaining, 1);
  assert.deepStrictEqual(next.undoStack, []);
});

test('pushUndo는 undoRemaining이 0이면 스택을 늘리지 않는다', () => {
  const state = makeState({ undoRemaining: 0, undoStack: [] });
  assert.deepStrictEqual(pushUndo(state).undoStack, []);
});
