// Regression: every Phase 1 behaviour, re-checked under the Ticket-02 standard numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { TUNING as T } from '../src/tuning.js';
import { run, empty, last, dist, near, pressFrames, mergeFrames, CLI } from './helpers.js';

const sc = (o = {}) => ({ ...empty, ...o });

test('exit 0, tick-0 snapshot, end line, exactly N steps, v1.1 snapshot fields', () => {
  const x = run({ scenario: sc(), ticks: 100 });
  assert.equal(x.r.status, 0);
  const s0 = x.snaps[0];
  assert.equal(s0.tick, 0); assert.equal(s0.sim_tick, 0); assert.equal(s0.night, 1);
  assert.equal(s0.time_left_s, 300);
  assert.deepEqual(s0.player.pos, [0, 0, 0]);
  assert.deepEqual(Object.keys(s0.wind), ['active', 'dir_deg']);
  for (const k of ['pos', 'vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s', 'flames', 'carried']) assert.ok(k in s0.player, k);
  for (const k of ['motes', 'drifters', 'charms', 'lanterns', 'shades', 'motes_active']) assert.ok(Array.isArray(s0[k]) || typeof s0[k] === 'number', k);
  assert.equal(x.end.type, 'end'); assert.equal(x.end.ticks, 100); assert.equal(x.end.state, 'playing');
  assert.equal(x.snaps.length, 11);
  assert.equal(last(x.snaps).time_left_s, Math.round((300 - 100 / 60) * 1000) / 1000);
  assert.equal(x.ev('night_start')[0].tick, 1);
});

test('deterministic per night: same seed/scenario/inputs -> identical bytes; seeds differ', () => {
  for (const night of [1, 2, 3]) {
    const frames = [{ tick: 0, move: [0.3, 1] }];
    const a = run({ seed: 7, night, frames, ticks: 2500 });
    const b = run({ seed: 7, night, frames, ticks: 2500 });
    assert.equal(readFileSync(a.out, 'utf8'), readFileSync(b.out, 'utf8'), `night ${night}`);
    assert.notEqual(readFileSync(a.out, 'utf8'), readFileSync(run({ seed: 8, night, frames, ticks: 2500 }).out, 'utf8'));
  }
});

test('movement: 6.0 m/s, full air control, camera yaw, normalised diagonals', () => {
  let s = run({ scenario: sc(), frames: [{ tick: 0, move: [0, 1] }], ticks: 60 }).snaps.at(-1);
  assert.deepEqual(s.player.pos, [0, 0, 6]);
  assert.deepEqual(s.player.vel, [0, 0, 6]);
  s = run({ scenario: sc(), frames: [{ tick: 0, move: [1, 0] }], ticks: 60 }).snaps.at(-1);
  assert.deepEqual(s.player.pos, [6, 0, 0]);
  s = run({ scenario: sc(), frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }], ticks: 60 }).snaps.at(-1);
  near(s.player.pos[0], 6, 1e-3); near(s.player.pos[2], 0, 1e-3);
  s = run({ scenario: sc(), frames: [{ tick: 0, move: [1, 1] }], ticks: 60 }).snaps.at(-1);
  near(Math.hypot(s.player.pos[0], s.player.pos[2]), 6, 1e-2);
  // stops within 0.1 s: velocity is zero the tick after input stops
  const st = run({ scenario: sc(), frames: [{ tick: 0, move: [0, 1] }, { tick: 10, move: [0, 0] }], ticks: 16, every: 1 });
  assert.deepEqual(st.snap(16).player.vel, [0, 0, 0]);
});

test('jump: 7 m/s, gravity -20, only from the ground, full air control', () => {
  const x = run({ scenario: sc(), frames: pressFrames('jump', [0, 10], [{ tick: 0, move: [1, 0] }]), ticks: 60, every: 1 });
  const ys = x.snaps.map((s) => s.player.pos[1]);
  const apex = Math.max(...ys);
  assert.ok(apex > 1.15 && apex < 1.26, `apex ${apex}`); // v^2 / 2g = 1.225; second press mid-air ignored
  assert.equal(x.snap(60).player.pos[1], 0);
  assert.equal(x.snap(60).player.grounded, true);
  assert.equal(x.snap(5).player.grounded, false);
  assert.ok(x.snap(30).player.pos[0] > 2.9, 'steers in the air'); // 0.5 s * 6 m/s
});

test('mote pickup: radius 1.0 XZ, height diff <= 1.5, capacity 10, no score on pickup', () => {
  const inside = run({ scenario: sc({ motes: [[0, 0, 1.0]] }), ticks: 1 });
  assert.equal(inside.ev('mote_picked').length, 1);
  assert.equal(run({ scenario: sc({ motes: [[0, 0, 1.01]] }), ticks: 1 }).ev('mote_picked').length, 0);
  assert.equal(run({ scenario: sc({ motes: [[0, 1.5, 0.5]] }), ticks: 1 }).ev('mote_picked').length, 1);
  assert.equal(run({ scenario: sc({ motes: [[0, 1.6, 0.5]] }), ticks: 1 }).ev('mote_picked').length, 0);
  const many = run({ scenario: sc({ motes: Array.from({ length: 12 }, (_, i) => [0, 0, 0.05 * i]) }), ticks: 3 });
  assert.deepEqual(many.ev('mote_picked').map((e) => e.data.carried), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(last(many.snaps).motes_active, 2);
  assert.equal(last(many.snaps).score, 0);
  assert.ok(many.ev('mote_picked').every((e) => e.tick === 1));
});

test('deposit: radius 2.0, partial deposits are remembered, +10 per mote, +100 per lantern', () => {
  const base = { player: { pos: [0, 0, 24], carried: 4 } };
  let x = run({ scenario: sc(base), frames: pressFrames('interact', [0]), ticks: 3 });
  assert.deepEqual(x.ev('deposit')[0].data, { lantern_id: 'L1', amount: 4, deposited: 4 });
  assert.equal(x.ev('lantern_lit').length, 0);
  assert.equal(last(x.snaps).score, 40);
  assert.equal(last(x.snaps).lanterns[0].deposited, 4);
  x = run({ scenario: sc({ player: { pos: [0, 0, 24], carried: 5 }, lanterns: [{ id: 'L1', deposited: 7 }] }), frames: pressFrames('interact', [0]), ticks: 3 });
  assert.deepEqual(x.ev('deposit')[0].data, { lantern_id: 'L1', amount: 3, deposited: 10 });
  assert.equal(x.ev('lantern_lit').length, 1);
  assert.equal(last(x.snaps).score, 30 + 100);
  assert.equal(last(x.snaps).player.carried, 2);
  // radius boundary
  const at = (z) => run({ scenario: sc({ player: { pos: [0, 0, 0], carried: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, z] }] }), frames: pressFrames('interact', [0]), ticks: 2 }).ev('deposit').length;
  assert.equal(at(2.0), 1); assert.equal(at(2.01), 0);
  // nearest wins; ties go to the smaller id
  x = run({ scenario: sc({ player: { carried: 1 }, lanterns: [{ id: 'L1', pos: [1, 0, 0] }, { id: 'L2', pos: [-1, 0, 0] }, { id: 'L3', pos: [0, 0, 0.5] }] }), frames: pressFrames('interact', [0]), ticks: 2 });
  assert.equal(x.ev('deposit')[0].data.lantern_id, 'L3');
  x = run({ scenario: sc({ player: { carried: 1 }, lanterns: [{ id: 'L1', pos: [1, 0, 0] }, { id: 'L2', pos: [-1, 0, 0] }] }), frames: pressFrames('interact', [0]), ticks: 2 });
  assert.equal(x.ev('deposit')[0].data.lantern_id, 'L1');
  // lit lanterns are ignored; interact is edge triggered
  x = run({ scenario: sc({ player: { pos: [0, 0, 24], carried: 3 }, lanterns: [{ id: 'L1', lit: true }] }), frames: pressFrames('interact', [0]), ticks: 3 });
  assert.equal(x.ev('deposit').length, 0);
  x = run({ scenario: sc({ player: { pos: [0, 0, 24], carried: 3 } }), frames: [{ tick: 0, interact: true }], ticks: 30 });
  assert.equal(x.ev('deposit').length, 1);
});

test('win: all lit, bonus floor(seconds)*2 + 50*flames; win on the exact timeout tick; setup is silent', () => {
  const lit = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const s = { player: { pos: [0, 0, 24], carried: 10, flames: 2 }, lanterns: [{ id: 'L1', deposited: 0 }, ...lit], time_left_s: 100 };
  const x = run({ scenario: sc(s), frames: pressFrames('interact', [0]), ticks: 10 });
  assert.deepEqual(x.events.map((e) => e.name), ['night_start', 'deposit', 'lantern_lit', 'game_over']);
  assert.deepEqual(x.ev('game_over')[0].data, { result: 'won', reason: 'all_lit' });
  assert.equal(x.end.state, 'won'); assert.equal(x.end.ticks, 1);
  assert.equal(x.end.score, 100 + 100 + 2 * 99 + 50 * 2);
  const tie = run({ scenario: sc({ ...s, player: { pos: [0, 0, 24], carried: 1, flames: 3 }, lanterns: [{ id: 'L1', deposited: 9 }, ...lit], time_left_s: 1 / 60 }), frames: pressFrames('interact', [0]), ticks: 5 });
  assert.equal(tie.end.state, 'won'); // lit on the very tick the clock hits 0
  assert.equal(tie.end.score, 10 + 100 + 0 + 150);
  const pre = run({ scenario: sc({ lanterns: [{ id: 'L1', lit: true }] }), ticks: 30 });
  assert.equal(pre.snaps[0].score, 0);
  assert.deepEqual(pre.events.map((e) => e.name), ['night_start']);
});

test('lose: dawn at time 0; no_flames always wins over a same-tick victory', () => {
  const d = run({ scenario: sc({ time_left_s: 1 }), ticks: 600 });
  assert.deepEqual(last(d.events).data, { result: 'lost', reason: 'dawn' });
  assert.equal(d.end.ticks, 60); assert.equal(last(d.snaps).time_left_s, 0);
  // a hit on the last flame beats a timeout that happens on the very same tick
  const both = run({ scenario: sc({ player: { flames: 1 }, shades: [{ pos: [0.9, 1, 0], state: 'chase' }], time_left_s: 1 / 60 }), ticks: 5 });
  assert.deepEqual(both.ev('game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(both.end.ticks, 1);
});

test('pulse: 3 motes, 3D radius 5 from feet+0.8, cooldown 3 s, stun 120 ticks, push 4 m in 15 ticks, +5 each', () => {
  const shades = [
    { id: 'S1', pos: [3, 1, 0] }, { id: 'S2', pos: [4.99, 0.8, 0] }, { id: 'S3', pos: [5.01, 0.8, 0] },
    { id: 'S4', pos: [0, 6, 0] }, { id: 'S5', pos: [0, 5.7, 0] },
  ];
  const x = run({ scenario: sc({ player: { carried: 10 }, shades }), frames: pressFrames('pulse', [0]), ticks: 125, every: 1 });
  assert.deepEqual(x.ev('pulse')[0].data.stunned_ids, ['S1', 'S2', 'S5']);
  assert.equal(x.snap(1).score, 15);
  assert.equal(x.snap(1).player.carried, 7);
  assert.equal(x.snap(1).player.pulse_cd_s, 3);
  near(x.snap(15).shades[0].pos[0], 7, 0.01, 'pushed 4 m after 15 ticks');
  assert.ok(x.snap(14).shades[0].pos[0] < 6.8);
  near(x.snap(60).shades[0].pos[0], 7, 0.01, 'stays put while stunned');
  assert.equal(x.snap(120).shades[0].state, 'stunned');
  assert.notEqual(x.snap(121).shades[0].state, 'stunned');
  assert.notEqual(x.snap(1).shades.find((s) => s.id === 'S3').state, 'stunned');
});

test('pulse: not enough light does nothing; cooldown blocks until tick 181; hits refresh stun; stunned shades are harmless', () => {
  const none = run({ scenario: sc({ player: { carried: 2 }, shades: [{ pos: [3, 1, 0] }] }), frames: pressFrames('pulse', [0]), ticks: 3 });
  assert.equal(none.ev('pulse').length, 0);
  assert.equal(none.snap(0).player.pulse_cd_s, 0);
  const sh = [{ id: 'S1', pos: [12, 1, 0] }];
  const x = run({ scenario: sc({ player: { carried: 10 }, shades: sh }), frames: pressFrames('pulse', [0, 180]), ticks: 190, every: 1 });
  assert.deepEqual(x.ev('pulse').map((e) => e.tick), [1, 181]);
  assert.deepEqual(run({ scenario: sc({ player: { carried: 10 }, shades: sh }), frames: pressFrames('pulse', [0, 179]), ticks: 190 }).ev('pulse').map((e) => e.tick), [1]); // still cooling down at tick 180
  const adj = run({ scenario: sc({ player: { carried: 3 }, shades: [{ pos: [0.5, 1, 0] }] }), frames: pressFrames('pulse', [0]), ticks: 60 });
  assert.equal(adj.ev('player_hit').length, 0); // stunned on tick 1 before it could touch
  const ref = run({ scenario: sc({ player: { carried: 10 }, shades: [{ pos: [4, 1, 0], state: 'stunned', state_ticks_left: 100 }] }), frames: pressFrames('pulse', [0]), ticks: 125, every: 1 });
  assert.equal(ref.snap(110).shades[0].state, 'stunned'); // would have ended at 100: the pulse refreshed it to 120
  assert.equal(ref.snap(120).shades[0].state, 'stunned'); assert.notEqual(ref.snap(121).shades[0].state, 'stunned');
  near(ref.snap(15).shades[0].pos[0], 8, 0.01, 'and pushed again');
  const lim = run({ scenario: sc({ shades: [{ pos: [8, 1, 0], state: 'stunned', state_ticks_left: 30 }] }), ticks: 40, every: 1 });
  assert.equal(lim.snap(29).shades[0].state, 'stunned'); assert.equal(lim.snap(31).shades[0].state, 'chase');
});

test('shade AI: detect 12 m / lose 18 m, 4.0 m/s (Night 3: 4.5), wander otherwise', () => {
  assert.equal(run({ scenario: sc({ shades: [{ pos: [11.9, 1, 0] }] }), ticks: 1 }).snap(1).shades[0].state, 'chase');
  assert.equal(run({ scenario: sc({ shades: [{ pos: [12.5, 1, 0] }] }), ticks: 1 }).snap(1).shades[0].state, 'wander');
  assert.equal(run({ scenario: sc({ shades: [{ pos: [18.5, 1, 0], state: 'chase' }] }), ticks: 1 }).snap(1).shades[0].state, 'wander');
  assert.equal(run({ scenario: sc({ shades: [{ pos: [17, 1, 0], state: 'chase' }] }), ticks: 1 }).snap(1).shades[0].state, 'chase');
  const c = run({ scenario: sc({ shades: [{ pos: [10, 1, 0], state: 'chase' }] }), ticks: 60 });
  near(last(c.snaps).shades[0].pos[0], 6, 0.01);
  const n3 = run({ night: 3, scenario: sc({ player: { pos: [0, 0, -15] }, shades: [{ pos: [10, 1, -15], state: 'chase' }] }), ticks: 60 });
  near(last(n3.snaps).shades[0].pos[0], 10 - 4.5, 0.01);
});

test('shade spawns: 2 at tick 300 then every 480 ticks (Night 1), max 6, ids in order, spawning state', () => {
  const x = run({ scenario: { random_motes: false, player: { flames: 99 } }, ticks: 3300, every: 1 });
  const sp = x.ev('shade_spawned');
  assert.deepEqual(sp.map((e) => e.tick), [300, 300, 780, 1260, 1740, 2220]);
  assert.deepEqual(sp.map((e) => e.data.id), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
  assert.equal(x.snap(299).shades.length, 0);
  assert.equal(x.snap(300).shades[0].state, 'spawning');
  assert.notEqual(x.snap(360).shades[0].state, 'spawning');
  assert.equal(last(x.snaps).shades.length, 6);
  for (const s of x.snap(300).shades) near(Math.hypot(s.pos[0], s.pos[2]), 37, 0.01);
  assert.equal(run({ scenario: sc({ player: { flames: 99 } }), ticks: 1000 }).ev('shade_spawned').length, 0);
});

test('being hit: -1 flame, floor(carried/2) drop on a 1.5-2.5 m ring (480 ticks), invuln 90, recoil 2 m, 1 hit per tick', () => {
  const s = sc({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [1, 1, 0], state: 'chase' }, { id: 'S2', pos: [0, 1, 1], state: 'chase' }] });
  const x = run({ scenario: s, ticks: 200, every: 1 });
  const hits = x.ev('player_hit');
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: 2 });
  assert.equal(hits[0].tick, 1);
  assert.ok(hits[1].tick >= 91, `second hit at ${hits[1].tick}`);
  assert.equal(x.snap(1).player.carried, 3);
  assert.equal(x.snap(1).player.invuln, 1.5);
  const dm = x.snap(1).motes;
  assert.equal(dm.length, 2);
  for (const m of dm) { assert.equal(m.kind, 'dropped'); assert.equal(m.ttl_s, 8); const d = dist(m.pos, [0, 0, 0]); assert.ok(d >= 1.49 && d <= 2.51, `ring ${d}`); }
  const one = run({ scenario: sc({ player: { carried: 5 }, shades: [{ pos: [1, 1, 0], state: 'chase' }] }), ticks: 62, every: 1 });
  assert.equal(one.snap(1).shades[0].state, 'recoil');
  near(dist(one.snap(61).shades[0].pos, [0, 0, 0]) - dist(one.snap(1).shades[0].pos, [0, 0, 0]), 2, 0.1, 'recoil 2 m');
  const inv = run({ scenario: sc({ player: { invuln_ticks: 90, carried: 4 }, shades: [{ pos: [1, 1, 0], state: 'chase' }] }), ticks: 60 });
  assert.equal(inv.ev('player_hit').length, 0); // touching while invulnerable does nothing
  assert.equal(inv.snap(60).shades[0].state, 'chase');
  const spawning = run({ scenario: sc({ shades: [{ pos: [0.5, 1, 0], state: 'spawning', state_ticks_left: 30 }] }), ticks: 20 });
  assert.equal(spawning.ev('player_hit').length, 0);
  const dist2 = run({ scenario: sc({ shades: [{ pos: [1.2, 1, 0], state: 'chase' }] }), ticks: 1 });
  assert.equal(dist2.ev('player_hit').length, 0); // moves to 1.133: still outside 1.0
  const dy = run({ scenario: sc({ player: { pos: [0, 0, 0] }, shades: [{ pos: [0.5, 1.6, 0], state: 'chase' }] }), ticks: 1 });
  assert.equal(dy.ev('player_hit').length, 0); // height difference > 1.5
});

test('dropped motes vanish after 480 ticks and can be picked up again from the next tick', () => {
  const x = run({ scenario: sc({ player: { carried: 5, flames: 99 }, shades: [{ pos: [1, 1, 0], state: 'chase' }] }), ticks: 485, every: 1 });
  const ids = x.snap(1).motes.filter((m) => m.kind === 'dropped').map((m) => m.id);
  assert.equal(ids.length, 2);
  assert.ok(ids.every((id) => x.snap(480).motes.some((m) => m.id === id)), 'still there at tick 480');
  assert.ok(ids.every((id) => !x.snap(481).motes.some((m) => m.id === id)), 'gone at tick 481');
  const back = run({ scenario: sc({ motes: [{ pos: [0, 0, 0.5], kind: 'dropped', ttl_ticks: 100 }] }), ticks: 1 });
  assert.equal(back.ev('mote_picked').length, 1);
});

test('safe zone: 6 m around lit lanterns blocks shades; a freshly lit lantern pushes shades out within 30 ticks without damage', () => {
  const blocked = run({ scenario: sc({ player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [12, 1, 25] }] }), ticks: 300, every: 1 });
  for (const s of blocked.snaps) assert.ok(dist(s.shades[0].pos, [0, 0, 25]) >= 5.99, `inside: ${dist(s.shades[0].pos, [0, 0, 25])}`);
  const unlit = run({ scenario: sc({ player: { pos: [0, 0, 25] }, shades: [{ pos: [3, 1, 25] }] }), ticks: 1 });
  assert.equal(unlit.ev('player_hit').length, 0);
  const x = run({ scenario: sc({ player: { pos: [0, 0, 24.5], carried: 10 }, shades: [{ pos: [0, 1, 25.2], state: 'chase' }] }), frames: pressFrames('interact', [0]), ticks: 40, every: 1 });
  assert.equal(x.ev('lantern_lit').length, 1);
  assert.equal(x.ev('player_hit').length, 0);
  assert.ok(dist(x.snap(30).shades[0].pos, [0, 0, 25]) >= 5.99, 'pushed to the rim by tick 30');
  assert.ok(dist(x.snap(10).shades[0].pos, [0, 0, 25]) < 6);
});

test('falling: Y < -10 loses a flame and all motes once, waits 60 ticks, respawns at the start with invuln 90', () => {
  const s = sc({ player: { pos: [39.9, 0, 0], carried: 5, invuln_ticks: 500 }, motes: [] });
  const x = run({ scenario: s, frames: [{ tick: 0, move: [1, 0] }, { tick: 20, move: [0, 0] }], ticks: 400, every: 1 });
  const falls = x.ev('player_hit');
  assert.equal(falls.length, 1); // exactly once, invulnerability ignored
  assert.deepEqual(falls[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 5 });
  const F = falls[0].tick;
  assert.ok(x.snap(F).player.pos[1] < -10);
  assert.equal(x.snap(F).player.carried, 0);
  assert.equal(x.snap(F + 30).player.flames, 2);
  assert.deepEqual(x.snap(F + 60).player.pos, [0, 0, 0]);
  assert.deepEqual(x.snap(F + 60).player.vel, [0, 0, 0]);
  assert.equal(x.snap(F + 60).player.invuln, 1.5);
  assert.equal(x.snap(F + 60).state, 'playing');
  const lastFlame = run({ scenario: sc({ player: { pos: [39.9, 0, 0], flames: 1 } }), frames: [{ tick: 0, move: [1, 0] }], ticks: 400 });
  assert.equal(lastFlame.end.state, 'lost');
  assert.deepEqual(last(lastFlame.events).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(lastFlame.end.ticks, lastFlame.ev('player_hit')[0].tick);
  // nothing to pick up or touch while waiting for the respawn
  const wait = run({ scenario: sc({ player: { pos: [39.9, 0, 0] }, motes: [[39.9, -30, 0]], shades: [] }), frames: [{ tick: 0, move: [1, 0] }], ticks: 150 });
  assert.equal(wait.ev('mote_picked').length, 0);
});

test('random motes: 20 distinct points at start, +1 every 240 ticks up to the free points (Night 1: 24), none when disabled', () => {
  const x = run({ scenario: { random_shades: false, player: { flames: 99 } }, ticks: 2400, every: 1 });
  assert.equal(x.snap(0).motes_active, 20);
  assert.equal(new Set(x.snap(0).motes.map((m) => m.pos.join())).size, 20);
  assert.ok(x.snap(0).motes.every((m) => m.kind === 'random' && m.ttl_s === null));
  assert.equal(x.snap(239).motes_active, 20); assert.equal(x.snap(240).motes_active, 21);
  assert.equal(x.snap(960).motes_active, 24); assert.equal(x.snap(2400).motes_active, 24);
  assert.equal(run({ night: 3, scenario: { random_shades: false, wind_enabled: false, random_drifters: false, charms: [] }, ticks: 2400, every: 1 }).snap(2400).motes_active, 30);
  assert.equal(run({ scenario: sc(), ticks: 500 }).snap(480).motes_active, 0);
});

test('malformed inputs/scenario -> exit 2 with stderr; other errors non-zero', () => {
  const bad = [
    { frames: '{not json', raw: true }, { frames: [{ tick: 5 }, { tick: 5 }] }, { frames: [{ tick: 5 }, { tick: 2 }] },
    { frames: [{ tick: 0, move: [0, 2] }] }, { frames: [{ tick: 0, jump: 'yes' }] }, { frames: [{ tick: 0, pause: 1 }] },
    { scenario: '[1,2]', raw: true }, { scenario: { motes: [[1, 2]] } }, { scenario: { player: { flames: -1 } } },
    { scenario: { player: { charm_ticks: -3 } } }, { scenario: { wind_enabled: 'yes' } },
    { scenario: { shades: [{ pos: [1, 0, 0], state: 'angry' }] } },
    { scenario: { drifters: [{ pos: [1, 0, 0], state: 'dead' }] } }, { scenario: { charms: [{ pos: [1, 0, 0] }] } },
  ];
  for (const b of bad) {
    const x = run({ ...b, ticks: 5 });
    assert.equal(x.r.status, 2, JSON.stringify(b)); assert.ok(x.r.stderr.length > 0);
  }
  for (const args of [['--seed', '1', '--night', '1', '--ticks', '5'], ['--seed', '1', '--night', '4', '--ticks', '5', '--out', 'out/x.jsonl']]) {
    const r = spawnSync('node', [CLI, ...args], { encoding: 'utf8' });
    assert.notEqual(r.status, 0); assert.ok(r.stderr.length > 0);
  }
});
