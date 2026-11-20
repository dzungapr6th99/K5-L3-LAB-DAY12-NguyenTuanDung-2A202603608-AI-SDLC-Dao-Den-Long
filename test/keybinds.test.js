// Ticket-04 section 4: key rebinding rules (conflict detection, reserved keys, defaults, validation of stored data).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, DEFAULT_KEYS, RESERVED, assignKey, conflictOf, normalizeKeys, findDuplicates, keyLabel } from '../src/keybinds.js';

test('every required action can be rebound: 4 move directions, jump, dash, interact, pulse, pause', () => {
  assert.deepEqual(ACTIONS.map((a) => a.id), ['forward', 'back', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause']);
  assert.deepEqual(Object.keys(DEFAULT_KEYS), ACTIONS.map((a) => a.id));
  assert.deepEqual(findDuplicates(DEFAULT_KEYS), []); // the defaults are consistent
  for (const a of ACTIONS) {
    const r = assignKey(DEFAULT_KEYS, a.id, 'KeyZ');
    assert.equal(r.ok, true, a.id);
    assert.equal(r.keys[a.id], 'KeyZ');
    for (const other of ACTIONS) if (other.id !== a.id) assert.equal(r.keys[other.id], DEFAULT_KEYS[other.id]);
  }
});

test('assignKey does not mutate its input', () => {
  const keys = { ...DEFAULT_KEYS }, copy = JSON.stringify(keys);
  assignKey(keys, 'jump', 'KeyZ'); assignKey(keys, 'jump', 'KeyW');
  assert.equal(JSON.stringify(keys), copy);
});

test('a key already used by another action is refused and the clashing action is named', () => {
  const r = assignKey(DEFAULT_KEYS, 'jump', 'KeyE');
  assert.deepEqual(r, { ok: false, reason: 'conflict', with: 'Nạp đèn / châm dầu' });
  assert.equal(conflictOf(DEFAULT_KEYS, 'KeyF', 'jump'), 'pulse');
  assert.equal(conflictOf(DEFAULT_KEYS, 'KeyF', 'pulse'), null); // re-pressing its own key is not a clash
  assert.equal(assignKey(DEFAULT_KEYS, 'pulse', 'KeyF').ok, true);
  // after freeing the key, the other action can take it: a swap takes two steps
  const step1 = assignKey(DEFAULT_KEYS, 'interact', 'KeyG').keys;
  assert.equal(assignKey(step1, 'jump', 'KeyE').ok, true);
});

test('fixed keys (camera arrows, R restart, Enter) cannot be assigned', () => {
  for (const code of Object.keys(RESERVED)) {
    const r = assignKey(DEFAULT_KEYS, 'jump', code);
    assert.equal(r.ok, false, code); assert.equal(r.reason, 'reserved'); assert.ok(r.with.length > 0);
  }
  assert.equal(assignKey(DEFAULT_KEYS, 'jump', '').ok, false);
  assert.equal(assignKey(DEFAULT_KEYS, 'nope', 'KeyZ').ok, false);
});

test('"Khôi phục mặc định": normalizeKeys falls back to the defaults for missing, duplicated or reserved data', () => {
  assert.deepEqual(normalizeKeys(undefined), DEFAULT_KEYS);
  assert.deepEqual(normalizeKeys(null), DEFAULT_KEYS);
  assert.deepEqual(normalizeKeys('x'), DEFAULT_KEYS);
  const custom = { ...DEFAULT_KEYS, jump: 'KeyZ', dash: 'KeyX' };
  assert.deepEqual(normalizeKeys(custom), custom); // valid custom bindings are kept
  assert.deepEqual(normalizeKeys({ ...DEFAULT_KEYS, jump: 'KeyE' }), DEFAULT_KEYS); // duplicate
  assert.deepEqual(normalizeKeys({ ...DEFAULT_KEYS, jump: 'ArrowLeft' }), DEFAULT_KEYS); // reserved
  assert.equal(normalizeKeys({ jump: 'KeyZ' }).jump, 'KeyZ');
  assert.equal(normalizeKeys({ jump: 'KeyZ' }).forward, 'KeyW'); // missing entries use the default
  assert.deepEqual(findDuplicates({ ...DEFAULT_KEYS, dash: 'KeyW' }), [['forward', 'dash']]);
});

test('key labels are readable', () => {
  assert.equal(keyLabel('KeyW'), 'W'); assert.equal(keyLabel('Digit3'), '3'); assert.equal(keyLabel('Space'), 'Space');
  assert.equal(keyLabel('Escape'), 'Esc'); assert.equal(keyLabel('ShiftLeft'), 'Shift trái'); assert.equal(keyLabel('ArrowUp'), '↑');
  assert.equal(keyLabel('Numpad5'), 'Num 5'); assert.equal(keyLabel('F5'), 'F5');
});
