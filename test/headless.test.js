import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { TUNING as T } from '../src/tuning.js';

const CLI = resolve('src/headless.js');
const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
let n = 0;

function run({ seed = 1, scenario, frames, ticks, every, raw } = {}) {
  const id = ++n;
  const out = join(dir, `o${id}.jsonl`);
  const args = [CLI, '--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out];
  if (scenario !== undefined) { const f = join(dir, `s${id}.json`); writeFileSync(f, raw ? scenario : JSON.stringify(scenario)); args.push('--scenario', f); }
  if (frames !== undefined) { const f = join(dir, `i${id}.json`); writeFileSync(f, raw ? frames : JSON.stringify({ frames })); args.push('--inputs', f); }
  if (every) args.push('--snapshot-every', String(every));
  const r = spawnSync('node', args, { encoding: 'utf8' });
  let lines = [];
  try { lines = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l)); } catch { /* error run */ }
  return { r, lines, out,
    snaps: lines.filter((l) => l.type === 'snapshot'),
    events: lines.filter((l) => l.type === 'event'),
    end: lines.at(-1) };
}
const empty = { random_motes: false, random_shades: false, motes: [], shades: [] };
const last = (a) => a.at(-1);

test('exit 0, tick-0 snapshot, end line, exactly N steps', () => {
  const { r, snaps, end } = run({ scenario: empty, ticks: 100, every: 10 });
  assert.equal(r.status, 0);
  assert.equal(snaps[0].tick, 0);
  assert.equal(snaps[0].time_left_s, T.night1_duration_s);
  assert.deepEqual(snaps[0].player.pos, [0, 0, 0]);
  assert.equal(end.type, 'end'); assert.equal(end.ticks, 100); assert.equal(end.state, 'playing');
  assert.equal(snaps.length, 11); // 0,10,...,100
  assert.equal(last(snaps).time_left_s, T.night1_duration_s - 100 / 60 > 0 ? Math.round((T.night1_duration_s - 100 / 60) * 1000) / 1000 : 0);
});

test('deterministic: same seed/scenario/inputs -> identical bytes; seeds differ', () => {
  const frames = [{ tick: 0, move: [0.3, 1] }];
  const a = run({ seed: 7, frames, ticks: 1500 });
  const b = run({ seed: 7, frames, ticks: 1500 });
  assert.equal(readFileSync(a.out, 'utf8'), readFileSync(b.out, 'utf8'));
  const c = run({ seed: 8, frames, ticks: 1500 });
  assert.notEqual(readFileSync(a.out, 'utf8'), readFileSync(c.out, 'utf8'));
});

test('movement: speed, cam_yaw rotation, normalisation of long vectors', () => {
  let s = run({ scenario: empty, frames: [{ tick: 0, move: [0, 1] }], ticks: 60 }).snaps.at(-1);
  assert.deepEqual(s.player.pos, [0, 0, T.player_speed]);
  s = run({ scenario: empty, frames: [{ tick: 0, move: [1, 0] }], ticks: 60 }).snaps.at(-1);
  assert.deepEqual(s.player.pos, [T.player_speed, 0, 0]);
  s = run({ scenario: empty, frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }], ticks: 60 }).snaps.at(-1);
  assert.ok(Math.abs(s.player.pos[0] - T.player_speed) < 1e-3 && Math.abs(s.player.pos[2]) < 1e-3, JSON.stringify(s.player.pos));
  // validation rejects |component|>1, so normalisation is exercised with 1,1 (length sqrt2)
  s = run({ scenario: empty, frames: [{ tick: 0, move: [1, 1] }], ticks: 60 }).snaps.at(-1);
  const d = Math.hypot(...s.player.pos.filter((_, i) => i !== 1));
  assert.ok(Math.abs(d - T.player_speed) < 1e-2, `distance ${d}`);
});

test('jump is edge triggered and returns to ground', () => {
  const { snaps } = run({ scenario: empty, frames: [{ tick: 0, jump: true }], ticks: 60, every: 5 });
  assert.ok(Math.max(...snaps.map((s) => s.player.pos[1])) > 0.5);
  assert.equal(last(snaps).player.pos[1], 0);
});

test('mote pickup: event, carried, score, capacity limit', () => {
  const motes = [[0, 0, 0.2], [0, 0, 0.4], [0, 0, 0.6], [0, 0, 0.8], [0, 0, 1.0], [0, 0, 1.2], [20, 0, 20]];
  const { events, snaps } = run({ scenario: { ...empty, motes }, ticks: 5 });
  const picks = events.filter((e) => e.name === 'mote_picked');
  assert.deepEqual(picks.map((e) => e.data.carried), [1, 2, 3, 4, 5]); // capped at carry_capacity
  assert.equal(last(snaps).player.carried, T.carry_capacity);
  assert.equal(last(snaps).score, 5 * T.score.per_mote);
  assert.equal(last(snaps).motes_active, 2);
  assert.ok(picks.every((e) => e.tick === 1)); // step 0 produces state 1, events tagged 1
});

test('pickup radius boundary: <= radius picks, just outside does not', () => {
  const inside = run({ scenario: { ...empty, motes: [[0, 0, T.pickup_radius]] }, ticks: 1 });
  assert.equal(inside.events.length, 1);
  const outside = run({ scenario: { ...empty, motes: [[0, 0, T.pickup_radius + 0.01]] }, ticks: 1 });
  assert.equal(outside.events.length, 0);
});

test('deposit and lighting a lantern, score, then win with bonuses', () => {
  const lanterns = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const sc = { ...empty, player: { pos: [0, 0, 24], carried: 5, flames: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 25], deposited: 3 }, ...lanterns], time_left_s: 100 };
  const { events, end, snaps } = run({ scenario: sc, frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }], ticks: 10 });
  assert.deepEqual(events.map((e) => e.name), ['deposit', 'lantern_lit', 'game_over']);
  assert.deepEqual(events[0].data, { lantern_id: 'L1', amount: 5, deposited: 8 });
  assert.deepEqual(events[2].data, { result: 'won', reason: 'all_lit' });
  const s = T.score;
  const timeLeft = 100 - 1 / 60; // floor -> 99
  assert.equal(end.state, 'won');
  assert.equal(end.ticks, 1); // stops when the game ends
  assert.equal(end.score, s.per_lantern + s.per_second_left * Math.floor(timeLeft) + s.per_flame_left * 2);
  assert.equal(last(snaps).state, 'won');
});

test('scenario setup emits no events and awards no points (pre-lit lanterns)', () => {
  const { events, snaps } = run({ scenario: { ...empty, lanterns: [{ id: 'L1', lit: true }] }, ticks: 30 });
  assert.equal(events.length, 0);
  assert.equal(snaps[0].score, 0);
  assert.equal(snaps[0].lanterns[0].lit, true);
});

test('interact is edge triggered and needs range', () => {
  const far = run({ scenario: { ...empty, player: { pos: [0, 0, 0], carried: 5 } }, frames: [{ tick: 0, interact: true }], ticks: 3 });
  assert.equal(far.events.length, 0);
  const held = run({ scenario: { ...empty, player: { pos: [0, 0, 24], carried: 3 } }, frames: [{ tick: 0, interact: true }], ticks: 30 });
  assert.equal(held.events.filter((e) => e.name === 'deposit').length, 1); // holding does not repeat
});

test('pulse: costs light, stuns/pushes shades in radius, cooldown, events', () => {
  const sc = { ...empty, player: { pos: [0, 0, 0], carried: 3 }, shades: [{ id: 'S1', pos: [5, 1, 0] }, { id: 'S2', pos: [20, 1, 0] }] };
  const frames = [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }, { tick: 3, pulse: false }];
  const { events, snaps } = run({ scenario: sc, frames, ticks: 5, every: 1 });
  const pulses = events.filter((e) => e.name === 'pulse');
  assert.equal(pulses.length, 1); // second pulse blocked by cooldown
  assert.deepEqual(pulses[0].data.stunned_ids, ['S1']);
  const s1 = snaps[1].shades.find((s) => s.id === 'S1');
  assert.equal(s1.state, 'stunned');
  assert.ok(Math.abs(s1.pos[0] - (5 + T.pulse_push_m)) < 1e-3);
  assert.equal(snaps[1].player.carried, 3 - T.pulse_cost);
  assert.equal(snaps[1].score, T.score.per_stun);
  assert.equal(snaps[1].shades.find((s) => s.id === 'S2').state, 'chase');
});

test('pulse with no light is a no-op; stun wears off', () => {
  const sc = { ...empty, player: { carried: 0 }, shades: [{ pos: [4, 1, 0] }] };
  assert.equal(run({ scenario: sc, frames: [{ tick: 0, pulse: true }], ticks: 3 }).events.length, 0);
  const sc2 = { ...empty, player: { carried: 2 }, shades: [{ pos: [4, 1, 0] }] };
  const { snaps } = run({ scenario: sc2, frames: [{ tick: 0, pulse: true }], ticks: Math.round(T.pulse_stun_s * 60) + 2, every: 1 });
  assert.equal(snaps[1].shades[0].state, 'stunned');
  assert.equal(last(snaps).shades[0].state, 'chase');
});

test('shade chases at shade_speed', () => {
  const { snaps } = run({ scenario: { ...empty, shades: [{ pos: [20, 1, 0] }] }, ticks: 60 });
  assert.ok(Math.abs(last(snaps).shades[0].pos[0] - (20 - T.shade_speed)) < 1e-2);
  assert.equal(last(snaps).shades[0].state, 'chase');
});

test('hit: flame lost, drop ratio, invulnerability, no hit while stunned', () => {
  const sc = { ...empty, player: { carried: 4 }, shades: [{ pos: [T.shade_hit_radius, 1, 0] }] };
  const { events, snaps } = run({ scenario: sc, ticks: 60 });
  const hits = events.filter((e) => e.name === 'player_hit');
  assert.equal(hits.length, 1); // invuln_s (2s) covers the remaining steps
  assert.deepEqual(hits[0].data, { by: 'shade', flames: T.flames - 1, dropped: Math.floor(4 * T.hit_drop_ratio) });
  assert.equal(last(snaps).player.carried, 4 - 2);
  assert.equal(last(snaps).motes_active, 2); // dropped motes lie on the island
  const long = run({ scenario: sc, ticks: Math.round(T.invuln_s * 60) + 5 });
  assert.equal(long.events.filter((e) => e.name === 'player_hit').length, 2); // hit again after invuln
  const stunned = run({ scenario: { ...empty, player: { carried: 1 }, shades: [{ pos: [T.shade_hit_radius, 1, 0] }] }, frames: [{ tick: 0, pulse: true }], ticks: 30 });
  assert.equal(stunned.events.filter((e) => e.name === 'player_hit').length, 0);
});

test('lose by no_flames; lose by dawn', () => {
  const l = run({ scenario: { ...empty, player: { flames: 1 }, shades: [{ pos: [1, 1, 0] }] }, ticks: 100 });
  assert.deepEqual(l.events.map((e) => e.name), ['player_hit', 'game_over']);
  assert.deepEqual(l.events[1].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(l.end.state, 'lost'); assert.equal(l.end.ticks, 1);
  const d = run({ scenario: { ...empty, time_left_s: 1 }, ticks: 600 });
  assert.deepEqual(last(d.events).data, { result: 'lost', reason: 'dawn' });
  assert.equal(d.end.ticks, 60); assert.equal(d.end.state, 'lost');
  assert.equal(last(d.snaps).time_left_s, 0);
});

test('safe_radius: shades cannot enter a lit lantern radius', () => {
  const sc = { ...empty, player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [12, 1, 25] }] };
  const { snaps } = run({ scenario: sc, ticks: 300, every: 1 });
  for (const s of snaps) {
    const d = Math.hypot(s.shades[0].pos[0] - 0, s.shades[0].pos[2] - 25);
    assert.ok(d >= T.safe_radius - 1e-2, `shade entered safe radius: ${d}`);
  }
});

test('random shades spawn with events, deterministic ids; random_shades:false spawns none', () => {
  const a = run({ scenario: { random_motes: false, player: { flames: 99 } }, ticks: 60 * 45 });
  const sp = a.events.filter((e) => e.name === 'shade_spawned');
  assert.ok(sp.length >= 1); assert.match(sp[0].data.id, /^S\d+$/);
  assert.equal(run({ scenario: { ...empty, player: { flames: 99 } }, ticks: 60 * 45 }).events.filter((e) => e.name === 'shade_spawned').length, 0);
});

test('malformed inputs/scenario -> exit 2 with stderr; other errors non-zero', () => {
  const bad = [
    { frames: '{not json', raw: true },
    { frames: [{ tick: 5 }, { tick: 5 }] },
    { frames: [{ tick: 5 }, { tick: 2 }] },
    { frames: [{ tick: 0, move: [0, 2] }] },
    { frames: [{ tick: 0, jump: 'yes' }] },
    { scenario: '[1,2]', raw: true },
    { scenario: { motes: [[1, 2]] } },
    { scenario: { player: { flames: -1 } } },
  ];
  for (const b of bad) {
    const x = run({ ...b, ticks: 5 });
    assert.equal(x.r.status, 2, JSON.stringify(b));
    assert.ok(x.r.stderr.length > 0);
  }
  const miss = spawnSync('node', [CLI, '--seed', '1', '--night', '1', '--ticks', '5'], { encoding: 'utf8' });
  assert.notEqual(miss.status, 0); assert.ok(miss.stderr.length > 0);
});

test('game.contract.json mirrors the tuning the game actually uses', () => {
  const c = JSON.parse(readFileSync('game.contract.json', 'utf8'));
  assert.equal(c.contract_version, '1.0');
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) assert.equal(typeof c[k], 'string');
  assert.deepEqual(c.tuning, T);
  assert.equal(c.tuning.lantern_count_night1, 5);
});
