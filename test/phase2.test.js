// Ticket-02 features: dash, maps (Night 2/3), bounce pads, drifters, charm, wind, pause, contract v1.1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TUNING as T } from '../src/tuning.js';
import { run, empty, last, dist, near, pressFrames, mergeFrames } from './helpers.js';

const sc = (o = {}) => ({ ...empty, ...o });

test('dash: 14 m/s for 12 ticks in the facing/move direction, cooldown 90 ticks from the start, event', () => {
  const walk = run({ scenario: sc(), frames: pressFrames('dash', [0], [{ tick: 0, move: [0, 1] }]), ticks: 12, every: 1 });
  near(walk.snap(12).player.pos[2], 2.8, 0.01, '14 m/s * 0.2 s');
  assert.deepEqual(walk.snap(5).player.vel, [0, 0, 14]);
  assert.equal(walk.ev('dash')[0].tick, 1); assert.deepEqual(walk.ev('dash')[0].data, {});
  assert.equal(walk.snap(1).player.dash_cd_s, 1.5);
  const still = run({ scenario: sc(), frames: pressFrames('dash', [0]), ticks: 12 }); // no input: dashes where it faces (+Z)
  near(still.snaps.at(-1).player.pos[2], 2.8, 0.01);
  const normal = run({ scenario: sc(), frames: pressFrames('dash', [0], [{ tick: 0, move: [0, 1] }]), ticks: 24, every: 1 });
  near(normal.snap(24).player.pos[2] - normal.snap(12).player.pos[2], 12 * 0.1, 0.01, 'back to 6 m/s after the dash');
  assert.equal(run({ scenario: sc(), frames: pressFrames('dash', [0, 89]), ticks: 100 }).ev('dash').length, 1); // cooldown
  assert.deepEqual(run({ scenario: sc(), frames: pressFrames('dash', [0, 90]), ticks: 100 }).ev('dash').map((e) => e.tick), [1, 91]);
  assert.equal(run({ scenario: sc(), frames: mergeFrames([{ tick: 0, dash: true }, { tick: 3, dash: false }, { tick: 5, dash: true }]), ticks: 30 }).ev('dash').length, 1); // ignored mid-dash
  const air = run({ scenario: sc(), frames: mergeFrames([{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 8, dash: true }, { tick: 9, dash: false }, { tick: 0, move: [0, 1] }]), ticks: 25, every: 1 });
  const ys = [10, 13, 16, 19].map((t) => air.snap(t).player.pos[1]);
  assert.ok(ys.every((y) => Math.abs(y - ys[0]) < 1e-3) && ys[0] > 0.5, `air dash holds altitude: ${ys}`);
  const hit = run({ scenario: sc({ shades: [{ pos: [1.5, 1, 0], state: 'chase' }] }), frames: pressFrames('dash', [0], [{ tick: 0, move: [1, 0] }]), ticks: 10 });
  assert.ok(hit.ev('player_hit').length >= 1, 'no invulnerability while dashing');
});

test('Night 2 map: two islands joined by a bridge, 6 lanterns, 270 s, no rails', () => {
  const x = run({ night: 2, scenario: sc(), frames: [{ tick: 0, move: [1, 0] }], ticks: 800, every: 50 });
  assert.equal(x.snaps[0].night, 2); assert.equal(x.snaps[0].time_left_s, 270); // Ticket-03: 330 -> 270
  assert.equal(x.snaps[0].lanterns.length, 6);
  assert.deepEqual(x.snaps[0].lanterns.map((l) => l.pos.join()), ['0,0,20', '17,0,-10', '-17,0,-10', '70,0,20', '87,0,-10', '53,0,-10']);
  assert.equal(x.ev('player_hit').length, 0); // crossed the bridge, no fall
  near(x.snaps.at(-1).player.pos[0], 80, 0.01); assert.equal(x.snaps.at(-1).player.grounded, true);
  const off = run({ night: 2, scenario: sc({ player: { pos: [35, 0, 1.9] } }), frames: [{ tick: 0, move: [0, 1] }], ticks: 200 });
  assert.equal(off.ev('player_hit')[0].data.by, 'fall'); // stepped off the side of the bridge
  const gap = run({ night: 2, scenario: sc({ player: { pos: [-20, 0, 0] } }), frames: [{ tick: 0, move: [0, 1] }], ticks: 400 });
  assert.equal(gap.ev('player_hit')[0].data.by, 'fall'); // walked off the island into the clouds
});

test('Night 2 bounce pad: launched at vy 14 / 24 m/s toward the other island, keys do not steer, can dash', () => {
  const x = run({ night: 2, scenario: sc({ player: { pos: [20, 0, 18] } }), frames: [{ tick: 5, move: [-1, 0] }], ticks: 150, every: 1 });
  assert.equal(x.snap(0).player.grounded, true); assert.equal(x.snap(1).player.grounded, false); // launched on the first tick
  assert.ok(x.snap(2).player.vel[1] > 13 && x.snap(2).player.vel[1] < 14.1, JSON.stringify(x.snap(2).player.vel));
  near(Math.hypot(x.snap(10).player.vel[0], x.snap(10).player.vel[2]), 24, 0.01, 'horizontal launch speed');
  const land = x.snaps.find((s) => s.tick > 10 && s.player.grounded);
  assert.ok(land.tick >= 84 && land.tick <= 90, `flight ~1.4 s, landed at tick ${land.tick} at ${land.player.pos}`);
  assert.ok(dist(land.player.pos, [70, 0, 0]) < 28, `lands on the target island: ${land.player.pos}`);
  near(land.player.pos[0], 51.6, 1.5); near(land.player.pos[2], 6.6, 1.5);
  const back = run({ night: 2, scenario: sc({ player: { pos: [50, 0, -18] } }), ticks: 120 });
  assert.ok(dist(back.snaps.at(-1).player.pos, [0, 0, 0]) < 28, 'second pad flies back to island A');
  const dash = run({ night: 2, scenario: sc({ player: { pos: [20, 0, 18] } }), frames: pressFrames('dash', [20]), ticks: 40, every: 1 });
  assert.equal(dash.ev('dash').length, 1);
});

test('Night 2: shades every 420 ticks (max 8), drifters at tick 1200, 2400 (max 2), 1 charm', () => {
  const x = run({ night: 2, scenario: { random_motes: false, wind_enabled: false, charms: [], player: { flames: 99 } }, ticks: 3700, every: 1 });
  assert.deepEqual(x.ev('shade_spawned').slice(0, 4).map((e) => e.tick), [300, 300, 720, 1140]);
  assert.equal(x.snap(1199).drifters.length, 0);
  assert.deepEqual(x.snap(1200).drifters.map((d) => d.id), ['D1']);
  assert.deepEqual(x.snap(2400).drifters.map((d) => d.id), ['D1', 'D2']);
  assert.equal(x.snap(3600).drifters.length, 2); // max 2
  assert.equal(x.snap(0).charms.length, 0);
  const d = run({ night: 2, scenario: { random_motes: false, random_shades: false }, ticks: 1 }).snaps[0];
  assert.deepEqual(d.charms, [{ id: 'C1', available: true, respawn_s: 0 }]);
  const n1 = run({ night: 1, scenario: { random_motes: false, random_shades: false }, ticks: 1300, every: 1 });
  assert.equal(n1.snap(1200).drifters.length, 0); // Night 1 has no drifters
});

test('Night 3 map: tiers, vertical cliffs, ramps, bell tower; 7 lanterns, 300 s', () => {
  const s0 = run({ night: 3, scenario: sc(), ticks: 1 }).snaps[0];
  assert.equal(s0.time_left_s, 300); // Ticket-03: 360 -> 300 assert.equal(s0.lanterns.length, 7);
  assert.deepEqual(s0.lanterns.map((l) => l.pos.join()), ['0,6,6', '18,3,10', '-18,3,10', '35,0,-10', '-35,0,-10', '20,0,-35', '-20,0,-35']);
  // vertical cliff: tier 1 (annulus r 12-24, z>0) cannot be walked onto from tier 0
  const wall = run({ night: 3, scenario: sc({ player: { pos: [0, 0, 10] } }), frames: [{ tick: 0, move: [0, 1] }], ticks: 120 }).snaps.at(-1);
  assert.ok(wall.player.pos[2] <= 12.001 && wall.player.pos[1] === 0, `blocked at the cliff: ${wall.player.pos}`);
  // ramp at 30 deg: foot r=30, top r=24 (Y=3)
  const ux = Math.cos(Math.PI / 6), uz = Math.sin(Math.PI / 6);
  const up = run({ night: 3, scenario: sc({ player: { pos: [32 * ux, 0, 32 * uz] } }), frames: [{ tick: 0, move: [-ux, -uz] }], ticks: 160, every: 1 });
  const top = up.snaps.at(-1).player;
  assert.equal(top.pos[1], 3); assert.equal(top.grounded, true);
  assert.ok(up.snaps.every((s) => s.player.pos[1] === 0 || s.player.grounded), 'walks up, never airborne');
  const mid = up.snaps.find((s) => Math.abs(Math.hypot(s.player.pos[0], s.player.pos[2]) - 27) < 0.1);
  near(mid.player.pos[1], 1.5, 0.1, 'slope');
  // stepping off a tier edge drops to the tier below
  const drop = run({ night: 3, scenario: sc({ player: { pos: [5, 3, 11.5] } }), frames: [{ tick: 0, move: [0, -1] }], ticks: 120 }).snaps.at(-1);
  assert.equal(drop.player.pos[1], 0); assert.equal(drop.player.grounded, true); // fell from tier 1 to tier 0, then met the tier-2 wall
  // bell tower (r 2, 8 m high) cannot be climbed or entered
  const tower = run({ night: 3, scenario: sc({ player: { pos: [0, 6, 5] } }), frames: [{ tick: 0, move: [0, -1] }], ticks: 100 }).snaps.at(-1);
  assert.ok(tower.player.pos[2] >= 1.99 && tower.player.pos[1] === 6, `tower blocks: ${tower.player.pos}`);
  // the tier-2 disc is a cliff from tier 0 as well
  const t2 = run({ night: 3, scenario: sc({ player: { pos: [0, 0, -12] } }), frames: [{ tick: 0, move: [0, 1] }], ticks: 120 }).snaps.at(-1);
  assert.ok(t2.player.pos[2] <= -7.99 && t2.player.pos[1] === 0, `tier 2 wall: ${t2.player.pos}`);
});

test('Night 3 bounce pad (0,3,13): vy 12 and 8 m/s toward -Z lands on tier 2', () => {
  const x = run({ night: 3, scenario: sc({ player: { pos: [0, 3, 13] } }), ticks: 90, every: 1 });
  const land = x.snaps.find((s) => s.tick > 5 && s.player.grounded);
  assert.equal(land.player.pos[1], 6);
  assert.ok(Math.hypot(land.player.pos[0], land.player.pos[2]) < 8, `on the tier-2 disc: ${land.player.pos}`);
  near(land.player.vel[1], 0, 1e-9);
});

test('Night 3 wind: 5 s gust every 30 s pushing 2 m/s; snapshot wind {active, dir_deg}; only with wind_enabled', () => {
  const s = sc({ wind_enabled: true });
  const x = run({ night: 3, scenario: s, ticks: 2200, every: 1 });
  assert.equal(x.snap(1799).wind.active, false); assert.equal(x.snap(1800).wind.active, true);
  assert.equal(x.snap(2099).wind.active, true); assert.equal(x.snap(2100).wind.active, false);
  assert.ok(Number.isInteger(x.snap(1800).wind.dir_deg));
  const a = (x.snap(1800).wind.dir_deg * Math.PI) / 180, p0 = x.snap(1799).player.pos, p1 = x.snap(2099).player.pos;
  near((p1[0] - p0[0]) * Math.cos(a) + (p1[2] - p0[2]) * Math.sin(a), 2 * 5 * (300 / 300), 0.2, 'pushed 2 m/s * 5 s along dir');
  const off = run({ night: 3, scenario: sc(), ticks: 2000, every: 100 });
  assert.ok(off.snaps.every((q) => !q.wind.active));
  assert.equal(run({ night: 1, scenario: sc({ wind_enabled: true }), ticks: 1900 }).snaps.at(-1).wind.active, true); // flag works on any night
  assert.equal(run({ night: 1, scenario: sc(), ticks: 1900 }).snaps.at(-1).wind.active, false);
});

test('Night 3: shades 4.5 m/s every 360 ticks, max 10; 30 motes; 2 charms', () => {
  const x = run({ night: 3, scenario: { wind_enabled: false, random_drifters: false, charms: [], player: { flames: 99, pos: [0, 0, -15] } }, ticks: 4200 });
  assert.deepEqual(x.ev('shade_spawned').slice(0, 4).map((e) => e.tick), [300, 300, 660, 1020]);
  assert.equal(x.snaps.at(-1).shades.length <= 10, true);
  assert.deepEqual(run({ night: 3, scenario: sc({ charms: undefined, random_motes: false }), ticks: 1 }).snaps[0].charms.map((c) => c.id), ['C1', 'C2']);
});

test('drifter: idle -> chase (carried >= 5, <= 15 m), steals min(3, carried) once, flees 240 ticks and vanishes with the loot', () => {
  const d = (o) => sc({ drifters: [{ id: 'D1', pos: [10, 1.5, 0], ...o }], player: { carried: 6 } });
  const x = run({ night: 2, scenario: d(), ticks: 400, every: 1 });
  assert.equal(x.snap(1).drifters[0].state, 'chase');
  const steal = x.ev('drifter_steal')[0];
  assert.deepEqual(steal.data, { drifter_id: 'D1', amount: 3, carried: 3 });
  assert.ok(steal.tick > 60 && steal.tick < 90, `reached Mây at 7 m/s: tick ${steal.tick}`);
  assert.equal(x.ev('drifter_steal').length, 1);
  assert.equal(x.snap(steal.tick).drifters[0].state, 'flee'); assert.equal(x.snap(steal.tick).drifters[0].stolen, 3);
  assert.equal(x.snap(steal.tick + 239).drifters.length, 1); assert.equal(x.snap(steal.tick + 240).drifters.length, 0);
  const dd = x.snap(steal.tick + 100).drifters[0];
  near(dist(dd.pos, [0, 0, 0]) - dist(x.snap(steal.tick).drifters[0].pos, [0, 0, 0]), 7 * 100 / 60, 0.2, 'flees at 7 m/s');
  assert.equal(x.snap(steal.tick + 5).player.carried, 3);
  assert.equal(run({ night: 2, scenario: sc({ drifters: [{ id: 'D1', pos: [10, 1.5, 0] }], player: { carried: 4 } }), ticks: 200 }).ev('drifter_steal').length, 0);
  assert.equal(run({ night: 2, scenario: sc({ drifters: [{ id: 'D1', pos: [16, 1.5, 0] }], player: { carried: 9 } }), ticks: 3, every: 1 }).snap(1).drifters[0].state, 'idle');
  const small = run({ night: 2, scenario: sc({ drifters: [{ id: 'D1', pos: [1.5, 1.5, 0], state: 'chase' }], player: { carried: 5 } }), ticks: 20 });
  assert.equal(small.ev('drifter_steal')[0].data.amount, 3);
  // Mây's invulnerability and a lantern's safe zone do not stop it; it costs no flame
  const inv = run({ night: 2, scenario: sc({ drifters: [{ id: 'D1', pos: [1.5, 1.5, 0], state: 'chase' }], lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], player: { carried: 5, invuln_ticks: 200 } }), ticks: 20 });
  assert.equal(inv.ev('drifter_steal').length, 1); assert.equal(inv.snaps.at(-1).player.flames, 3);
  assert.equal(run({ night: 2, scenario: sc({ drifters: [{ id: 'D1', pos: [1.5, 1.5, 0], state: 'chase' }], player: { carried: 0 } }), ticks: 20 }).ev('drifter_steal').length, 0);
});

test('drifter vs Tỏa Sáng: chase -> flee without stealing; fleeing with loot -> drops everything, vanishes after 120 ticks', () => {
  const a = run({ night: 2, scenario: sc({ drifters: [{ id: 'D1', pos: [4, 1.5, 0], state: 'chase' }], player: { carried: 6 } }), frames: pressFrames('pulse', [0]), ticks: 60, every: 1 });
  assert.equal(a.ev('pulse').length, 1);
  assert.equal(a.ev('drifter_steal').length, 0);
  assert.equal(a.snap(1).drifters[0].state, 'flee'); assert.equal(a.snap(1).drifters[0].stolen, 0);
  assert.equal(a.snap(1).player.carried, 3);
  const b = run({ night: 2, scenario: sc({ drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3, state_ticks_left: 200 }], player: { carried: 3 } }), frames: pressFrames('pulse', [0]), ticks: 130, every: 1 });
  assert.deepEqual(b.ev('drifter_drop')[0].data, { drifter_id: 'D1', amount: 3 });
  assert.equal(b.snap(1).motes.filter((m) => m.kind === 'dropped').length, 3);
  assert.equal(b.snap(1).drifters[0].stolen, 0);
  assert.equal(b.snap(119).drifters.length, 1); assert.equal(b.snap(120).drifters.length, 0);
  assert.equal(b.ev('player_hit').length, 0);
  assert.equal(b.snap(1).score, 0); // drifters give no pulse points
});

test('charm: pickup event, 600 ticks of 7.2 m/s and free dashes, refresh on re-pickup, respawns after 2700 ticks', () => {
  const x = run({ night: 2, scenario: { ...sc(), charms: undefined, player: { pos: [35, 0, 0] } }, frames: [{ tick: 4, move: [1, 0] }, { tick: 20, move: [0, 0] }], ticks: 2800, every: 1 });
  assert.deepEqual(x.ev('charm_picked')[0], { type: 'event', tick: 1, name: 'charm_picked', data: { charm_id: 'C1', charm_ticks: 600 } });
  assert.equal(x.snap(1).player.charm_s, 10);
  assert.deepEqual(x.snap(1).charms[0], { id: 'C1', available: false, respawn_s: 45 });
  near(x.snap(600).player.charm_s, 1 / 60, 0.001);
  assert.equal(x.snap(601).player.charm_s, 0);
  assert.equal(x.snap(2700).charms[0].available, false); assert.equal(x.snap(2701).charms[0].available, true);
  const fast = run({ night: 2, scenario: sc({ player: { charm_ticks: 600 } }), frames: [{ tick: 0, move: [1, 0] }], ticks: 60 });
  near(fast.snaps.at(-1).player.pos[0], 7.2, 0.01);
  const dashes = run({ night: 2, scenario: sc({ player: { charm_ticks: 600 } }), frames: pressFrames('dash', [0, 13, 26]), ticks: 40 });
  assert.deepEqual(dashes.ev('dash').map((e) => e.tick), [1, 14, 27]); // no cooldown
  assert.equal(dashes.snaps.at(-1).player.dash_cd_s, 0);
  const ignored = run({ night: 2, scenario: sc({ player: { charm_ticks: 600 } }), frames: mergeFrames([{ tick: 0, dash: true }, { tick: 3, dash: false }, { tick: 5, dash: true }]), ticks: 30 });
  assert.equal(ignored.ev('dash').length, 1);
  const speed = run({ night: 2, scenario: sc({ player: { charm_ticks: 600 } }), frames: pressFrames('dash', [0], [{ tick: 0, move: [1, 0] }]), ticks: 6, every: 1 });
  assert.equal(speed.snap(3).player.vel[0], 14);
  const re = run({ night: 2, scenario: { ...sc(), charms: undefined, player: { pos: [35, 0, 0], charm_ticks: 100 } }, ticks: 2 });
  near(re.snaps.at(-1).player.charm_s, 10, 0.02, 'refreshed to 600 ticks');
  assert.equal(re.ev('charm_picked')[0].data.charm_ticks, 600);
  const pre = run({ night: 2, scenario: sc({ charms: [{ id: 'C1', pos: [35, 0, 0], available: false, respawn_ticks: 5 }], player: { pos: [35, 0, 0] } }), ticks: 10, every: 1 });
  assert.equal(pre.ev('charm_picked').length, 1); assert.equal(pre.ev('charm_picked')[0].tick, 5);
});

test('pause: tick keeps counting, sim_tick/time/cooldowns/spawns freeze, snapshot state "paused", paused/resumed events', () => {
  const frames = mergeFrames([{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 20, pause: true }, { tick: 21, pause: false }]);
  const x = run({ scenario: sc({ time_left_s: 100 }), frames, ticks: 40, every: 1 });
  assert.equal(x.ev('paused')[0].tick, 11); assert.equal(x.ev('resumed')[0].tick, 21);
  assert.equal(x.snap(10).state, 'playing'); assert.equal(x.snap(15).state, 'paused');
  assert.equal(x.snap(15).tick, 15); assert.equal(x.snap(15).sim_tick, 10);
  assert.equal(x.snap(20).time_left_s, x.snap(10).time_left_s);
  assert.deepEqual(x.snap(20).player.pos, x.snap(10).player.pos);
  assert.equal(x.snap(21).state, 'playing'); assert.equal(x.snap(21).sim_tick, 11);
  assert.equal(x.snaps.at(-1).sim_tick, 30); assert.equal(x.end.ticks, 40);
  const sched = run({ scenario: { random_motes: false }, frames: mergeFrames([{ tick: 100, pause: true }, { tick: 101, pause: false }, { tick: 400, pause: true }, { tick: 401, pause: false }]), ticks: 399, every: 1 });
  assert.equal(sched.ev('shade_spawned').length, 0, 'spawn timer frozen: sim_tick is 100 at tick 399');
  assert.equal(sched.snap(399).sim_tick, 100);
  const cd = run({ scenario: sc({ player: { carried: 10 } }), frames: mergeFrames([{ tick: 0, pulse: true }, { tick: 1, pulse: false, pause: true }, { tick: 2, pause: false }]), ticks: 20, every: 1 });
  assert.equal(cd.snap(1).player.pulse_cd_s, 3); assert.equal(cd.snap(10).player.pulse_cd_s, 3); // frozen while paused
});

test('night_start event: once, on the first tick, carries the night', () => {
  for (const night of [1, 2, 3]) {
    const x = run({ night, scenario: sc(), ticks: 5 });
    assert.deepEqual(x.ev('night_start'), [{ type: 'event', tick: 1, name: 'night_start', data: { night } }]);
  }
});

test('Contract v1.3: version, commands (incl. bench_cmd, soak_cmd), standard numbers of v1.0-v1.2, top-level score', () => {
  const c = JSON.parse(readFileSync('game.contract.json', 'utf8'));
  assert.equal(c.contract_version, '1.3');
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd', 'bench_cmd', 'soak_cmd']) assert.equal(typeof c[k], 'string');
  assert.match(c.bench_cmd, /bench/); assert.match(c.soak_cmd, /soak/);
  assert.deepEqual(c.tuning, T);
  const standard = {
    player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1, interact_radius: 2,
    pulse_cost: 3, pulse_radius: 5, night1_duration_s: 240, flames: 3, invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2,
    pulse_push_m: 4, pulse_cooldown_s: 3, safe_radius: 6, shade_speed: 4, shade_hit_radius: 1, fall_enabled: true,
    dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5, night2_duration_s: 270, night3_duration_s: 300,
    fuel_max: 100, fuel_decay_per_s: 1.0, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5,
    low_fuel_threshold: 30, capacity_max: 20,
  };
  for (const [k, v] of Object.entries(standard)) assert.equal(c.tuning[k], v, k);
  const sc = c.tuning.score;
  assert.deepEqual([sc.per_mote, sc.per_lantern, sc.per_stun, sc.per_second_left, sc.per_flame_left], [5, 100, 5, 0, 50]);
  assert.deepEqual(c.score, c.tuning.score);
});

test('performance: a full Night (21600 ticks) headless run finishes well under 30 s', () => {
  for (const night of [1, 2, 3]) {
    const x = run({ night, seed: 5, scenario: { player: { flames: 99 } }, ticks: 21600, every: 10 });
    assert.equal(x.r.status, 0);
    assert.ok(x.ms < 30000, `night ${night}: ${x.ms} ms`);
    assert.ok(x.ms < 10000, `night ${night} should be far below the limit: ${x.ms} ms`);
  }
});
