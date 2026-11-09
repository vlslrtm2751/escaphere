import test from 'node:test';
import assert from 'node:assert';
import { mergeSettings, DEFAULT_SETTINGS } from '../settings';

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

// theme의 거부 경로(빠진 값, 잘못된 값)는 위에서 이미 고정했다. 수락 경로도
// 대칭적으로 고정해 둔다 -- 그렇지 않으면 저장된 'light'가 되돌려질 때
// 조용히 기본값(dark)으로 리그레션해도 테스트가 잡아내지 못한다.
test('mergeSettings는 유효하게 저장된 theme 값을 그대로 유지한다', () => {
  assert.strictEqual(mergeSettings({ theme: 'light' }).theme, 'light');
});

test('mergeSettings는 객체가 아닌 입력에도 기본값을 준다', () => {
  for (const raw of [undefined, 42, 'x', []]) {
    assert.deepStrictEqual(mergeSettings(raw), DEFAULT_SETTINGS);
  }
});

// Review Focus 1: hydration의 실패/빈 읽기는 반드시 mergeSettings(null)로 수렴한다.
// 그 경로가 절대 throw하지 않고, undefined를 반환하지도 않는다는 것을 명시적으로 고정한다 —
// 그래야 SettingsContext의 마운트 effect가 finally에서 hydrated를 true로 세워도 안전하다.
test('mergeSettings는 읽기 실패/빈 값을 흉내낸 입력에도 절대 throw하지 않고 undefined도 반환하지 않는다', () => {
  assert.doesNotThrow(() => mergeSettings(null));
  const merged = mergeSettings(null);
  assert.notStrictEqual(merged, undefined);
  assert.deepStrictEqual(merged, DEFAULT_SETTINGS);
});
