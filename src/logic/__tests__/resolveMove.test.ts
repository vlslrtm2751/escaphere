import test from 'node:test';
import assert from 'node:assert';
import { resolveMove, resolveRespawn } from '../resolveMove';
import { emptyGrid, makeState } from './fixtures';

test('벽에 막힌 이동은 위치와 이동수를 바꾸지 않는다', () => {
  const grid = emptyGrid(7);
  grid[3][3].top = true;
  const state = makeState({ grid, playerPos: { row: 3, col: 3 }, moveCount: 4 });
  const next = resolveMove(state, 'up');
  assert.deepStrictEqual(next.playerPos, { row: 3, col: 3 });
  assert.strictEqual(next.moveCount, 4);
  assert.deepStrictEqual(next.undoStack, []);
});

test('벽에 막힌 이동도 blocked 이벤트를 전달한다', () => {
  const grid = emptyGrid(7);
  grid[3][3].top = true;
  const state = makeState({ grid, playerPos: { row: 3, col: 3 } });
  const next = resolveMove(state, 'up');
  assert.strictEqual(next.lastEvent.kind, 'blocked');
  assert.strictEqual(next.lastEvent.seq, state.lastEvent.seq + 1);
});

test('연속으로 벽에 막히면 일련번호가 매번 올라간다', () => {
  const grid = emptyGrid(7);
  grid[3][3].top = true;
  const first = resolveMove(makeState({ grid, playerPos: { row: 3, col: 3 } }), 'up');
  const second = resolveMove(first, 'up');
  assert.strictEqual(second.lastEvent.kind, 'blocked');
  assert.strictEqual(second.lastEvent.seq, first.lastEvent.seq + 1);
});

test('움직인 이동은 이동수를 올리고 되돌리기 스냅샷을 쌓는다', () => {
  const grid = emptyGrid(7);
  grid[0][3].top = true;                     // 맨 윗줄에서 멈추게 — 없으면 보드를 벗어난다
  const state = makeState({ grid, playerPos: { row: 3, col: 3 }, moveCount: 1, exitPos: { row: 6, col: 6 } });
  const next = resolveMove(state, 'up');
  assert.deepStrictEqual(next.playerPos, { row: 0, col: 3 });
  assert.strictEqual(next.moveCount, 2);
  assert.strictEqual(next.undoStack.length, 1);
  assert.strictEqual(next.lastEvent.kind, 'moved');
});

test('보드 밖으로 나가면 respawning 상태와 out 이벤트가 된다', () => {
  const grid = emptyGrid(7);
  const state = makeState({ grid, playerPos: { row: 0, col: 3 }, exitPos: { row: 6, col: 6 } });
  const next = resolveMove(state, 'up');
  // playerPos는 보드 밖으로 리셋되지 않고 가장자리 칸에 그대로 남는다 --
  // PlayerOrb가 날아 나가는 연출을 시작할 지점이 필요하기 때문이다.
  assert.deepStrictEqual(next.playerPos, { row: 0, col: 3 });
  assert.strictEqual(next.status, 'respawning');
  assert.strictEqual(next.respawnDir, 'up');
  assert.strictEqual(next.lastEvent.kind, 'out');
});

test('탈출구에 닿으면 cleared 상태와 exit 이벤트가 된다', () => {
  const grid = emptyGrid(7);
  const state = makeState({ grid, playerPos: { row: 3, col: 3 }, exitPos: { row: 0, col: 3 } });
  const next = resolveMove(state, 'up');
  assert.strictEqual(next.status, 'cleared');
  assert.strictEqual(next.lastEvent.kind, 'exit');
  assert.strictEqual(next.moveCount, state.moveCount + 1);
});

test('playing이 아니면 이벤트도 상태도 바뀌지 않는다', () => {
  const state = makeState({ grid: emptyGrid(7), status: 'cleared' });
  // 같은 객체여야 한다 — 구조만 같은 복사본은 React의 렌더 생략을 잃는다
  assert.strictEqual(resolveMove(state, 'up'), state);
});

test('resolveRespawn은 중앙으로 돌려보내고 이동수와 되돌리기를 초기화한다', () => {
  const state = makeState({
    gridSize: 7, difficulty: 'easy', status: 'respawning', respawnDir: 'up',
    playerPos: { row: 0, col: 3 }, moveCount: 8, undoRemaining: 0,
    undoStack: [{ playerPos: { row: 1, col: 1 }, moveCount: 1 }],
  });
  const next = resolveRespawn(state);
  assert.deepStrictEqual(next.playerPos, { row: 3, col: 3 });
  assert.strictEqual(next.moveCount, 0);
  assert.strictEqual(next.undoRemaining, 5);    // easy의 undoLimit
  assert.deepStrictEqual(next.undoStack, []);
  assert.strictEqual(next.status, 'playing');
  // PlayerOrb는 날아가는 연출을 respawnDir에 걸어 둔다 — 비우지 않으면 공이 밖에 남는다
  assert.strictEqual(next.respawnDir, null);
  // 이벤트는 싣지 않는다 — 'out'이 이미 울렸다
  assert.deepStrictEqual(next.lastEvent, state.lastEvent);
});

test('resolveRespawn은 respawning이 아니면 아무것도 하지 않는다', () => {
  const state = makeState({ status: 'playing' });
  assert.strictEqual(resolveRespawn(state), state);
});
