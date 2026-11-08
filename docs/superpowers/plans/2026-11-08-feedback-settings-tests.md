# 피드백·설정·로직 테스트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 벽에 막힌 이동이 즉시 체감되게 하고, 설정을 실제로 동작·저장되게 하며, 게임 로직의 불변식을 테스트로 고정한다.

**Architecture:** 이동 해석을 `useGameState`의 `setState` 업데이터에서 `src/logic/`의 순수 함수(`resolveMove`)로 꺼낸다. 그 함수가 "직전에 무슨 일이 일어났는지"를 `GameState.lastEvent`(종류 + 단조 증가 일련번호)로 남기고, `GameScreen`은 일련번호만 보는 이펙트 하나로 효과음·햅틱을 낸다. 판정이 순수 함수가 되므로 React 없이 `node:test`로 검증된다. 설정은 순수 병합 함수를 거쳐 AsyncStorage에 저장되고, 새 설정 모달이 홈과 일시정지 메뉴 양쪽에서 열린다.

**Tech Stack:** Expo SDK 55, React Native 0.83.2, React 19.2, TypeScript 5.9 (strict), `expo-audio` (55.0.x), `expo-haptics`, `@react-native-async-storage/async-storage`, Node 내장 `node:test`

**Spec:** [docs/superpowers/specs/2026-11-08-sfx-settings-tests-design.md](../specs/2026-11-08-sfx-settings-tests-design.md)

**Branch:** `feat/feedback-settings-tests`

## Global Constraints

- Expo SDK 55 / React Native 0.83.2 / React 19.2 버전 라인을 유지한다.
- 새 런타임 의존성은 `expo-audio` 하나뿐. 새 devDependency는 0개 — 테스트는 Node 내장 `node:test`를 쓴다. 현재 devDependencies는 3개(`@types/react`, `playwright`, `typescript`).
- `expo-audio` 설치는 `npx expo install expo-audio`로 한다 (SDK 55 → 55.0.x 라인). `expo-av`는 `package.json`에서 제거한다.
- 웹과 안드로이드 양쪽에서 동작해야 한다. **`expo-haptics`는 웹에서 동작하지 않으므로** 웹에서는 효과음이 유일한 피드백 채널이다. 피드백은 한쪽만 있어도 의미가 통해야 한다.
- 웹 전용 API(`window`, `localStorage`)를 `Platform.OS` 가드 없이 새로 도입하지 않는다. 저장은 `@react-native-async-storage/async-storage`만 쓴다.
- `src/constants/version.ts`는 배포 워크플로우가 생성한다. 손대지 않는다.
- **`simulateMove`의 반환값에 `'blocked'`를 추가하지 말 것.** `scripts/check-mapgen.js`가 `'stop'`/`'exit'`/`'out'` 값과 `samePos(landPos, pos)` 비교에 직접 의존하고, 타입 검사를 받지 않는 plain JS라 런타임에만 깨진다.
- CI 게이트 3개(`npx tsc --noEmit`, `npm run check:mapgen`, `npm run check:layout`)를 깨뜨리지 않는다.
- `.wav`/`.mp3`에 대한 모듈 선언이 없으므로 `import`가 아니라 `require()`를 써야 `tsc --noEmit`를 통과한다.
- 저장 실패는 무시한다 — `src/storage/asyncStorage.ts`의 기존 방식(try/catch 후 무음)을 유지한다.
- 이동 피드백은 가볍고 짧게, 벽 충돌은 이동과 확실히 구별되게. "실패"가 아니라 "정보"로 느껴져야 한다.

## Review Focus

스펙이 함의하지만 어느 태스크도 자연히 다루지 않는, 사용자를 실제로 물 가능성이 높은 입력들. 각 줄의 테스트는 해당 코드를 가진 태스크에 포함되어 있다.

1. **저장된 설정에 키가 없거나 모르는 키가 섞여 있다** — 개발 중 저장된 `bgmOn`이 남아 있거나 `theme`이 없는 JSON을 그대로 state에 펼치면 `theme: undefined`로 테마 선택이 깨진다. → Task 6, `mergeSettings` 테스트.
2. **AsyncStorage 읽기가 예외를 던진다** — 웹 시크릿 창이나 사이트 데이터 차단에서 발생한다. hydration 게이트가 열리지 않으면 **영구 빈 화면**이 된다. → Task 6, `mergeSettings(null)` 테스트 + 게이트를 `finally`에서 해제.
3. **같은 방향을 벽에 대고 연속으로 누른다** — 종류가 같아 일련번호가 없으면 두 번째부터 피드백이 안 나오고, 상태가 바뀌지 않아야 하는데 `undoStack`이 자라면 되돌리기가 망가진다. → Task 3, `resolveMove` 테스트.
4. **되돌리기 횟수가 0인데 스택은 비어 있지 않다** — 하드 난이도(undoLimit 1)에서 실제로 발생하는 상태다. 뷰 가드를 거치지 않고 호출되면 `undoRemaining`이 `-1`로 내려간다. → Task 1, `applyUndo` 테스트.
5. **일부 키만 사운드 파일이 있다** — 없는 키는 조용히 넘어가고 **햅틱은 정상 동작**해야 한다. 맵의 완전성은 `Record<SfxKey, AudioSource | null>` 타입이 컴파일 시점에 강제하므로 런타임 테스트가 아니라 타입이 지킨다. 조용히 넘어가는 동작은 Task 4의 수동 확인 단계에서 본다.

---

## File Structure

**신규**

| 파일 | 책임 |
|---|---|
| `src/logic/gameEvents.ts` | `withEvent` — 상태에 직전 이벤트를 붙이고 일련번호를 올린다 |
| `src/logic/resolveMove.ts` | `resolveMove`, `resolveRespawn` — 이동 해석과 리스폰. 순수 함수 |
| `src/logic/settings.ts` | `DEFAULT_SETTINGS`, `mergeSettings` — 저장된 값을 기본값과 병합. 순수 함수, RN import 없음 |
| `src/logic/__tests__/fixtures.ts` | 테스트용 그리드·상태 생성 헬퍼 |
| `src/logic/__tests__/*.test.ts` | 로직 유닛 테스트 4개 |
| `src/audio/sfxAssets.ts` | 키별 `require()` 매핑. **사운드 파일이 추가될 때 손대는 유일한 파일** |
| `src/audio/sfxPlayer.ts` | 키별 `AudioPlayer`를 지연 생성하고 재생 |
| `src/components/ui/SettingsModal.tsx` | 토글 4개를 담은 설정 모달 |
| `src/components/ui/SfxToggleButton.tsx` | `BgmToggleButton`을 대체 |
| `assets/sounds/.gitkeep` | 사운드 파일이 들어갈 자리 |

**수정**

`src/types/game.ts` (이벤트 타입, `AppSettings` 정리) · `src/constants/sounds.ts` (키 6개) · `src/logic/undoLogic.ts` (가드 + 이벤트) · `src/logic/hintLogic.ts` (이벤트) · `src/logic/mapGenerator.ts` (초기 `lastEvent`) · `src/hooks/useGameState.ts` (순수 함수 위임) · `src/hooks/useSfx.ts` (expo-audio) · `src/hooks/useHaptic.ts` (`triggerOut`) · `src/context/SettingsContext.tsx` (저장 + hydration) · `src/context/ThemeContext.tsx` (설정에서 읽기) · `src/screens/GameScreen.tsx` (피드백 이펙트, 모달) · `src/screens/HomeScreen.tsx` (⚙ 버튼) · `src/components/ui/PauseMenu.tsx` (설정 버튼) · `scripts/tsconfig.mapgen.json` (`types: ["node"]`) · `package.json` · `.github/workflows/deploy.yml`

**삭제**

`src/hooks/useBgm.ts` · `src/hooks/useGameActions.ts` · `src/components/ui/BgmToggleButton.tsx`

---

## Task 1: 테스트 러너와 `applyUndo` 가드

**Files:**
- Modify: `scripts/tsconfig.mapgen.json`
- Modify: `package.json`
- Modify: `.github/workflows/deploy.yml`
- Modify: `src/logic/undoLogic.ts`
- Create: `src/logic/__tests__/fixtures.ts`
- Test: `src/logic/__tests__/undoLogic.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `npm run test:logic` 명령. `fixtures.ts`의 `emptyGrid(size: number): CellWalls[][]`, `makeState(overrides?: Partial<GameState>): GameState` — 이후 모든 테스트 태스크가 쓴다. `makeState`의 기본값은 `gridSize: 7`, `difficulty: 'easy'`, 중앙 `playerPos`, 빈 그리드, `moveCount: 0`, `undoRemaining: 5`, `undoStack: []`, `status: 'playing'`.

- [ ] **Step 1: `scripts/tsconfig.mapgen.json`의 `"types": []`를 `"types": ["node"]`로 바꾼다**

이 설정이 `src/logic/**/*.ts`를 이미 포함하므로 `__tests__` 아래 파일도 같은 컴파일에 들어간다. `check:mapgen`과 산출물(`.mapgen-build/`)을 공유한다.

- [ ] **Step 2: `src/logic/__tests__/fixtures.ts` 작성**

위 Interfaces의 두 함수를 내보낸다. `makeState`는 `GameState`의 모든 필수 필드를 채우고 `overrides`를 얕게 덮어쓴다. `hint`는 `{ solutionPath: [], steps: [], revealedCount: 0, usedCount: 0 }`, `exitPos`는 `{ row: 6, col: 6 }`, `respawnDir`는 `null`, `stageSeed`/`stageNumber`는 아무 고정값. `grid`는 `emptyGrid(7)`.

- [ ] **Step 3: 실패하는 테스트 작성** — `src/logic/__tests__/undoLogic.test.ts`

```typescript
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
```

- [ ] **Step 4: `package.json`에 스크립트 추가**

```json
"test:logic": "tsc -p scripts/tsconfig.mapgen.json && node --test .mapgen-build/logic/__tests__/"
```

- [ ] **Step 5: 테스트를 돌려 첫 번째가 실패하는 것을 확인**

Run: `npm run test:logic`
Expected: 첫 번째 테스트 FAIL — `applyUndo`가 `undoRemaining: -1`을 반환하고 스택을 pop한다. 나머지 세 개는 PASS.

- [ ] **Step 6: `src/logic/undoLogic.ts`의 `applyUndo`에 `undoRemaining <= 0` 가드 추가**

기존 스택 길이 검사 앞 또는 뒤에 추가해 `pushUndo`와 대칭이 되게 한다. `GameScreen.handleUndo`와 `GameToolbar`의 `disabled`는 UX를 위해 그대로 둔다.

- [ ] **Step 7: 테스트 통과 확인**

Run: `npm run test:logic`
Expected: 4개 모두 PASS

- [ ] **Step 8: `.github/workflows/deploy.yml`에 단계 추가**

"Verify map generator" 단계 **앞**에 `Test game logic` 단계를 넣고 `npm run test:logic`을 실행한다. 두 스크립트가 같은 `tsc` 설정을 쓰므로 순서가 바뀌어도 무해하다.

- [ ] **Step 9: 전체 게이트 확인**

Run: `npx tsc --noEmit && npm run check:mapgen`
Expected: 둘 다 통과. `check:mapgen`은 "all map generator invariants hold"로 끝난다.

- [ ] **Step 10: Commit**

```bash
git add scripts/tsconfig.mapgen.json package.json .github/workflows/deploy.yml src/logic/undoLogic.ts src/logic/__tests__/
git commit -m "test: add a logic test runner, and guard applyUndo on undoRemaining"
```

---

## Task 2: 기존 불변식을 테스트로 고정

**Files:**
- Test: `src/logic/__tests__/moveLogic.test.ts`
- Test: `src/logic/__tests__/pathValidator.test.ts`

**Interfaces:**
- Consumes: Task 1의 `fixtures.ts` (`emptyGrid`), `npm run test:logic`
- Produces: 없음 (프로덕션 코드 변경 없음). Task 3이 이 불변식 위에서 리팩터하므로 먼저 고정한다.

- [ ] **Step 1: `src/logic/__tests__/moveLogic.test.ts` 작성**

핵심은 "현재 칸 벽 검사가 경계 검사보다 먼저"라는 순서다. 이 순서가 뒤집히면 보드 가장자리에서 벽에 막혀야 할 이동이 `'out'`으로 오판된다.

```typescript
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
```

- [ ] **Step 2: `src/logic/__tests__/pathValidator.test.ts` 작성**

```typescript
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
```

- [ ] **Step 3: 테스트 통과 확인**

Run: `npm run test:logic`
Expected: Task 1의 4개와 새 6개, 모두 PASS

- [ ] **Step 4: 테스트에 실효성이 있는지 확인**

`src/logic/moveLogic.ts`에서 1번 검사(현재 칸 벽)와 2번 검사(경계)의 순서를 일시적으로 뒤바꾼다.
Run: `npm run test:logic`
Expected: 첫 번째 테스트가 FAIL (`'out'`을 받는다). 확인 후 **순서를 원래대로 되돌린다**.

- [ ] **Step 5: Commit**

```bash
git add src/logic/__tests__/
git commit -m "test: pin the wall-before-bounds ordering and the unsolvable-board case"
```

---

## Task 3: 이동 해석을 순수 함수로 꺼내고 이벤트를 싣는다

가장 위험한 태스크다. 핵심 훅을 재구성하고 `GameState`의 모양을 바꾼다.

**Files:**
- Modify: `src/types/game.ts`
- Create: `src/logic/gameEvents.ts`
- Create: `src/logic/resolveMove.ts`
- Modify: `src/logic/undoLogic.ts`
- Modify: `src/logic/hintLogic.ts`
- Modify: `src/logic/mapGenerator.ts:630-640` (반환 객체)
- Modify: `src/hooks/useGameState.ts`
- Modify: `src/logic/__tests__/fixtures.ts` (`makeState`에 `lastEvent` 추가)
- Delete: `src/hooks/useGameActions.ts`
- Test: `src/logic/__tests__/resolveMove.test.ts`

**Interfaces:**
- Consumes: Task 1의 `fixtures.ts`, `npm run test:logic`
- Produces:
  ```typescript
  // src/types/game.ts
  export type GameEventKind = 'moved' | 'blocked' | 'out' | 'exit' | 'undo' | 'hint';
  export type GameEvent = { kind: GameEventKind; seq: number };
  // GameState에 추가: lastEvent: GameEvent;   // seq 0 = 아직 아무 일도 없음

  // src/logic/gameEvents.ts
  export function withEvent(state: GameState, kind: GameEventKind): GameState;

  // src/logic/resolveMove.ts
  export function resolveMove(state: GameState, direction: Direction): GameState;
  export function resolveRespawn(state: GameState): GameState;

  // src/logic/hintLogic.ts (추가)
  export function resolveHint(state: GameState): GameState;
  ```
  `applyUndo`는 시그니처가 그대로지만 이제 `'undo'` 이벤트를 싣는다.

- [ ] **Step 1: `src/types/game.ts`에 `GameEventKind`, `GameEvent`를 추가하고 `GameState`에 `lastEvent: GameEvent`를 넣는다**

- [ ] **Step 2: `src/logic/gameEvents.ts` 작성**

`withEvent(state, kind)`는 `{ ...state, lastEvent: { kind, seq: state.lastEvent.seq + 1 } }`를 반환한다.

- [ ] **Step 3: `lastEvent`의 초기값을 두 곳에 넣는다**

`src/logic/mapGenerator.ts`의 반환 객체와 Task 1의 `src/logic/__tests__/fixtures.ts`의 `makeState` 기본값, 둘 다 `lastEvent: { kind: 'moved', seq: 0 }`이다. `seq: 0`이 "아직 아무 일도 없음"을 뜻한다 — 새 보드에서 피드백이 울리지 않게 하는 장치다. Step 1이 `GameState`에 필수 필드를 추가했으므로 이 단계 전까지는 타입체크가 실패한다.

- [ ] **Step 4: 실패하는 테스트 작성** — `src/logic/__tests__/resolveMove.test.ts`

Review Focus 3번(연속으로 벽에 막기)이 두 번째·세 번째 테스트다.

```typescript
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
  assert.deepStrictEqual(resolveMove(state, 'up'), state);
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
});

test('resolveRespawn은 respawning이 아니면 아무것도 하지 않는다', () => {
  const state = makeState({ status: 'playing' });
  assert.deepStrictEqual(resolveRespawn(state), state);
});
```

벽은 `top`/`right`/`bottom`/`left` 네 면으로만 지정한다 — `CellWalls`에 `up`/`down` 같은 필드는 없다. 빈 보드에서는 어느 방향으로든 공이 보드를 벗어나므로, `'moved'`를 보려면 멈출 벽을 하나 세워야 한다.

- [ ] **Step 5: 테스트를 돌려 실패를 확인**

Run: `npm run test:logic`
Expected: `resolveMove`/`resolveRespawn`을 찾을 수 없어 전부 FAIL

- [ ] **Step 6: `src/logic/resolveMove.ts` 구현**

`resolveMove(state, direction)`: `status !== 'playing'`이면 `state`를 그대로 반환. 그 외에는 `simulateMove(state.grid, state.playerPos, direction, state.gridSize, state.exitPos)`의 결과로 분기한다 — `'out'`이면 `playerPos`를 `landPos`로 두고(날아가는 애니메이션이 가장자리에서 시작한다) `status: 'respawning'` + `respawnDir: direction` + `'out'` 이벤트, `'exit'`이면 `pushUndo` 후 `status: 'cleared'` + `moveCount + 1` + `'exit'` 이벤트, `landPos`가 `playerPos`와 같으면 **상태는 그대로 두고 `'blocked'` 이벤트만** 싣고, 그 외에는 `pushUndo` 후 위치 갱신 + `moveCount + 1` + `'moved'` 이벤트. 분기 구조는 현재 `src/hooks/useGameState.ts:21-47`의 것을 그대로 옮긴 것이다 — `simulateMove`의 반환값은 건드리지 않는다.

`resolveRespawn(state)`: `status !== 'respawning'`이면 그대로 반환. 그 외에는 중앙 좌표와 `DIFFICULTY_CONFIG[state.difficulty].undoLimit`으로 초기화한다. 이벤트는 싣지 않는다 — `'out'`이 이미 울렸다.

- [ ] **Step 7: `applyUndo`와 `resolveHint`에 이벤트를 싣는다**

`src/logic/undoLogic.ts`의 `applyUndo`는 반환하기 전에 `withEvent(..., 'undo')`를 거친다. 가드에 걸려 상태를 그대로 반환하는 경로에는 이벤트를 싣지 않는다.

`src/logic/hintLogic.ts`에 `resolveHint(state)`를 추가한다 — `revealNextHint(state.hint)`를 호출하고, 결과가 입력과 다를 때만(더 공개할 단계가 있을 때만) `'hint'` 이벤트를 싣는다.

- [ ] **Step 8: `src/hooks/useGameState.ts`를 순수 함수 위임으로 바꾼다**

`move`는 `setState(prev => resolveMove(prev, direction))`, `completeRespawn`은 `setState(resolveRespawn)`, `undo`는 그대로 `setState(applyUndo)`, `hint`는 `setState(resolveHint)`가 된다. `refresh`/`nextStage`/`restart`는 그대로 둔다 — `generateMap`을 업데이터 밖에서 부르는 이유가 주석에 적혀 있고 유효하다. `DIFFICULTY_CONFIG`와 `simulateMove`, `pushUndo` import는 더 이상 필요 없으면 지운다.

- [ ] **Step 9: `src/hooks/useGameActions.ts` 삭제**

아무도 import하지 않는 죽은 코드이고, 이 태스크의 구조가 그 역할을 대신한다.

- [ ] **Step 10: 테스트와 전체 게이트 확인**

Run: `npm run test:logic && npx tsc --noEmit && npm run check:mapgen`
Expected: 테스트 전부 PASS, 타입체크 통과, `check:mapgen`이 "all map generator invariants hold"로 끝난다. `check:mapgen`은 `GameState`를 받아 쓰므로 `lastEvent` 추가가 깨뜨리지 않는지가 여기서 드러난다.

- [ ] **Step 11: Commit**

```bash
git add src/types/game.ts src/logic/ src/hooks/useGameState.ts
git rm src/hooks/useGameActions.ts
git commit -m "refactor: resolve moves in pure logic, and report what happened"
```

---

## Task 4: `expo-audio`로 교체하고 효과음을 재생한다

**Files:**
- Modify: `package.json` (`expo-audio` 추가, `expo-av` 제거)
- Modify: `src/constants/sounds.ts`
- Create: `src/audio/sfxAssets.ts`
- Create: `src/audio/sfxPlayer.ts`
- Create: `assets/sounds/.gitkeep`
- Modify: `src/hooks/useSfx.ts`
- Delete: `src/hooks/useBgm.ts`

**Interfaces:**
- Consumes: 없음 (Task 1-3과 독립)
- Produces:
  ```typescript
  // src/constants/sounds.ts — 키의 단일 출처
  export const SFX = { move, wall, out, clear, hint, undo } as const;  // 값은 파일명 문자열
  export type SfxKey = keyof typeof SFX;

  // src/audio/sfxAssets.ts
  export const SFX_ASSETS: Record<SfxKey, AudioSource | null>;

  // src/audio/sfxPlayer.ts
  export function playSfxSound(key: SfxKey): void;

  // src/hooks/useSfx.ts
  export function useSfx(): { playSfx: (key: SfxKey) => void };
  ```
  `playSfx`는 더 이상 `async`가 아니다 — `expo-audio`의 `play()`는 동기다.

- [ ] **Step 1: 패키지 교체**

```bash
npx expo install expo-audio
npm uninstall expo-av
```

`package.json`의 `expo-audio`가 55.0.x 라인인지 확인한다.

- [ ] **Step 2: `src/constants/sounds.ts`를 키 6개로 맞춘다**

`gameover`를 빼고 `out`을 넣는다. 순서는 `move`, `wall`, `out`, `clear`, `hint`, `undo`. 이 파일이 `SfxKey`의 단일 출처다.

- [ ] **Step 3: `assets/sounds/.gitkeep` 생성**

- [ ] **Step 4: `src/audio/sfxAssets.ts` 작성**

`Record<SfxKey, AudioSource | null>` 타입으로 6개 키를 **모두** 적고, 아직 파일이 없으므로 값은 전부 `null`로 둔다. `AudioSource`는 `expo-audio`가 내보내는 오디오 소스 타입이다 — 설치 후 패키지의 타입 선언에서 정확한 이름을 확인하고, 다르면 그 이름을 쓴다. 파일이 추가되면 그 키만 `require('../../assets/sounds/move.wav')`로 바꾼다 — 주석으로 그렇게 적어둔다. 타입이 `Record<SfxKey, ...>`이므로 키를 빠뜨리면 컴파일이 실패한다(Review Focus 5).

- [ ] **Step 5: `src/audio/sfxPlayer.ts` 작성**

키별 `AudioPlayer`를 모듈 스코프 맵에 **지연 생성**한다 — `SFX_ASSETS[key]`가 `null`이면 아무것도 하지 않고 반환하고, 아니면 없을 때만 `createAudioPlayer(source)`로 만들어 캐시한다. 재생은 `player.seekTo(0)` 다음 `player.play()` — 짧은 효과음을 연속으로 눌렀을 때 처음부터 다시 나게 하는 방식이다. 전체를 `try/catch`로 감싸 무음 처리한다(저장 실패를 무시하는 기존 방침과 같다).

- [ ] **Step 6: `src/hooks/useSfx.ts`를 다시 쓴다**

`settings.sfxOn`이 거짓이면 반환하고, 참이면 `playSfxSound(key)`에 위임한다. `expo-av`의 `Audio.Sound.createAsync` 경로와 `SFX_MAP` 상수는 사라진다. `useCallback`의 deps는 `[settings.sfxOn]`.

- [ ] **Step 7: `src/hooks/useBgm.ts` 삭제**

- [ ] **Step 8: 타입체크와 빌드 확인**

Run: `npx tsc --noEmit && npm run build:web`
Expected: 둘 다 성공. `expo-av` import가 남아 있으면 타입체크가 잡는다. 빌드는 `require`가 깨지지 않았는지 확인한다.

- [ ] **Step 9: 사운드 파일이 없는 상태를 수동으로 확인** (Review Focus 5)

Run: `npm run web`
확인: 앱이 정상적으로 뜨고, 보드를 움직여도 콘솔에 오류가 없고, 소리는 나지 않는다.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/constants/sounds.ts src/audio/ src/hooks/useSfx.ts assets/sounds/.gitkeep
git rm src/hooks/useBgm.ts
git commit -m "feat: move audio to expo-audio, and drop the dead BGM path"
```

---

## Task 5: 피드백 배선

**Files:**
- Modify: `src/hooks/useHaptic.ts`
- Modify: `src/screens/GameScreen.tsx`

**Interfaces:**
- Consumes: Task 3의 `GameState.lastEvent`, Task 4의 `useSfx().playSfx`
- Produces: `useHaptic()`에 `triggerOut` 추가. `triggerGameover`는 제거한다 — `'gameover'` 상태는 도달 불가이고 이제 `'out'`이 그 자리를 쓴다.

- [ ] **Step 1: `src/hooks/useHaptic.ts`에서 `triggerGameover`를 `triggerOut`으로 바꾼다**

본문(`ImpactFeedbackStyle.Heavy` ×2, 150ms 간격)은 그대로 쓴다 — 보드 밖으로 날아가는 사건에 맞는 세기다.

- [ ] **Step 2: `src/screens/GameScreen.tsx`에 이벤트 → 피드백 매핑과 이펙트를 넣는다**

컴포넌트 밖에 매핑을 상수로 둔다. 햅틱은 함수 이름으로 적어 매핑이 선언적으로 읽히게 한다.

| `kind` | 효과음 | 햅틱 |
|---|---|---|
| `moved` | `move` | `triggerMove` (Light) |
| `blocked` | `wall` | `triggerWall` (Medium + Warning) |
| `out` | `out` | `triggerOut` (Heavy ×2) |
| `exit` | `clear` | `triggerClear` (Success) |
| `undo` | `undo` | 없음 |
| `hint` | `hint` | 없음 |

이펙트의 deps는 **`state.lastEvent.seq` 하나**다. `seq === 0`이면 아무것도 하지 않고 반환한다(새 보드). 이 구조가 업데이터 중복 호출로 인한 중복 재생을 막는다.

- [ ] **Step 3: 기존 `status` 이펙트를 정리한다**

`GameScreen.tsx:49-59`의 이펙트에서 `playSfx('clear')`·`haptic.triggerClear()`·`playSfx('gameover')`·`haptic.triggerGameover()` 호출을 뺀다 — 새 매핑이 그 일을 한다. `state.status === 'cleared'`일 때 `handleClear()`를 부르는 부분은 남긴다(기록 저장은 피드백이 아니다). `'gameover'` 분기는 도달 불가이므로 지운다.

`handleHint`/`handleUndo`의 `playSfx` 직접 호출도 뺀다 — `'hint'`/`'undo'` 이벤트가 대신한다.

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: 통과. `triggerGameover` 참조가 남아 있으면 여기서 잡힌다.

- [ ] **Step 5: 실제 앱에서 확인**

Run: `npm run web`
확인: 벽에 막히는 방향을 누르면 (소리 파일이 아직 없으므로) 콘솔 오류 없이 조용히 넘어간다. 안드로이드 기기나 에뮬레이터가 있으면 벽 충돌 진동이 이동 진동과 다르게 느껴지는지 본다. 같은 방향을 벽에 대고 연속으로 눌러도 매번 반응하는지 확인한다.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useHaptic.ts src/screens/GameScreen.tsx
git commit -m "feat: give every move an answer, walls included"
```

---

## Task 6: 설정 필드 정리, 영구 저장, 테마 단일화

**Files:**
- Modify: `src/types/game.ts` (`AppSettings`)
- Create: `src/logic/settings.ts`
- Modify: `src/storage/asyncStorage.ts`
- Modify: `src/context/SettingsContext.tsx`
- Modify: `src/context/ThemeContext.tsx`
- Modify: `App.tsx`
- Create: `src/components/ui/SfxToggleButton.tsx`
- Delete: `src/components/ui/BgmToggleButton.tsx`
- Modify: `src/screens/HomeScreen.tsx` (import 교체)
- Test: `src/logic/__tests__/settings.test.ts`

**Interfaces:**
- Consumes: Task 1의 `fixtures.ts`, `npm run test:logic`
- Produces:
  ```typescript
  // src/types/game.ts — 네 필드만 남는다
  export type AppSettings = {
    sfxOn: boolean;
    hapticOn: boolean;
    colorBlindMode: boolean;
    theme: 'dark' | 'light';
  };

  // src/logic/settings.ts — 순수, RN import 없음
  export const DEFAULT_SETTINGS: AppSettings;   // sfxOn/hapticOn true, colorBlindMode false, theme 'dark'
  export function mergeSettings(raw: unknown): AppSettings;

  // src/context/SettingsContext.tsx
  useSettings(): { settings: AppSettings; updateSettings: (p: Partial<AppSettings>) => void; hydrated: boolean };
  ```
  `useTheme()`의 반환 모양(`{ mode, theme, toggleTheme }`)은 바뀌지 않는다 — 기존 소비자를 건드리지 않기 위함이다.

- [ ] **Step 1: 실패하는 테스트 작성** — `src/logic/__tests__/settings.test.ts`

Review Focus 1번과 2번이 여기 있다.

```typescript
test('mergeSettings는 null에 대해 기본값을 준다', () => {
  assert.deepStrictEqual(mergeSettings(null), DEFAULT_SETTINGS);
});

test('mergeSettings는 모르는 키를 버린다', () => {
  const merged = mergeSettings({ bgmOn: false, animationSpeed: 'fast', sfxOn: false });
  assert.strictEqual(merged.sfxOn, false);
  assert.strictEqual(Object.keys(merged).length, 4);
  assert.ok(!('bgmOn' in merged));
});

test('mergeSettings는 빠진 키를 기본값으로 채운다', () => {
  const merged = mergeSettings({ sfxOn: false });
  assert.strictEqual(merged.sfxOn, false);
  assert.strictEqual(merged.hapticOn, DEFAULT_SETTINGS.hapticOn);
  assert.strictEqual(merged.theme, DEFAULT_SETTINGS.theme);
});

test('mergeSettings는 타입이 틀린 값을 기본값으로 되돌린다', () => {
  const merged = mergeSettings({ sfxOn: 'yes', theme: 'blue' });
  assert.strictEqual(merged.sfxOn, DEFAULT_SETTINGS.sfxOn);
  assert.strictEqual(merged.theme, DEFAULT_SETTINGS.theme);
});

test('mergeSettings는 객체가 아닌 입력에도 기본값을 준다', () => {
  for (const raw of [undefined, 42, 'x', []]) {
    assert.deepStrictEqual(mergeSettings(raw), DEFAULT_SETTINGS);
  }
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

Run: `npm run test:logic`
Expected: `src/logic/settings`를 찾을 수 없어 FAIL

- [ ] **Step 3: `src/types/game.ts`의 `AppSettings`에서 `bgmOn`과 `animationSpeed`를 지운다**

- [ ] **Step 4: `src/logic/settings.ts` 구현**

`mergeSettings`는 세 불린 필드를 `typeof === 'boolean'`일 때만, `theme`은 `'dark'`/`'light'`일 때만 받아들이고 그 외에는 기본값을 쓴다. 반환 객체는 네 필드만 담는다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test:logic`
Expected: 새 5개 포함 전부 PASS

- [ ] **Step 6: `src/storage/asyncStorage.ts`의 `loadSettings`가 `mergeSettings`를 거치게 한다**

반환 타입이 `AppSettings | null`에서 `AppSettings`로 바뀐다 — 읽기 실패나 빈 값도 기본값으로 수렴하므로 호출부에 `null` 분기가 필요 없다. `catch`에서도 `mergeSettings(null)`을 반환한다.

- [ ] **Step 7: `src/context/SettingsContext.tsx`에 저장과 hydration을 넣는다**

`useState`의 초기값은 `DEFAULT_SETTINGS`. 마운트 시 `loadSettings()`를 불러 state에 넣고, **`finally`에서 `hydrated`를 `true`로 세운다** — 읽기가 던져도 게이트가 열려야 한다(Review Focus 2). `updateSettings`는 state를 갱신하고 같은 값을 `saveSettings`로 쓴다. 컨텍스트 값에 `hydrated`를 추가한다. 기본 컨텍스트 값의 `hydrated`는 `true`로 둔다 — 프로바이더 밖에서 쓰일 때 화면이 영구히 막히지 않게.

- [ ] **Step 8: `src/context/ThemeContext.tsx`가 설정에서 읽게 한다**

자체 `useState`를 없애고 `mode`는 `settings.theme`, `toggleTheme`은 `updateSettings({ theme: ... })`를 부른다. `App.tsx`가 이미 `SettingsProvider` > `ThemeProvider` 순서라 구조 변경은 없다.

- [ ] **Step 9: `App.tsx`의 `AppContent`에 hydration 게이트를 넣는다**

`useSettings()`의 `hydrated`가 거짓이면 `DARK_THEME.bg` 색으로 칠한 `flex: 1` View만 반환한다. hydration 전에는 저장된 테마를 알 수 없으므로 기본값 외에 칠할 색이 없다.

- [ ] **Step 10: `BgmToggleButton`을 `SfxToggleButton`으로 교체한다**

`src/components/ui/SfxToggleButton.tsx`를 만들어 `settings.sfxOn`을 토글한다. 아이콘은 켜짐/꺼짐이 한눈에 구분되는 것을 쓴다(예: `🔊`/`🔇`) — 기존 `♪`/`♪̶`는 꺼진 상태가 거의 똑같이 보인다. `src/components/ui/BgmToggleButton.tsx`를 지우고 `src/screens/HomeScreen.tsx`의 import와 사용처를 바꾼다.

- [ ] **Step 11: 전체 게이트 확인**

Run: `npm run test:logic && npx tsc --noEmit && npm run check:mapgen && npm run build:web && npm run check:layout`
Expected: 전부 통과. `bgmOn`/`animationSpeed`를 쓰는 곳이 남아 있으면 타입체크가 잡는다.

- [ ] **Step 12: 실제 앱에서 확인**

Run: `npm run web`
확인: 소리 토글을 끄고 새로고침하면 여전히 꺼져 있다. 테마를 바꾸고 새로고침하면 유지되고, **기본값 dark가 한 프레임 보이지 않는다**. 시크릿 창에서도 앱이 정상적으로 뜬다(Review Focus 2).

- [ ] **Step 13: Commit**

```bash
git add src/types/game.ts src/logic/settings.ts src/logic/__tests__/settings.test.ts src/storage/asyncStorage.ts src/context/ App.tsx src/components/ui/SfxToggleButton.tsx src/screens/HomeScreen.tsx
git rm src/components/ui/BgmToggleButton.tsx
git commit -m "feat: make settings real -- wired, merged and remembered"
```

---

## Task 7: 설정 모달과 진입점 두 곳

**Files:**
- Create: `src/components/ui/SettingsModal.tsx`
- Modify: `src/components/ui/PauseMenu.tsx`
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `src/screens/GameScreen.tsx`

**Interfaces:**
- Consumes: Task 6의 `useSettings()`, `useTheme()`
- Produces: `SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void })`

- [ ] **Step 1: `src/components/ui/SettingsModal.tsx` 작성**

토글 4개를 담는다. 라벨은 한국어로 앱의 나머지와 맞춘다.

| 라벨 | 필드 |
|---|---|
| 효과음 | `sfxOn` |
| 진동 | `hapticOn` |
| 색약 모드 | `colorBlindMode` |
| 밝은 테마 | `theme` (`'light'`인지로 on/off) |

`Platform.OS === 'web'`일 때 **진동 토글은 렌더하지 않는다** — `expo-haptics`가 웹에서 동작하지 않으므로 아무 일도 하지 않는 토글을 보여주면 BGM 버튼과 같은 혼동이 된다.

모달 스타일은 기존 `PauseMenu`를 따른다 — `Modal transparent animationType="fade"`, `rgba(0,0,0,0.6)` 오버레이, `theme.surface` 배경의 280px 카드, `borderRadius: 20`, `padding: 32`. 토글 행은 `ClearModal`의 `statRow`(라벨 왼쪽, 값 오른쪽, `flexDirection: 'row'`, `justifyContent: 'space-between'`)를 따른다. 닫기 버튼을 하나 둔다. `testID="settings-modal"`을 붙인다.

- [ ] **Step 2: `src/components/ui/PauseMenu.tsx`에 "설정" 버튼을 넣는다**

`onSettings: () => void` prop을 받아 "다시하기"와 "홈으로" 사이에 `theme.dpad` 색 버튼으로 넣는다. 모달 중첩을 피하려고 `PauseMenu` 안에서 `SettingsModal`을 렌더하지 않는다 — 부모가 띄운다.

- [ ] **Step 3: `src/screens/GameScreen.tsx`에서 모달을 연결한다**

`settingsOpen` state를 두고 `PauseMenu`의 `onSettings`로 켠다. `SettingsModal`을 `PauseMenu`와 형제로 렌더한다. 일시정지 상태는 유지한다 — 설정을 닫으면 일시정지 메뉴로 돌아온다.

- [ ] **Step 4: `src/screens/HomeScreen.tsx`의 상단바에 ⚙ 버튼을 넣는다**

`SfxToggleButton` 다음, 버전 텍스트 앞에 둔다. `settingsOpen` state와 `SettingsModal`을 추가한다. 상단바의 소리·테마 버튼은 빠른 접근용으로 남긴다 — 둘 다 같은 설정을 가리키므로 모달에서 바꾸면 버튼 상태도 따라 바뀐다.

- [ ] **Step 5: 전체 게이트 확인**

Run: `npm run test:logic && npx tsc --noEmit && npm run check:mapgen && npm run build:web && npm run check:layout`
Expected: 전부 통과.

- [ ] **Step 6: 실제 앱에서 확인**

Run: `npm run web`
확인:
- 설정 모달이 홈의 ⚙와 일시정지 메뉴의 "설정" 양쪽에서 열린다.
- 토글 3개가 각각 동작한다(웹이므로 진동 토글은 보이지 않는다). 색약 모드를 켜면 탈출구에 ★가 뜬다.
- 모달에서 소리를 끄면 홈 상단바의 아이콘도 꺼진 상태로 바뀐다.
- 각 토글을 끄고 새로고침하면 모두 유지된다.
- 일시정지 중 설정을 바꾸고 닫으면 일시정지 메뉴로 돌아오고, 계속하기를 누르면 바뀐 설정이 적용되어 있다.
- 브라우저 창을 360x640으로 좁혀도 설정 모달이 화면을 넘지 않는다.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/SettingsModal.tsx src/components/ui/PauseMenu.tsx src/screens/
git commit -m "feat: add a settings modal, reachable from home and mid-game"
```

---

## 완료 조건

스펙 §8의 검증 항목이다. 마지막 태스크 후 한 번 더 전체를 돌린다.

- [ ] `npm run test:logic` — 로직 테스트 전부 통과
- [ ] `npx tsc --noEmit` — 통과
- [ ] `npm run check:mapgen` — "all map generator invariants hold"
- [ ] `npm run build:web && npm run check:layout` — 통과
- [ ] 수동: 벽 충돌이 이동과 구별된다 / 설정 4개가 동작하고 재시작 후에도 유지된다 / 첫 프레임에 테마가 번쩍이지 않는다 / 사운드 파일 없이도 정상 동작한다
- [ ] 사운드 파일이 준비되면 `src/audio/sfxAssets.ts`의 해당 키를 `require(...)`로 연결한다 (예상된 후속 작업)
