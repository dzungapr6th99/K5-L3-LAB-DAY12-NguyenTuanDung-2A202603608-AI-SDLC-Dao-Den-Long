// Pure, deterministic game simulation (no DOM, no Three.js, no Date/Math.random).
// Used by BOTH the headless CLI and the web client, so what tests verify is what players play.
import { TUNING as T, WORLD as W } from './tuning.js';
import { makeRng } from './rng.js';

export const TICK_RATE = 60;
const ticks = (s) => Math.round(s * TICK_RATE);
const dist2d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const r3 = (v) => { const x = Math.round(v * 1000) / 1000; return x === 0 ? 0 : x; };

export function createGame({ seed = 0, scenario = {} } = {}) {
  const rng = makeRng(seed);
  const sc = scenario;
  const g = {
    rng,
    steps: 0,
    state: 'playing',
    score: 0,
    timeLeft0: sc.time_left_s ?? T.night1_duration_s,
    events: [],
    prev: { jump: false, interact: false, pulse: false, dash: false },
    held: { move: [0, 0], camYawDeg: 0 },
    player: {
      pos: [0, 0, 0], vy: 0, carried: 0, flames: T.flames,
      invuln: 0, pulseCd: 0, facing: 0, pulseFx: 0,
    },
    lanterns: [], motes: [], shades: [],
    moteSeq: 0, shadeSeq: 0, moteTimer: 0, shadeTimer: 0,
    randomMotes: sc.random_motes ?? (sc.motes === undefined),
    randomShades: sc.random_shades ?? (sc.shades === undefined),
  };

  if (sc.player) {
    if (sc.player.pos) g.player.pos = [...sc.player.pos];
    if (sc.player.carried !== undefined) g.player.carried = sc.player.carried;
    if (sc.player.flames !== undefined) g.player.flames = sc.player.flames;
  }

  for (let i = 0; i < T.lantern_count_night1; i++) {
    const a = (i * 2 * Math.PI) / T.lantern_count_night1;
    g.lanterns.push({
      id: `L${i + 1}`,
      pos: [r3(Math.sin(a) * W.lantern_ring_radius), 0, r3(Math.cos(a) * W.lantern_ring_radius)],
      lit: false, deposited: 0,
    });
  }
  for (const u of sc.lanterns ?? []) {
    const l = g.lanterns.find((x) => x.id === u.id);
    if (!l) continue; // unknown id: ignored
    if (u.pos) l.pos = [...u.pos];
    if (u.deposited !== undefined) l.deposited = u.deposited;
    if (u.lit === true) { l.lit = true; l.deposited = Math.max(l.deposited, T.lantern_cost); }
    else if (u.lit === false) l.lit = false;
    else if (l.deposited >= T.lantern_cost) l.lit = true;
  }

  if (sc.motes) for (const p of sc.motes) addMote(g, p);
  else if (g.randomMotes) for (let i = 0; i < W.random_mote_count; i++) addMote(g, randomIslandPoint(g, 4, 36));

  if (sc.shades) {
    for (const s of sc.shades) {
      const id = s.id ?? `S${++g.shadeSeq}`;
      const m = /^S(\d+)$/.exec(id);
      if (m) g.shadeSeq = Math.max(g.shadeSeq, Number(m[1]));
      g.shades.push({ id, pos: [...s.pos], state: 'chase', stun: 0 });
    }
  } else if (g.randomShades) {
    for (let i = 0; i < W.initial_shades; i++) g.shades.push(newShade(g));
  }
  g.shadeTimer = ticks(W.shade_spawn_interval_s);
  return g;
}

function addMote(g, p) { g.motes.push({ id: `M${++g.moteSeq}`, pos: [p[0], p[1] ?? 0, p[2]] }); }

function randomIslandPoint(g, rmin, rmax) {
  const a = g.rng.range(0, 2 * Math.PI);
  const r = Math.sqrt(g.rng.range(rmin * rmin, rmax * rmax));
  return [r3(Math.sin(a) * r), 0, r3(Math.cos(a) * r)];
}

function newShade(g) {
  let pos;
  for (let tries = 0; tries < 20; tries++) {
    const a = g.rng.range(0, 2 * Math.PI);
    pos = [r3(Math.sin(a) * 34), W.shade_y, r3(Math.cos(a) * 34)];
    if (dist2d(pos, g.player.pos) >= W.shade_spawn_min_dist) break;
  }
  return { id: `S${++g.shadeSeq}`, pos, state: 'chase', stun: 0 };
}

function emit(g, name, data) { g.events.push({ tick: g.steps, name, data }); }
const litLanterns = (g) => g.lanterns.filter((l) => l.lit);

function enforceSafeRadius(g, shade) {
  for (const l of litLanterns(g)) {
    let dx = shade.pos[0] - l.pos[0], dz = shade.pos[2] - l.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < T.safe_radius) {
      if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
      shade.pos[0] = l.pos[0] + dx * T.safe_radius;
      shade.pos[2] = l.pos[2] + dz * T.safe_radius;
    }
  }
}

function finish(g, result, reason) {
  if (result === 'won') {
    const tl = Math.max(0, timeLeft(g));
    g.score += T.score.per_second_left * Math.floor(tl) + T.score.per_flame_left * g.player.flames;
  }
  g.state = result;
  emit(g, 'game_over', { result, reason });
}

export const timeLeft = (g) => g.timeLeft0 - g.steps / TICK_RATE;

// input: { move:[x,z], camYawDeg, jump, interact, pulse, dash } (held values; edges detected here)
export function stepGame(g, input = {}) {
  if (g.state !== 'playing') return;
  const dt = 1 / TICK_RATE;
  const p = g.player;
  g.steps += 1;

  if (input.move) g.held.move = input.move;
  if (input.camYawDeg !== undefined) g.held.camYawDeg = input.camYawDeg;
  const edge = (k) => { const now = !!input[k]; const e = now && !g.prev[k]; g.prev[k] = now; return e; };
  const jumpE = edge('jump'), interactE = edge('interact'), pulseE = edge('pulse');
  edge('dash');

  // --- movement (camera relative) ---
  let [mx, mz] = g.held.move;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = (g.held.camYawDeg * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  p.pos[0] += wx * T.player_speed * dt;
  p.pos[2] += wz * T.player_speed * dt;
  if (wx !== 0 || wz !== 0) p.facing = Math.atan2(wx, wz);
  const fromCenter = Math.hypot(p.pos[0], p.pos[2]); // soft wall, no fall (fall_enabled=false)
  if (fromCenter > W.island_radius) {
    p.pos[0] *= W.island_radius / fromCenter;
    p.pos[2] *= W.island_radius / fromCenter;
  }
  if (jumpE && p.pos[1] <= 0 && p.vy === 0) p.vy = W.jump_speed;
  if (p.pos[1] > 0 || p.vy > 0) {
    p.vy -= W.gravity * dt;
    p.pos[1] += p.vy * dt;
    if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
  }

  // --- pick up motes ---
  for (let i = 0; i < g.motes.length && p.carried < T.carry_capacity;) {
    if (dist2d(g.motes[i].pos, p.pos) <= T.pickup_radius) {
      g.motes.splice(i, 1);
      p.carried += 1;
      g.score += T.score.per_mote;
      emit(g, 'mote_picked', { carried: p.carried });
    } else i += 1;
  }

  // --- deposit into nearest unlit lantern in range ---
  if (interactE && p.carried > 0) {
    let best = null, bd = Infinity;
    for (const l of g.lanterns) {
      const d = dist2d(l.pos, p.pos);
      if (!l.lit && d <= T.interact_radius && d < bd) { best = l; bd = d; }
    }
    if (best) {
      const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
      p.carried -= amount;
      best.deposited += amount;
      emit(g, 'deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      if (best.deposited >= T.lantern_cost) {
        best.lit = true;
        g.score += T.score.per_lantern;
        emit(g, 'lantern_lit', { lantern_id: best.id });
      }
    }
  }

  // --- pulse ---
  if (pulseE && p.pulseCd <= 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = ticks(T.pulse_cooldown_s);
    p.pulseFx = 20;
    const stunned = [];
    for (const s of g.shades) {
      if (dist2d(s.pos, p.pos) > T.pulse_radius) continue;
      let dx = s.pos[0] - p.pos[0], dz = s.pos[2] - p.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
      s.pos[0] += dx * T.pulse_push_m;
      s.pos[2] += dz * T.pulse_push_m;
      s.state = 'stunned';
      s.stun = ticks(T.pulse_stun_s);
      g.score += T.score.per_stun;
      stunned.push(s.id);
      enforceSafeRadius(g, s);
    }
    emit(g, 'pulse', { stunned_ids: stunned });
  }

  // --- shades ---
  for (const s of g.shades) {
    if (s.state === 'stunned') {
      s.stun -= 1;
      if (s.stun <= 0) { s.state = 'chase'; s.stun = 0; }
    } else {
      const dx = p.pos[0] - s.pos[0], dz = p.pos[2] - s.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 1e-9) {
        const step = Math.min(d, T.shade_speed * dt);
        s.pos[0] += (dx / d) * step;
        s.pos[2] += (dz / d) * step;
      }
      enforceSafeRadius(g, s);
    }
  }

  // --- shade hits ---
  if (p.invuln > 0) p.invuln -= 1;
  else {
    const hit = g.shades.find((s) => s.state !== 'stunned' && dist2d(s.pos, p.pos) <= T.shade_hit_radius);
    if (hit) {
      p.flames -= 1;
      const dropped = Math.floor(p.carried * T.hit_drop_ratio);
      p.carried -= dropped;
      for (let i = 0; i < dropped; i++) {
        const a = g.rng.range(0, 2 * Math.PI), r = g.rng.range(W.hit_scatter_min, W.hit_scatter_max);
        let x = p.pos[0] + Math.sin(a) * r, z = p.pos[2] + Math.cos(a) * r;
        const c = Math.hypot(x, z);
        if (c > W.island_radius) { x *= W.island_radius / c; z *= W.island_radius / c; }
        addMote(g, [r3(x), 0, r3(z)]);
      }
      p.invuln = ticks(T.invuln_s);
      emit(g, 'player_hit', { by: 'shade', flames: p.flames, dropped });
    }
  }
  if (p.pulseCd > 0) p.pulseCd -= 1;
  if (p.pulseFx > 0) p.pulseFx -= 1;

  // --- spawners (only when random_* is on) ---
  if (g.randomMotes && g.motes.length < W.random_mote_count && ++g.moteTimer >= W.mote_respawn_ticks) {
    g.moteTimer = 0;
    addMote(g, randomIslandPoint(g, 4, 36));
  }
  if (g.randomShades && --g.shadeTimer <= 0) {
    g.shadeTimer = ticks(W.shade_spawn_interval_s);
    if (g.shades.length < W.shade_max) {
      const s = newShade(g);
      g.shades.push(s);
      emit(g, 'shade_spawned', { id: s.id });
    }
  }

  // --- end conditions (loss by flames takes priority over a same-step win) ---
  if (p.flames <= 0) finish(g, 'lost', 'no_flames');
  else if (g.lanterns.every((l) => l.lit)) finish(g, 'won', 'all_lit');
  else if (timeLeft(g) <= 1e-9) finish(g, 'lost', 'dawn');
}

export function snapshot(g) {
  const p = g.player;
  return {
    type: 'snapshot',
    tick: g.steps,
    sim_tick: g.steps,
    state: g.state,
    time_left_s: r3(Math.max(0, timeLeft(g))),
    score: g.score,
    player: { pos: p.pos.map(r3), flames: p.flames, carried: p.carried },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3) })),
  };
}

export function eventLine(e) { return { type: 'event', tick: e.tick, name: e.name, data: e.data }; }
