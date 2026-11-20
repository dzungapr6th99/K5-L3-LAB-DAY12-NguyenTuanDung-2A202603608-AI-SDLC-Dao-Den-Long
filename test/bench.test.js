// Ticket-04 sections 1 and 2: benchmark scene + frame statistics, soak test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { benchStats } from '../src/benchstats.js';
import { createGame, stepGame, snapshot } from '../src/sim.js';

test('benchStats follows the definitions: avg_fps = 1000 N / sum(dt); p1 low = 1000 / mean of the worst ceil(1%) frames; p95 nearest rank', () => {
  const steady = benchStats(Array(100).fill(10)); // 100 frames of 10 ms
  assert.equal(steady.frames, 100); assert.equal(steady.avg_fps, 100); assert.equal(steady.p1_low_fps, 100); assert.equal(steady.frame_ms_p95, 10);
  // 100 frames: k = ceil(1) = 1 -> the single worst frame
  const one = benchStats([...Array(99).fill(10), 50]);
  assert.equal(one.p1_low_fps, 20); // 1000 / 50
  near(one.avg_fps, (1000 * 100) / (990 + 50), 1e-9);
  // 101 frames: k = ceil(1.01) = 2 -> mean of the two worst
  const two = benchStats([...Array(99).fill(10), 40, 20]);
  near(two.p1_low_fps, 1000 / 30, 1e-9);
  // fewer than 100 frames: k = max(1, ceil(...)) = 1
  assert.equal(benchStats([10, 10, 25]).p1_low_fps, 40);
  // p95: sorted ascending, element ceil(0.95 N) - 1
  const ramp = benchStats(Array.from({ length: 200 }, (_, i) => i + 1));
  assert.equal(ramp.frame_ms_p95, 190);
  assert.equal(benchStats([5]).frame_ms_p95, 5);
  assert.throws(() => benchStats([]));
});
function near(a, b, tol) { assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`); }

test('benchmark scene: Night 1, exactly 200 wandering shades spread over the island, 100 motes, L1-L3 lit with fuel 100', () => {
  const g = createGame({ seed: 42, night: 1, bench: true });
  const s = snapshot(g);
  assert.equal(s.night, 1);
  assert.equal(s.shades.length, 200); assert.ok(s.shades.every((x) => x.state === 'wander'));
  assert.equal(new Set(s.shades.map((x) => x.id)).size, 200);
  assert.equal(s.motes_active, 100); assert.equal(s.motes.length, 100);
  assert.deepEqual(s.lanterns.map((l) => [l.lit, l.fuel]), [[true, 100], [true, 100], [true, 100], [false, 0], [false, 0]]);
  assert.deepEqual(s.player.pos, [0, 0, 0]);
  // spread evenly: every quarter of the island holds roughly a quarter of the shades, and none are outside it
  const quad = [0, 0, 0, 0];
  for (const x of s.shades) { assert.ok(Math.hypot(x.pos[0], x.pos[2]) <= 38.5); quad[(x.pos[0] >= 0 ? 1 : 0) + (x.pos[2] >= 0 ? 2 : 0)]++; }
  assert.ok(quad.every((q) => q >= 35 && q <= 65), `quadrants ${quad}`);
  const rings = [0, 0, 0];
  for (const x of s.shades) rings[Math.min(2, Math.floor(Math.hypot(x.pos[0], x.pos[2]) / (38 / 3)))]++;
  assert.ok(rings[0] > 10 && rings[1] > 30 && rings[2] > 50, `rings ${rings}`); // area grows with radius: even density
  // deterministic for a seed, different for another seed
  assert.deepEqual(snapshot(createGame({ seed: 42, night: 1, bench: true })), s);
  assert.notDeepEqual(snapshot(createGame({ seed: 43, night: 1, bench: true })).shades.map((x) => x.pos), s.shades.map((x) => x.pos));
});

test('benchmark scene is inert: no spawns, damage, pickups, fuel loss or end of the Night; shades keep moving', () => {
  const g = createGame({ seed: 42, night: 1, bench: true });
  const before = snapshot(g).shades.map((x) => x.pos.join());
  for (let i = 0; i < 60 * 300; i++) stepGame(g, {}); // 5 minutes: longer than any Night
  const s = snapshot(g);
  assert.equal(s.state, 'playing'); assert.ok(g.events.every((e) => e.name === 'night_start')); // nothing else happens
  assert.equal(s.shades.length, 200); assert.equal(s.motes_active, 100);
  assert.equal(s.player.flames, 3); assert.equal(s.player.carried, 0); assert.deepEqual(s.player.pos, [0, 0, 0]);
  assert.deepEqual(s.lanterns.map((l) => l.fuel), [100, 100, 100, 0, 0]);
  assert.ok(s.lanterns.slice(0, 3).every((l) => l.lit));
  assert.ok(s.shades.some((x, i) => x.pos.join() !== before[i]), 'shades moved');
  assert.ok(s.shades.every((x) => x.state !== 'stunned' && x.state !== 'recoil'));
});

test('the headless CLI never builds the benchmark scene (contract output is unchanged)', () => {
  const g = createGame({ seed: 42, night: 1 });
  assert.equal(g.bench, undefined); assert.equal(snapshot(g).shades.length, 0); assert.equal(snapshot(g).motes_active, 20);
});

test('soak: runs the requested Nights in one process, no crash, deterministic results, memory flat', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-soak-'));
  const run = (n, out) => spawnSync('node', ['--expose-gc', 'scripts/soak.js', '--seed', '7', '--nights', String(n), '--out', out], { encoding: 'utf8' });
  const a = run(6, join(dir, 'a.json')), b = run(6, join(dir, 'b.json'));
  assert.equal(a.status, 0, a.stderr + a.stdout);
  const A = JSON.parse(readFileSync(join(dir, 'a.json'), 'utf8')), B = JSON.parse(readFileSync(join(dir, 'b.json'), 'utf8'));
  assert.deepEqual(Object.keys(A), ['nights', 'crashes', 'results', 'mem_start_mb', 'mem_end_mb', 'duration_s']);
  assert.equal(A.nights, 6); assert.equal(A.crashes, 0); assert.equal(A.results.length, 6);
  assert.ok(A.results.every((r) => r === 'won' || r === 'lost'));
  assert.deepEqual(A.results, B.results); // same seed, same outcomes
  assert.ok(A.mem_end_mb <= 1.2 * A.mem_start_mb, `${A.mem_start_mb} -> ${A.mem_end_mb} MB`);
  assert.equal(typeof A.duration_s, 'number');
  assert.notEqual(run(0, join(dir, 'x.json')).status, 0); // bad arguments are an error
  const c = run(6, join(dir, 'c.json')); // a different base seed gives different games
  assert.equal(c.status, 0);
  const other = spawnSync('node', ['scripts/soak.js', '--seed', '100', '--nights', '4', '--out', join(dir, 'd.json')], { encoding: 'utf8' });
  assert.equal(other.status, 0, other.stderr);
  assert.equal(JSON.parse(readFileSync(join(dir, 'd.json'), 'utf8')).nights, 4);
});
