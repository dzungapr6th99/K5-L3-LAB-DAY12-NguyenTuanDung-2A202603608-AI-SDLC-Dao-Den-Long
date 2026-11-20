// Ticket-03 "Đèn cạn dầu": lantern fuel, draining shades, dawn-survival win, growing capacity, new scoring, Contract v1.2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run as baseRun, empty, last, dist, near, pressFrames } from './helpers.js';

const run = (o) => baseRun({ every: 1, ...o }); // one snapshot per tick unless a test says otherwise

const sc = (o = {}) => ({ ...empty, ...o });
const L1 = [0, 0, 25]; // default position of L1 on Night 1
const far = { pos: [0, 0, -30] }; // Mây far away from everything on Night 1

test('fuel: lit lanterns start at 100 (default when lit is set without fuel), burn 1/s, 1 decimal in the snapshot', () => {
  const x = run({ scenario: sc({ lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true, fuel: 50.04 }, { id: 'L3' }] }), ticks: 600, every: 60 });
  assert.equal(x.snaps[0].lanterns[0].fuel, 100);
  assert.equal(x.snaps[0].lanterns[1].fuel, 50); // rounded to one decimal
  assert.equal(x.snaps[0].lanterns[2].fuel, 0); // dark lantern: fuel 0
  assert.equal(x.snap(600).lanterns[0].fuel, 90);
  assert.equal(x.snap(60).lanterns[0].fuel, 99);
  assert.ok(x.snaps[0].lanterns.every((l) => 'ever_lit' in l && 'relit_count' in l));
  assert.equal(x.snaps[0].lanterns[0].ever_lit, true); assert.equal(x.snaps[0].lanterns[2].ever_lit, false);
  assert.equal(x.ev('lantern_out').length, 0);
});

test('lantern_out: fuel <= 0 switches the lantern off at the end of step 2, deposited = 0, ever_lit stays', () => {
  const x = run({ scenario: sc({ lanterns: [{ id: 'L1', lit: true, fuel: 0.05, deposited: 10 }] }), ticks: 10, every: 1 });
  assert.deepEqual(x.ev('lantern_out'), [{ type: 'event', tick: 3, name: 'lantern_out', data: { lantern_id: 'L1' } }]); // 3/60 fuel = 3 ticks
  assert.equal(x.snap(2).lanterns[0].lit, true);
  const l = x.snap(3).lanterns[0];
  assert.deepEqual([l.lit, l.deposited, l.fuel, l.ever_lit], [false, 0, 0, true]);
});

test('refuel: used = min(carried, ceil((100 - fuel) / 10)), +10 fuel per mote, +5 points per mote, event refuel', () => {
  const s = (fuel, carried) => sc({ player: { pos: [0, 0, 24], carried }, lanterns: [{ id: 'L1', lit: true, fuel }] });
  let x = run({ scenario: s(55, 10), frames: pressFrames('interact', [0]), ticks: 2 });
  assert.deepEqual(x.ev('refuel')[0].data, { lantern_id: 'L1', amount: 5, fuel: 100 }); // ceil(45.02/10) = 5
  assert.equal(x.ev('deposit').length, 0);
  assert.equal(x.snaps.at(-1).score, 25); assert.equal(x.snaps.at(-1).player.carried, 5);
  x = run({ scenario: s(20, 3), frames: pressFrames('interact', [0]), ticks: 2 });
  near(x.ev('refuel')[0].data.fuel, 49.98, 0.05); assert.equal(x.ev('refuel')[0].data.amount, 3); // limited by what Mây carries
  assert.equal(x.snaps.at(-1).player.carried, 0);
  assert.equal(run({ scenario: s(55, 0), frames: pressFrames('interact', [0]), ticks: 2 }).ev('refuel').length, 0);
  assert.equal(run({ scenario: s(55, 5), frames: pressFrames('interact', [0]), ticks: 2 }).ev('lantern_lit').length, 0); // refuelling is not lighting
  // out of reach (2.0 m) does nothing
  const f = run({ scenario: sc({ player: { pos: [0, 0, 22.9], carried: 5 }, lanterns: [{ id: 'L1', lit: true, fuel: 50 }] }), frames: pressFrames('interact', [0]), ticks: 2 });
  assert.equal(f.ev('refuel').length, 0);
});

test('interaction picks the nearest lantern that can take something (unlit, or lit but not full); ties go to the smaller id', () => {
  const lanterns = [{ id: 'L1', lit: true, fuel: 50, pos: [1, 0, 0] }, { id: 'L2', pos: [-1, 0, 0] }, { id: 'L3', pos: [0, 0, 0.5] }];
  const x = run({ scenario: sc({ player: { carried: 2 }, lanterns }), frames: pressFrames('interact', [0]), ticks: 2 });
  assert.equal(x.ev('deposit')[0].data.lantern_id, 'L3'); // nearest
  const tie = run({ scenario: sc({ player: { carried: 2 }, lanterns: lanterns.slice(0, 2) }), frames: pressFrames('interact', [0]), ticks: 2 });
  assert.equal(tie.events.find((e) => e.name === 'refuel' || e.name === 'deposit').data.lantern_id, 'L1'); // L1 and L2 are 1 m away
  const onlyUnlit = run({ scenario: sc({ player: { carried: 2 }, lanterns: [{ id: 'L1', lit: true, fuel: 50, pos: [1.9, 0, 0] }, { id: 'L2', pos: [0, 0, 0.1] }] }), frames: pressFrames('interact', [0]), ticks: 2 });
  assert.equal(onlyUnlit.ev('deposit')[0].data.lantern_id, 'L2');
});

test('first light costs 10 and gives +100; relight costs 5 and gives +40; lantern_lit carries relight; relit_count', () => {
  const near1 = { pos: [0, 0, 24] };
  let x = run({ scenario: sc({ player: { ...near1, carried: 10 } }), frames: pressFrames('interact', [0]), ticks: 2 });
  assert.deepEqual(x.ev('lantern_lit')[0].data, { lantern_id: 'L1', relight: false });
  assert.equal(x.snaps.at(-1).score, 50 + 100);
  let l = x.snaps.at(-1).lanterns[0];
  assert.deepEqual([l.lit, l.fuel, l.ever_lit, l.relit_count], [true, 99.98 > 99 ? l.fuel : 0, true, 0]);
  near(l.fuel, 100, 0.1);
  x = run({ scenario: sc({ player: { ...near1, carried: 5 }, lanterns: [{ id: 'L1', lit: false, ever_lit: true }] }), frames: pressFrames('interact', [0]), ticks: 2 });
  assert.deepEqual(x.ev('deposit')[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  assert.deepEqual(x.ev('lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
  assert.equal(x.snaps.at(-1).score, 25 + 40);
  l = x.snaps.at(-1).lanterns[0];
  assert.equal(l.relit_count, 1); assert.equal(l.ever_lit, true);
  // a lantern that went out relights with 5 even in the same run
  x = run({ scenario: sc({ player: { ...near1, carried: 5 }, lanterns: [{ id: 'L1', lit: true, fuel: 0.05 }] }), frames: pressFrames('interact', [10]), ticks: 13 });
  assert.equal(x.ev('lantern_out').length, 1);
  assert.equal(x.ev('lantern_lit')[0].data.relight, true);
  // 10 are still needed for a lantern that was never lit
  x = run({ scenario: sc({ player: { ...near1, carried: 5 } }), frames: pressFrames('interact', [0]), ticks: 2 });
  assert.equal(x.ev('lantern_lit').length, 0); assert.equal(x.snaps.at(-1).lanterns[0].deposited, 5);
});

test('capacity = 10 + 2 * successful lights (max 20); scenario-placed lanterns do not count; reset every Night', () => {
  const x = run({ scenario: sc({ player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L5', lit: true }] }), frames: pressFrames('interact', [0]), ticks: 3, every: 1 });
  assert.equal(x.snap(0).player.capacity, 10); // L5 pre-lit by the scenario: not counted
  assert.equal(x.snap(1).player.capacity, 12);
  assert.equal(run({ scenario: sc({ player: { successful_lights: 4 } }), ticks: 1 }).snaps[0].player.capacity, 18);
  assert.equal(run({ scenario: sc({ player: { successful_lights: 9 } }), ticks: 1 }).snaps[0].player.capacity, 20);
  const pick = run({ scenario: sc({ player: { successful_lights: 2 }, motes: Array.from({ length: 16 }, (_, i) => [0, 0, 0.05 * i]) }), ticks: 3 });
  assert.equal(pick.snaps.at(-1).player.carried, 14); assert.equal(pick.snaps.at(-1).motes_active, 2);
  assert.equal(run({ night: 2, scenario: sc(), ticks: 1 }).snaps[0].player.capacity, 10);
  const relight = run({ scenario: sc({ player: { pos: [0, 0, 24], carried: 5 }, lanterns: [{ id: 'L1', lit: false, ever_lit: true }] }), frames: pressFrames('interact', [0]), ticks: 2 });
  assert.equal(relight.snaps.at(-1).player.capacity, 12); // a relight is a successful light too
});

test('dawn: Mây alive and lit lanterns >= ceil(0.6 * n) wins (dawn_survived); fewer loses (dawn); no early win', () => {
  const lit = (ids) => ids.map((id) => ({ id, lit: true }));
  const end = (night, ids, extra = {}) => run({ night, scenario: sc({ time_left_s: 1, lanterns: lit(ids), ...extra }), ticks: 100 });
  let x = end(1, ['L1', 'L2', 'L3']);
  assert.equal(x.end.state, 'won'); assert.equal(x.end.ticks, 60);
  assert.deepEqual(last(x.events).data, { result: 'won', reason: 'dawn_survived' });
  x = end(1, ['L1', 'L2']);
  assert.equal(x.end.state, 'lost'); assert.deepEqual(last(x.events).data, { result: 'lost', reason: 'dawn' });
  assert.equal(end(2, ['L1', 'L2', 'L3', 'L4']).end.state, 'won'); assert.equal(end(2, ['L1', 'L2', 'L3']).end.state, 'lost'); // 4 of 6
  assert.equal(end(3, ['L1', 'L2', 'L3', 'L4', 'L5']).end.state, 'won'); assert.equal(end(3, ['L1', 'L2', 'L3', 'L4']).end.state, 'lost'); // 5 of 7
  const early = run({ scenario: sc({ time_left_s: 100, lanterns: lit(['L1', 'L2', 'L3', 'L4', 'L5']) }), ticks: 600 });
  assert.equal(early.end.state, 'playing'); assert.equal(early.end.ticks, 600); // every lantern lit does not end the Night
  assert.equal(early.ev('game_over').length, 0);
});

test('dawn: no_flames wins over a dawn victory on the same tick; the last tick counts the lanterns that survived it', () => {
  const lit3 = ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true }));
  const x = run({ scenario: sc({ player: { pos: [0, 0, 0], flames: 1 }, lanterns: lit3, shades: [{ pos: [0.9, 1, 0], state: 'chase' }], time_left_s: 1 / 60 }), ticks: 5 });
  assert.deepEqual(x.ev('game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  // a lantern whose fuel runs out on the dawn tick is already off when the lanterns are counted
  const edge = run({ scenario: sc({ lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }, { id: 'L3', lit: true, fuel: 1 / 60 }], time_left_s: 1 / 60 }), ticks: 5 });
  assert.equal(edge.ev('lantern_out').length, 1);
  assert.deepEqual(edge.ev('game_over')[0].data, { result: 'lost', reason: 'dawn' });
});

test('dawn score: +50 + floor(fuel) per lit lantern, +50 per flame left, no time bonus; other points unchanged', () => {
  const x = run({ scenario: sc({ time_left_s: 1, player: { flames: 2 }, lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true, fuel: 40 }, { id: 'L3', lit: true, fuel: 70.9 }] }), ticks: 100 });
  // after 60 ticks of burning: 99, 39, 69.9 -> floor 99 + 39 + 69 = 207; 3 * 50 = 150; flames 2 * 50 = 100
  assert.equal(x.end.score, 207 + 150 + 100);
  assert.equal(x.end.state, 'won');
  const lost = run({ scenario: sc({ time_left_s: 1, lanterns: [{ id: 'L1', lit: true }] }), ticks: 100 });
  assert.equal(lost.end.score, 0); // no bonus when losing
});

test('shades go for weak lanterns: wander target = nearest lit lantern with fuel < 30 (tie: smaller id), else nearest dark lantern', () => {
  const sh = (o) => [{ id: 'S1', pos: [20, 1, 5], ...o }];
  const farFromPlayer = { player: { pos: [0, 0, -40] } };
  let x = run({ scenario: sc({ ...farFromPlayer, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: sh() }), ticks: 2 });
  assert.equal(x.snap(1).shades[0].target_lantern_id, 'L1'); // weak lantern beats the nearer dark L2
  x = run({ scenario: sc({ ...farFromPlayer, shades: sh() }), ticks: 2 });
  assert.equal(x.snap(1).shades[0].target_lantern_id, 'L2'); // no weak lantern: nearest dark one
  const tie = run({ scenario: sc({ ...farFromPlayer, lanterns: [{ id: 'L1', lit: true, fuel: 10, pos: [-10, 0, 0] }, { id: 'L2', lit: true, fuel: 10, pos: [10, 0, 0] }], shades: [{ id: 'S1', pos: [0, 1, 20] }] }), ticks: 2 });
  assert.equal(tie.snap(1).shades[0].target_lantern_id, 'L1');
  const healthy = run({ scenario: sc({ ...farFromPlayer, lanterns: ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true })), shades: sh() }), ticks: 2 });
  assert.equal(healthy.snap(1).shades[0].target_lantern_id, null); // nothing to attack: ordinary wandering
  const keep = run({ scenario: sc({ player: { pos: [20, 0, 0] }, lanterns: [{ id: 'L1', lit: true, fuel: 10 }], shades: [{ id: 'S1', pos: [20, 1, 5], state: 'chase' }] }), ticks: 3 });
  assert.equal(keep.snap(1).shades[0].state, 'chase'); // a chasing shade does not change target
});

test('drain: within 2 m of a weak lantern a wandering shade stands still and drinks 5 fuel/s (stacking), event every 60 ticks', () => {
  const x = run({ scenario: sc({ ...far, lanterns: [{ id: 'L1', lit: true, fuel: 25 }], shades: [{ id: 'S1', pos: [8, 1, 25] }] }), ticks: 330, every: 1 });
  const first = x.snaps.find((s) => s.shades[0].state === 'drain');
  assert.ok(first, 'reached the lantern and started draining');
  assert.ok(first.tick > 85 && first.tick < 100, `walked 6 m at 4 m/s: tick ${first.tick}`); // 8 m away -> within 2 m after 1.5 s
  assert.equal(first.shades[0].target_lantern_id, 'L1');
  const p0 = first.shades[0].pos;
  assert.deepEqual(x.snap(first.tick + 30).shades[0].pos, p0); // stands still while draining
  // 6 fuel/s while draining
  near(x.snap(first.tick).lanterns[0].fuel - x.snap(first.tick + 60).lanterns[0].fuel, 6, 0.2);
  const ev = x.ev('fuel_drain');
  assert.ok(ev.length >= 1 && ev.every((e) => e.data.lantern_id === 'L1' && e.data.shade_id === 'S1'));
  assert.deepEqual(ev.slice(1).map((e, i) => e.tick - ev[i].tick), ev.slice(1).map(() => 60));
  // the lantern burns out, the shade lets go and heads for the next dark lantern
  assert.equal(x.ev('lantern_out').length, 1);
  const after = last(x.snaps).shades[0];
  assert.equal(after.state, 'wander'); assert.equal(after.target_lantern_id, 'L1'); // L1 is now the nearest DARK lantern
});

test('drain stacks across shades: two shades take 10 fuel/s plus the 1/s burn', () => {
  const x = run({ scenario: sc({ ...far, lanterns: [{ id: 'L1', lit: true, fuel: 25 }], shades: [{ id: 'S1', pos: [1, 1, 25], state: 'drain', target_lantern_id: 'L1' }, { id: 'S2', pos: [-1, 1, 25], state: 'drain', target_lantern_id: 'L1' }] }), ticks: 60, every: 60 });
  near(x.snap(60).lanterns[0].fuel, 14, 0.1); // 25 - 60 * (1 + 5 + 5) / 60
  assert.deepEqual(x.ev('fuel_drain').map((e) => [e.tick, e.data.shade_id]), [[60, 'S1'], [60, 'S2']]);
});

test('leaving drain: -> chase when Mây comes within 6 m; -> stunned on Tỏa Sáng; -> wander when the lantern is out or > 2 m away', () => {
  const d = (o = {}) => sc({ lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [0, 1, 25], state: 'drain', target_lantern_id: 'L1' }], ...o });
  assert.equal(run({ scenario: d({ player: { pos: [0, 0, 19.5] } }), ticks: 2 }).snap(1).shades[0].state, 'chase'); // 5.5 m
  assert.equal(run({ scenario: d({ player: { pos: [0, 0, 19.1] } }), ticks: 2 }).snap(1).shades[0].state, 'chase'); // 5.9 m: chase
  assert.equal(run({ scenario: d({ player: { pos: [0, 0, 18.9] } }), ticks: 2 }).snap(1).shades[0].state, 'drain'); // 6.1 m: still draining
  assert.equal(run({ scenario: d({ ...far }), ticks: 2 }).snap(1).shades[0].state, 'drain'); // Mây far away
  const p = run({ scenario: d({ player: { pos: [0, 0, 21], carried: 3 } }), frames: pressFrames('pulse', [0]), ticks: 3, every: 1 });
  assert.equal(p.snap(1).shades[0].state, 'stunned');
  assert.equal(p.snap(1).score, 15); // +15 in total because it was draining (not 5 + 15)
  const ordinary = run({ scenario: sc({ player: { pos: [0, 0, 21], carried: 3 }, shades: [{ id: 'S1', pos: [0, 1, 25] }] }), frames: pressFrames('pulse', [0]), ticks: 3 });
  assert.equal(ordinary.snaps.at(-1).score, 5); // a shade that was not draining: +5
  const gone = run({ scenario: sc({ ...far, lanterns: [{ id: 'L1', lit: true, fuel: 0.5 }], shades: [{ id: 'S1', pos: [0, 1, 25], state: 'drain', target_lantern_id: 'L1' }] }), ticks: 8, every: 1 });
  // 30 units at 1 + 5 per tick: the lantern is out at tick 5, the shade lets go in the same tick
  assert.equal(gone.snap(4).shades[0].state, 'drain'); assert.equal(gone.ev('lantern_out')[0].tick, 5); assert.equal(gone.snap(5).shades[0].state, 'wander');
  const away = run({ scenario: sc({ ...far, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [0, 1, 27.5], state: 'drain', target_lantern_id: 'L1' }] }), ticks: 2 });
  assert.equal(away.snap(1).shades[0].state, 'wander'); // 2.5 m > 2 m
  // after stun it returns to wander
  const st = run({ scenario: d({ player: { pos: [0, 0, 21], carried: 3 } }), frames: pressFrames('pulse', [0]), ticks: 125, every: 1 });
  assert.equal(st.snap(120).shades[0].state, 'stunned'); assert.notEqual(st.snap(121).shades[0].state, 'stunned');
});

test('safe zone needs fuel >= 30: exactly 30 still protects, below 30 does not', () => {
  // L1 fuel 31 burns to exactly 30.0 at tick 60, to 29.98 at tick 61
  const x = run({ scenario: sc({ player: { pos: L1 }, lanterns: [{ id: 'L1', lit: true, fuel: 31 }], shades: [{ id: 'S1', pos: [7, 1, 25], state: 'chase' }] }), ticks: 100, every: 1 });
  for (let t = 1; t <= 60; t++) assert.ok(dist(x.snap(t).shades[0].pos, L1) >= 5.99, `tick ${t} inside zone`);
  assert.ok(dist(x.snap(100).shades[0].pos, L1) < 5, 'the zone is gone below 30');
  assert.equal(x.snap(60).lanterns[0].fuel, 30);
});

test('refuelling a weak lantern back to >= 30 pushes shades out of its 6 m zone within 30 ticks, no damage meanwhile', () => {
  const x = run({ scenario: sc({ player: { pos: [0, 0, 24.5], carried: 5 }, lanterns: [{ id: 'L1', lit: true, fuel: 10 }], shades: [{ id: 'S1', pos: [0, 1, 25.2], state: 'chase' }] }), frames: pressFrames('interact', [0]), ticks: 40, every: 1 });
  assert.equal(x.ev('refuel').length, 1);
  assert.equal(x.ev('player_hit').length, 0);
  assert.ok(dist(x.snap(30).shades[0].pos, L1) >= 5.99);
  assert.ok(dist(x.snap(10).shades[0].pos, L1) < 6);
  const stays = run({ scenario: sc({ player: { pos: [0, 0, 24.5], carried: 1 }, lanterns: [{ id: 'L1', lit: true, fuel: 10 }], shades: [{ id: 'S1', pos: [0, 1, 25.2], state: 'chase' }] }), frames: pressFrames('interact', [0]), ticks: 10 });
  assert.equal(stays.ev('player_hit').length, 1); // 1 mote only brings it to ~20: still no zone, the shade hits Mây
});

test('score: +5 per mote deposited or refuelled; unchanged +5 per Tỏa Sáng hit; no time bonus', () => {
  const x = run({ scenario: sc({ player: { pos: [0, 0, 24], carried: 8 }, lanterns: [{ id: 'L1', lit: true, fuel: 40 }] }), frames: pressFrames('interact', [0]), ticks: 2 });
  assert.equal(x.snaps.at(-1).score, 7 * 5); // fuel is 39.98 after the first tick's burn: ceil(60.02 / 10) = 7 motes
});

test('Contract v1.2: durations 240 / 270 / 300 s, game_over never says all_lit, new snapshot fields exist on every Night', () => {
  for (const [night, secs] of [[1, 240], [2, 270], [3, 300]]) {
    const x = run({ night, scenario: sc({ lanterns: [{ id: 'L1', lit: true }] }), ticks: 2 });
    assert.equal(x.snaps[0].time_left_s, secs);
    const l = x.snaps[0].lanterns[0];
    assert.deepEqual(Object.keys(l), ['id', 'pos', 'lit', 'deposited', 'fuel', 'ever_lit', 'relit_count']);
    assert.equal(x.snaps[0].player.capacity, 10);
    const full = run({ night, scenario: sc({ time_left_s: 1 }), ticks: 100 });
    assert.notEqual(last(full.events).data.reason, 'all_lit');
  }
});

test('malformed Ticket-03 scenario fields -> exit 2', () => {
  const bad = [
    { lanterns: [{ id: 'L1', lit: true, fuel: 150 }] }, { lanterns: [{ id: 'L1', fuel: -1 }] }, { lanterns: [{ id: 'L1', ever_lit: 'yes' }] },
    { lanterns: [{ id: 'L1', relit_count: 1.5 }] }, { player: { successful_lights: -1 } }, { shades: [{ pos: [1, 0, 0], target_lantern_id: 7 }] },
  ];
  for (const scenario of bad) assert.equal(run({ scenario, ticks: 3 }).r.status, 2, JSON.stringify(scenario));
  assert.equal(run({ scenario: { shades: [{ pos: [1, 0, 0], state: 'drain', target_lantern_id: 'L1' }] }, ticks: 3 }).r.status, 0);
});

test('determinism holds with fuel, drain and refuel in play', () => {
  const s = { lanterns: [{ id: 'L1', lit: true, fuel: 40 }, { id: 'L2', lit: true, fuel: 15 }], player: { carried: 5, pos: [0, 0, 20] } };
  const a = run({ seed: 9, scenario: s, ticks: 3000, frames: pressFrames('interact', [100, 400]) });
  const b = run({ seed: 9, scenario: s, ticks: 3000, frames: pressFrames('interact', [100, 400]) });
  assert.equal(JSON.stringify(a.lines), JSON.stringify(b.lines));
});
