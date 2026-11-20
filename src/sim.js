// Pure, deterministic game simulation for Contract v1.1 (Ticket-02).
// No DOM, no Three.js, no Date/Math.random. Shared by the headless CLI and the web client.
// One call to stepGame() = one tick, processed in the mandatory order of the ticket (steps 1-11).
import { TUNING as T, RULES as R } from './tuning.js';
import { makeRng, r3 } from './rng.js';
import { getMap, groundAt, blockedAt, walkFloor } from './maps.js';

export const TICK_RATE = 60;
const FUEL_UNIT = TICK_RATE;                       // fuel is kept in integer 1/60 units to avoid float drift
const FUEL_MAX = T.fuel_max * FUEL_UNIT, FUEL_LOW = T.low_fuel_threshold * FUEL_UNIT;
const f1 = (u) => Math.round((u / FUEL_UNIT) * 10) / 10;
const hasZone = (l) => l.lit && l.fuel >= FUEL_LOW; // exactly 30 keeps the safe zone
const ticks = (s) => Math.round(s * TICK_RATE);
const dxz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const idNum = (id) => Number(/(\d+)$/.exec(id)?.[1] ?? 0);
const byId = (a, b) => idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Unit vector pointing from `from` to `to` on XZ; +X when coincident. */
function away(from, to) {
  const dx = to[0] - from[0], dz = to[2] - from[2], d = Math.hypot(dx, dz);
  return d < 1e-9 ? [1, 0] : [dx / d, dz / d];
}

export function createGame({ seed = 0, night = 1, scenario = {}, bench = false } = {}) {
  const map = getMap(night);
  const sc = scenario;
  const rng = makeRng(seed);
  const g = {
    map, night, rng,
    steps: 0, simSteps: 0, paused: false, state: 'playing', score: 0,
    ticksLeft0: Math.round((sc.time_left_s ?? map.duration_s) * TICK_RATE),
    events: [],
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    held: { move: [0, 0], camYawDeg: 0 },
    player: {
      pos: [...map.start], vel: [0, 0, 0], vy: 0, grounded: true, carried: 0, flames: T.flames,
      invuln: 0, dashCd: 0, dashT: 0, dashDir: [0, 1], pulseCd: 0, charm: 0, facing: 0,
      launch: null, fallWait: 0, pulseFx: 0,
    },
    successfulLights: sc.player?.successful_lights ?? 0,
    lanterns: [], motes: [], shades: [], drifters: [], charms: [],
    seq: { M: 0, S: 0, D: 0 },
    randomMotes: sc.random_motes ?? (sc.motes === undefined),
    randomShades: sc.random_shades ?? (sc.shades === undefined),
    randomDrifters: map.drifters && (sc.random_drifters ?? (sc.drifters === undefined)),
    wind: { enabled: sc.wind_enabled ?? map.wind, active: false, dirDeg: 0, endTick: 0, warn: false },
  };
  const p = g.player;

  if (sc.player) {
    const sp = sc.player;
    if (sp.pos) p.pos = [...sp.pos];
    if (sp.carried !== undefined) p.carried = sp.carried;
    if (sp.flames !== undefined) p.flames = sp.flames;
    if (sp.invuln_ticks !== undefined) p.invuln = sp.invuln_ticks;
    if (sp.dash_cd_ticks !== undefined) p.dashCd = sp.dash_cd_ticks;
    if (sp.pulse_cd_ticks !== undefined) p.pulseCd = sp.pulse_cd_ticks;
    if (sp.charm_ticks !== undefined) p.charm = sp.charm_ticks;
  }
  const f0 = groundAt(map, p.pos[0], p.pos[2], p.pos[1]);
  p.grounded = f0 !== null && Math.abs(p.pos[1] - f0) < 1e-9;

  map.lanterns.forEach((pos, i) => g.lanterns.push({ id: `L${i + 1}`, pos: [...pos], lit: false, deposited: 0, fuel: 0, everLit: false, relit: 0 }));
  for (const u of sc.lanterns ?? []) {
    const l = g.lanterns.find((x) => x.id === u.id);
    if (!l) continue; // unknown id: ignored
    if (u.pos) l.pos = [...u.pos];
    if (u.deposited !== undefined) l.deposited = u.deposited;
    if (u.relit_count !== undefined) l.relit = u.relit_count;
    if (u.ever_lit !== undefined) l.everLit = u.ever_lit;
    const lit = u.lit ?? (u.fuel !== undefined ? u.fuel > 0 : l.deposited >= (l.everLit ? T.relight_cost : T.lantern_cost));
    if (lit) { // placed by the scenario: free, no event, no points, not a "successful light"
      l.lit = true; l.fuel = Math.round((u.fuel ?? T.fuel_max) * FUEL_UNIT);
      l.deposited = Math.max(l.deposited, T.lantern_cost); l.everLit = u.ever_lit ?? true;
    } else { l.lit = false; l.fuel = 0; }
  }

  if (sc.motes) {
    for (const m of sc.motes) {
      if (Array.isArray(m)) addMote(g, m, 'random', null, -1);
      else addMote(g, m.pos, m.kind ?? 'random', m.ttl_ticks ?? null, -1);
    }
  } else if (g.randomMotes) {
    const idx = map.motePoints.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    for (const i of idx.slice(0, Math.min(R.mote_start, idx.length)).sort((a, b) => a - b)) addMote(g, map.motePoints[i], 'random', null, i);
  }

  for (const s of sc.shades ?? []) {
    const id = s.id ?? `S${++g.seq.S}`;
    g.seq.S = Math.max(g.seq.S, idNum(id));
    const sh = makeShade(g, id, s.pos, s.state ?? 'wander', s.state_ticks_left ?? 0, s.pos[1]);
    sh.target = s.target_lantern_id ?? null;
    if (sh.state === 'stunned') { sh.pushLeft = 0; if (!sh.ticks) sh.ticks = ticks(T.pulse_stun_s); }
    g.shades.push(sh);
  }

  const charmDefs = sc.charms ?? map.charms.map((c) => ({ ...c, available: true }));
  for (const c of charmDefs) {
    g.charms.push({ id: c.id, pos: [...(c.pos ?? map.charms.find((m) => m.id === c.id)?.pos ?? [0, 0, 0])],
      available: c.available ?? true, respawn: c.respawn_ticks ?? 0 });
  }
  for (const d of sc.drifters ?? []) {
    const id = d.id ?? `D${++g.seq.D}`;
    g.seq.D = Math.max(g.seq.D, idNum(id));
    g.drifters.push(makeDrifter(id, d.pos, d.state ?? 'idle', d.stolen ?? 0, d.state_ticks_left ?? 0));
  }
  if (g.wind.enabled) g.wind.dirDeg = Math.floor(rng.next() * 360);
  if (bench) setupBench(g); // Ticket-04 benchmark scene (never used by the headless CLI)
  return g;
}

/** Standard benchmark scene: Night 1, 200 wandering shades spread over the island, 100 motes, L1-L3 lit with fuel 100. */
function setupBench(g) {
  g.bench = true;
  g.randomMotes = g.randomShades = g.randomDrifters = false;
  g.wind.enabled = false;
  g.motes = []; g.shades = []; g.drifters = []; g.charms = [];
  g.player.pos = [0, 0, 0];
  g.lanterns.forEach((l, i) => {
    l.lit = i < 3; l.fuel = i < 3 ? FUEL_MAX : 0; l.everLit = i < 3; l.deposited = i < 3 ? T.lantern_cost : 0;
  });
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spread = (n, radius, add) => { // sunflower spiral, rotated and jittered by the seed: even coverage of the disc
    const rot = g.rng.range(0, 2 * Math.PI);
    for (let i = 0; i < n; i++) {
      const r = Math.min(radius, radius * Math.sqrt((i + 0.5) / n) + g.rng.range(-0.4, 0.4)), a = rot + i * golden;
      add([r3(Math.cos(a) * r), 0, r3(Math.sin(a) * r)]);
    }
  };
  spread(100, 36, (p) => addMote(g, p, 'random', null, -1));
  spread(200, 38, (p) => g.shades.push(makeShade(g, `S${++g.seq.S}`, p, 'wander', 0, 1)));
}

// ---------- entity helpers ----------
function addMote(g, p, kind, ttl, pt) {
  const m = { id: `M${++g.seq.M}`, pos: [p[0], p[1] ?? 0, p[2]], kind, ttl, pt };
  g.motes.push(m);
  return m;
}

function makeShade(g, id, pos, state, ticksLeft, y) {
  const fl = groundAt(g.map, pos[0], pos[2], y ?? pos[1] ?? 0) ?? 0;
  const h = (y ?? 1) - fl;
  return {
    id, pos: [pos[0], fl + h, pos[2]], floor: fl, h, state, ticks: ticksLeft,
    pushLeft: 0, pushVec: [0, 0], recoilDir: [1, 0], safePush: 0, wdir: [0, 0], wt: 0, target: null, drainT: 0,
  };
}

function makeDrifter(id, pos, state, stolen, ticksLeft) {
  return { id, pos: [...pos], state, stolen, ticks: ticksLeft, used: stolen > 0 || state === 'flee', wdir: [0, 0], wt: 0 };
}

function emit(g, name, data) { g.events.push({ tick: g.steps, name, data }); }
const zoneLanterns = (g) => g.lanterns.filter(hasZone);
export const capacity = (g) => Math.min(T.capacity_max, T.carry_capacity + R.capacity_per_light * g.successfulLights);

function enforceSafe(g, s) {
  if (s.safePush > 0) return;
  for (const l of zoneLanterns(g)) {
    const d = dxz(s.pos, l.pos);
    if (d < T.safe_radius) {
      const [ux, uz] = away(l.pos, s.pos);
      s.pos[0] = l.pos[0] + ux * T.safe_radius;
      s.pos[2] = l.pos[2] + uz * T.safe_radius;
    }
  }
}

/** Try to move a shade by (dx,dz); slides along an axis if the diagonal is blocked. */
function moveShade(g, s, dx, dz) {
  for (const [mx, mz] of [[dx, dz], [dx, 0], [0, dz]]) {
    if (mx === 0 && mz === 0) continue;
    const nx = s.pos[0] + mx, nz = s.pos[2] + mz;
    const fl = walkFloor(g.map, nx, nz, s.floor);
    if (fl !== null) { s.pos = [nx, fl + s.h, nz]; s.floor = fl; return true; }
  }
  return false;
}

const weakLanterns = (g) => g.lanterns.filter((l) => l.lit && l.fuel < FUEL_LOW);
/** Wandering shades go to the nearest lit lantern with fuel < 30 (ties: smaller id), else the nearest dark one. */
function pickTarget(g, s) {
  const nearest = (list) => {
    let best = null, bd = Infinity;
    for (const l of list) {
      const d = dxz(l.pos, s.pos);
      if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && idNum(l.id) < idNum(best.id))) { best = l; bd = d; }
    }
    return best;
  };
  return nearest(weakLanterns(g)) ?? nearest(g.lanterns.filter((l) => !l.lit));
}

function dropMotes(g, count, cx, cz, refY, rmin, rmax) {
  for (let i = 0; i < count; i++) {
    let placed = false;
    for (let tries = 0; tries < 6 && !placed; tries++) {
      const a = g.rng.range(0, 2 * Math.PI), r = rmax > 0 ? g.rng.range(rmin, rmax) : 0;
      const x = r3(cx + Math.cos(a) * r), z = r3(cz + Math.sin(a) * r);
      const y = groundAt(g.map, x, z, refY);
      if (y !== null) { addMote(g, [x, y, z], 'dropped', R.dropped_ttl_ticks, -1); placed = true; }
    }
    if (!placed) addMote(g, [cx, refY, cz], 'dropped', R.dropped_ttl_ticks, -1);
  }
}

const timeLeftTicks = (g) => g.ticksLeft0 - g.simSteps;
export const timeLeft = (g) => timeLeftTicks(g) / TICK_RATE;

function finish(g, result, reason) {
  if (result === 'won') {
    for (const l of g.lanterns) if (l.lit) g.score += T.score.per_lit_lantern_dawn + Math.floor(l.fuel / FUEL_UNIT);
    g.score += T.score.per_flame_left * g.player.flames;
  }
  g.state = result;
  emit(g, 'game_over', { result, reason });
}

// ---------- the tick ----------
// input: { move:[x,z], camYawDeg, jump, interact, pulse, dash, pause } held values; edges are detected here.
export function stepGame(g, input = {}) {
  if (g.state !== 'playing') return;
  const dt = 1 / TICK_RATE;
  const p = g.player, map = g.map;
  g.steps += 1;

  // 1. read input (pause first)
  if (input.move) g.held.move = input.move;
  if (input.camYawDeg !== undefined) g.held.camYawDeg = input.camYawDeg;
  const edge = (k) => { const now = !!input[k]; const e = now && !g.prev[k]; g.prev[k] = now; return e; };
  const jumpE = edge('jump'), interactE = edge('interact'), pulseE = edge('pulse'), dashE = edge('dash'), pauseE = edge('pause');
  if (g.steps === 1) emit(g, 'night_start', { night: g.night });
  if (pauseE) {
    if (!g.paused) { g.paused = true; emit(g, 'paused', {}); return; }
    g.paused = false; emit(g, 'resumed', {});
  }
  if (g.paused) return;
  g.simSteps += 1;
  const sim = g.simSteps;

  // 2. decrement counters
  for (const k of ['invuln', 'dashCd', 'pulseCd', 'charm', 'pulseFx']) if (p[k] > 0) p[k] -= 1;
  for (const m of g.motes) if (m.ttl !== null && m.ttl > 0) m.ttl -= 1;
  g.motes = g.motes.filter((m) => m.ttl === null || m.ttl > 0);
  for (const c of g.charms) if (!c.available && --c.respawn <= 0) { c.available = true; c.respawn = 0; }
  for (const s of g.shades) {
    if (s.state === 'stunned' || s.state === 'recoil' || s.state === 'spawning') {
      if (s.ticks > 0) s.ticks -= 1;
      if (s.ticks <= 0) { s.state = 'wander'; s.ticks = 0; s.pushLeft = 0; }
    }
  }
  for (const l of g.lanterns) { // lantern fuel: decay 1/s plus 5/s per draining shade; out at <= 0
    if (!l.lit || g.bench) continue;
    const drainers = g.shades.filter((s) => s.state === 'drain' && s.target === l.id);
    l.fuel -= T.fuel_decay_per_s + drainers.length * T.drain_per_s;
    for (const s of drainers) if (++s.drainT % R.drain_event_every === 0) emit(g, 'fuel_drain', { lantern_id: l.id, shade_id: s.id, fuel: f1(Math.max(0, l.fuel)) });
  }
  for (const l of g.lanterns) {
    if (l.lit && l.fuel <= 0) { l.lit = false; l.fuel = 0; l.deposited = 0; emit(g, 'lantern_out', { lantern_id: l.id }); }
  }
  if (g.wind.enabled) {
    if (g.wind.active && sim >= g.wind.endTick) { g.wind.active = false; g.wind.dirDeg = Math.floor(g.rng.next() * 360); }
    if (!g.wind.active && sim % R.wind_every === 0) { g.wind.active = true; g.wind.endTick = sim + R.wind_len; }
    g.wind.warn = !g.wind.active && R.wind_every - (sim % R.wind_every) <= R.wind_warn;
  }
  if (p.fallWait > 0 && --p.fallWait === 0) { // respawn at the start point
    p.pos = [...map.start]; p.vel = [0, 0, 0]; p.vy = 0; p.grounded = true; p.launch = null; p.dashT = 0;
    p.invuln = R.respawn_invuln_ticks;
  }
  const away_ = p.fallWait > 0; // waiting to respawn: no pickups, no contact

  // 3. move the player, then check for a fall
  if (!away_) {
    let [mx, mz] = g.held.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = (g.held.camYawDeg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th), wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const moving = Math.hypot(wx, wz) > 1e-9;
    if (moving && p.dashT <= 0) p.facing = Math.atan2(wx, wz);

    if (dashE && p.dashT <= 0 && (p.dashCd <= 0 || p.charm > 0)) {
      p.dashDir = moving ? [wx / Math.hypot(wx, wz), wz / Math.hypot(wx, wz)] : [Math.sin(p.facing), Math.cos(p.facing)];
      p.dashT = ticks(T.dash_duration_s);
      p.dashCd = p.charm > 0 ? 0 : ticks(T.dash_cooldown_s);
      emit(g, 'dash', {});
    }
    if (jumpE && p.grounded) { p.vy = R.jump_speed; p.grounded = false; }

    const speed = p.charm > 0 ? R.charm_speed : T.player_speed;
    let hvx, hvz;
    if (p.dashT > 0) { hvx = p.dashDir[0] * T.dash_speed; hvz = p.dashDir[1] * T.dash_speed; }
    else if (p.launch) { [hvx, hvz] = p.launch; }
    else { hvx = wx * speed; hvz = wz * speed; }
    if (g.wind.enabled && g.wind.active) {
      hvx += Math.cos((g.wind.dirDeg * Math.PI) / 180) * R.wind_push;
      hvz += Math.sin((g.wind.dirDeg * Math.PI) / 180) * R.wind_push;
    }
    for (const [ax, az] of [[hvx * dt, hvz * dt], [hvx * dt, 0], [0, hvz * dt]]) {
      if (ax === 0 && az === 0) continue;
      if (!blockedAt(map, p.pos[0] + ax, p.pos[2] + az, p.pos[1])) { p.pos[0] += ax; p.pos[2] += az; break; }
    }

    // vertical
    const prevY = p.pos[1];
    const dashingAir = p.dashT > 0 && !p.grounded;
    if (!p.grounded) {
      if (dashingAir) p.vy = 0;
      else p.vy -= R.gravity * dt;
      p.pos[1] += p.vy * dt;
      const gr = groundAt(map, p.pos[0], p.pos[2], prevY);
      if (p.vy <= 0 && gr !== null && p.pos[1] <= gr) { p.pos[1] = gr; p.vy = 0; p.grounded = true; p.launch = null; }
    } else {
      const gr = groundAt(map, p.pos[0], p.pos[2], p.pos[1]);
      if (gr === null || p.pos[1] - gr > R.step_height) { p.grounded = false; p.vy = 0; } else p.pos[1] = gr;
    }
    p.vel = [hvx, p.vy, hvz];
    if (p.dashT > 0) p.dashT -= 1;

    // bounce pads
    if (!p.launch) {
      for (const pad of map.pads) {
        if (Math.hypot(p.pos[0] - pad.pos[0], p.pos[2] - pad.pos[2]) <= pad.radius && Math.abs(p.pos[1] - pad.pos[1]) <= 0.5) {
          const [ux, uz] = pad.dir ?? away(pad.pos, pad.target);
          p.launch = [ux * pad.hspeed, uz * pad.hspeed];
          p.vy = pad.vy; p.grounded = false;
          break;
        }
      }
    }

    // fall off the island
    if (p.pos[1] < R.fall_y) {
      const lost = p.carried;
      p.flames -= 1; p.carried = 0; p.fallWait = R.fall_wait_ticks;
      p.vel = [0, 0, 0]; p.launch = null; p.dashT = 0;
      emit(g, 'player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    }
  }

  // 4. pick up motes and charms
  if (!away_ && !g.bench) {
    for (let i = 0; i < g.motes.length && p.carried < capacity(g);) {
      const m = g.motes[i];
      if (dxz(m.pos, p.pos) <= T.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= R.pickup_dy) {
        g.motes.splice(i, 1); p.carried += 1;
        emit(g, 'mote_picked', { carried: p.carried });
      } else i += 1;
    }
    for (const c of g.charms) {
      if (c.available && dxz(c.pos, p.pos) <= T.pickup_radius && Math.abs(p.pos[1] - c.pos[1]) <= R.pickup_dy) {
        c.available = false; c.respawn = R.charm_respawn_ticks; p.charm = R.charm_ticks;
        emit(g, 'charm_picked', { charm_id: c.id, charm_ticks: p.charm });
      }
    }
  }

  // 5. lantern interaction
  const zone0 = new Set(g.lanterns.filter(hasZone).map((l) => l.id));
  if (interactE && !away_ && p.carried > 0) {
    let best = null, bd = Infinity;
    for (const l of g.lanterns) { // only lanterns that can take something: unlit, or lit but not full
      const d = dxz(l.pos, p.pos);
      const takes = !l.lit || l.fuel < FUEL_MAX;
      if (takes && d <= T.interact_radius && (d < bd || (d === bd && idNum(l.id) < idNum(best.id)))) { best = l; bd = d; }
    }
    if (best && !best.lit) {
      const need = best.everLit ? T.relight_cost : T.lantern_cost; // a lantern that was lit before only needs 5
      const amount = Math.min(p.carried, Math.max(0, need - best.deposited));
      if (amount > 0) {
        p.carried -= amount; best.deposited += amount;
        g.score += amount * T.score.per_mote;
        emit(g, 'deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      }
      if (best.deposited >= need) {
        const relight = best.everLit;
        best.lit = true; best.fuel = FUEL_MAX; best.everLit = true;
        if (relight) best.relit += 1;
        g.successfulLights += 1;
        g.score += relight ? T.score.per_relight : T.score.per_lantern;
        emit(g, 'lantern_lit', { lantern_id: best.id, relight });
      }
    } else if (best) { // refuel a burning lantern: 10 fuel per mote
      const per = T.fuel_per_mote * FUEL_UNIT;
      const used = Math.min(p.carried, Math.ceil((FUEL_MAX - best.fuel) / per));
      best.fuel = Math.min(FUEL_MAX, best.fuel + used * per);
      p.carried -= used;
      g.score += used * T.score.per_mote;
      emit(g, 'refuel', { lantern_id: best.id, amount: used, fuel: f1(best.fuel) });
    }
  }

  // 6. safe zones: shades inside a zone that has just come back (lit, or refuelled to >= 30) are pushed out over <= 30 ticks
  for (const l of g.lanterns) {
    if (!hasZone(l) || zone0.has(l.id)) continue;
    for (const s of g.shades) {
      if (dxz(s.pos, l.pos) >= T.safe_radius) continue;
      s.safePush = R.safe_push_ticks; s.safeFrom = l;
      if (s.state === 'drain') { s.state = 'wander'; s.drainT = 0; }
    }
  }

  // 7. Tỏa Sáng
  if (pulseE && !away_ && p.pulseCd <= 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost; p.pulseCd = ticks(T.pulse_cooldown_s); p.pulseFx = 20;
    const center = [p.pos[0], p.pos[1] + R.pulse_center_dy, p.pos[2]];
    const stunned = [];
    for (const s of g.shades) {
      if (dist3(center, s.pos) > T.pulse_radius) continue;
      const [ux, uz] = away(p.pos, s.pos);
      const wasDraining = s.state === 'drain';
      s.state = 'stunned'; s.ticks = ticks(T.pulse_stun_s); s.pushLeft = R.pulse_push_ticks;
      s.pushVec = [(ux * T.pulse_push_m) / R.pulse_push_ticks, (uz * T.pulse_push_m) / R.pulse_push_ticks];
      g.score += wasDraining ? T.score.per_stun_drain : T.score.per_stun; // 15 in total if it was draining
      s.drainT = 0;
      stunned.push(s.id);
    }
    for (const d of g.drifters) {
      if (dist3(center, d.pos) > T.pulse_radius) continue;
      if (d.state === 'chase') { d.state = 'flee'; d.ticks = R.drifter_flee_ticks; d.used = true; }
      else if (d.state === 'flee' && d.stolen > 0) {
        emit(g, 'drifter_drop', { drifter_id: d.id, amount: d.stolen });
        const y = groundAt(map, d.pos[0], d.pos[2], p.pos[1] + 2) ?? p.pos[1];
        for (let i = 0; i < d.stolen; i++) addMote(g, [d.pos[0], y, d.pos[2]], 'dropped', R.dropped_ttl_ticks, -1);
        d.stolen = 0; d.ticks = R.drifter_drop_vanish_ticks;
      }
    }
    emit(g, 'pulse', { stunned_ids: stunned });
  }

  // 8. move shades and drifters
  for (const s of g.shades) {
    if (s.safePush > 0) {
      const from = s.safeFrom, d = dxz(s.pos, from.pos), need = T.safe_radius - d;
      if (need > 0) { const [ux, uz] = away(from.pos, s.pos); moveShade(g, s, (ux * need) / s.safePush, (uz * need) / s.safePush); }
      s.safePush -= 1;
      continue;
    }
    if (s.state === 'stunned') {
      if (s.pushLeft > 0) { moveShade(g, s, s.pushVec[0], s.pushVec[1]); s.pushLeft -= 1; }
    } else if (s.state === 'recoil') {
      moveShade(g, s, (s.recoilDir[0] * R.recoil_m) / R.recoil_ticks, (s.recoilDir[1] * R.recoil_m) / R.recoil_ticks);
    } else if (s.state === 'wander' || s.state === 'chase' || s.state === 'drain') {
      const d = dxz(s.pos, p.pos);
      if (s.state === 'drain') { // stands still next to a weak lantern and drinks its fuel (see step 2)
        let l = g.lanterns.find((x) => x.id === s.target);
        if (!l) { l = weakLanterns(g).find((x) => dxz(x.pos, s.pos) <= R.drain_range_m); s.target = l?.id ?? null; }
        if (d <= R.drain_exit_player_m) { s.state = 'chase'; s.target = null; s.drainT = 0; }
        else if (!l || !l.lit || l.fuel >= FUEL_LOW || dxz(s.pos, l.pos) > R.drain_range_m) { s.state = 'wander'; s.drainT = 0; }
      } else if (s.state === 'wander' && d <= R.detect_m) s.state = 'chase';
      else if (s.state === 'chase' && d > R.lose_m) s.state = 'wander';
      if (s.state === 'chase') {
        const [ux, uz] = away(s.pos, p.pos);
        const step = Math.min(d, map.shadeSpeed * dt);
        moveShade(g, s, ux * step, uz * step);
      } else if (s.state === 'wander') {
        const tl = pickTarget(g, s); // weak lit lantern first, else nearest dark lantern
        s.target = tl?.id ?? null;
        if (tl) {
          const dl = dxz(s.pos, tl.pos);
          if (tl.lit && dl <= R.drain_range_m) { s.state = 'drain'; s.drainT = 0; }
          else if (dl > R.drain_range_m) {
            const [ux, uz] = away(s.pos, tl.pos);
            const step = Math.min(dl - R.drain_range_m, map.shadeSpeed * dt);
            moveShade(g, s, ux * step, uz * step);
          }
        } else {
          if (--s.wt <= 0) { const a = g.rng.range(0, 2 * Math.PI); s.wdir = [Math.cos(a), Math.sin(a)]; s.wt = 120; }
          if (!moveShade(g, s, s.wdir[0] * R.wander_speed * dt, s.wdir[1] * R.wander_speed * dt)) s.wt = 0;
        }
      }
    }
    enforceSafe(g, s);
  }
  for (const d of [...g.drifters]) {
    if (d.state === 'idle' || d.state === 'chase') {
      const near = p.carried >= R.drifter_trigger_carried && dxz(d.pos, p.pos) <= R.drifter_trigger_m && !d.used;
      d.state = near ? 'chase' : 'idle';
    }
    let vx = 0, vz = 0;
    if (d.state === 'chase') { const [ux, uz] = away(d.pos, p.pos); vx = ux * R.drifter_speed; vz = uz * R.drifter_speed; }
    else if (d.state === 'flee') {
      const [ux, uz] = away(p.pos, d.pos); vx = ux * R.drifter_speed; vz = uz * R.drifter_speed;
      if (--d.ticks <= 0) g.drifters.splice(g.drifters.indexOf(d), 1);
    } else {
      if (--d.wt <= 0) { const a = g.rng.range(0, 2 * Math.PI); d.wdir = [Math.cos(a), Math.sin(a)]; d.wt = 120; }
      vx = d.wdir[0] * R.drifter_idle_speed; vz = d.wdir[1] * R.drifter_idle_speed;
    }
    d.pos[0] += vx * dt; d.pos[2] += vz * dt;
  }

  // 9. contact: drifters steal first, then shades hit (id ascending)
  if (!away_ && !g.bench) {
    for (const d of [...g.drifters].sort(byId)) {
      if (d.state === 'chase' && !d.used && p.carried > 0 && dxz(d.pos, p.pos) <= R.drifter_touch_m) {
        const amount = Math.min(R.drifter_steal, p.carried);
        p.carried -= amount; d.stolen = amount; d.used = true; d.state = 'flee'; d.ticks = R.drifter_flee_ticks;
        emit(g, 'drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
      }
    }
    if (p.invuln <= 0) {
      const hit = [...g.shades].sort(byId).find((s) => s.state !== 'stunned' && s.state !== 'recoil' && s.state !== 'spawning'
        && s.safePush <= 0 && dxz(s.pos, p.pos) <= T.shade_hit_radius && Math.abs(s.pos[1] - p.pos[1]) <= R.hit_dy);
      if (hit) {
        p.flames -= 1;
        const dropped = Math.floor(p.carried * T.hit_drop_ratio);
        p.carried -= dropped;
        dropMotes(g, dropped, p.pos[0], p.pos[2], p.pos[1], R.drop_ring_min, R.drop_ring_max);
        p.invuln = ticks(T.invuln_s);
        hit.state = 'recoil'; hit.ticks = R.recoil_ticks + 1; hit.recoilDir = away(p.pos, hit.pos);
        emit(g, 'player_hit', { by: 'shade', flames: p.flames, dropped });
      }
    }
  }

  // 10. scheduled spawns (new entities only interact from the next tick)
  if (g.randomMotes && sim % R.mote_spawn_every === 0 && g.motes.length < R.mote_cap) {
    const used = new Set(g.motes.map((m) => m.pt));
    const free = map.motePoints.map((_, i) => i).filter((i) => !used.has(i));
    if (free.length) { const i = free[Math.floor(g.rng.next() * free.length)]; addMote(g, map.motePoints[i], 'random', null, i); }
  }
  if (g.randomShades && sim >= R.shade_first_spawn_tick && (sim - R.shade_first_spawn_tick) % map.shadeEvery === 0) {
    const n = sim === R.shade_first_spawn_tick ? R.shade_first_spawn_count : 1;
    for (let k = 0; k < n && g.shades.length < map.shadeMax; k++) {
      const valid = map.shadePoints.filter((q) => dxz(q, p.pos) >= R.shade_spawn_min_dist
        && !zoneLanterns(g).some((l) => dxz(q, l.pos) < T.safe_radius)
        && !g.shades.some((s) => dxz(s.pos, q) < 1));
      if (!valid.length) continue;
      const q = valid[Math.floor(g.rng.next() * valid.length)];
      const s = makeShade(g, `S${++g.seq.S}`, q, 'spawning', R.spawning_ticks, 1);
      g.shades.push(s);
      emit(g, 'shade_spawned', { id: s.id });
    }
  }
  if (g.randomDrifters && sim % R.drifter_every === 0 && g.drifters.length < R.drifter_max) {
    const q = map.shadePoints[Math.floor(g.rng.next() * map.shadePoints.length)];
    g.drifters.push(makeDrifter(`D${++g.seq.D}`, [q[0], 1.5, q[2]], 'idle', 0, 0));
  }

  // 11. win / lose (the benchmark scene never ends)
  if (g.bench) return;
  if (p.flames <= 0) finish(g, 'lost', 'no_flames');
  else if (timeLeftTicks(g) <= 0) { // dawn: the island must still be lit enough. No early win any more.
    const need = Math.ceil(T.win_ratio * g.lanterns.length - 1e-9);
    if (g.lanterns.filter((l) => l.lit).length >= need) finish(g, 'won', 'dawn_survived');
    else finish(g, 'lost', 'dawn');
  }
}

// 12. snapshot
export function snapshot(g) {
  const p = g.player, s6 = (t) => r3(t / TICK_RATE);
  return {
    type: 'snapshot',
    tick: g.steps,
    sim_tick: g.simSteps,
    state: g.paused && g.state === 'playing' ? 'paused' : g.state,
    night: g.night,
    time_left_s: r3(Math.max(0, timeLeftTicks(g)) / TICK_RATE),
    score: g.score,
    wind: { active: g.wind.enabled && g.wind.active, dir_deg: g.wind.dirDeg },
    player: {
      pos: p.pos.map(r3), vel: p.vel.map(r3), grounded: p.grounded, flames: p.flames, carried: p.carried, capacity: capacity(g),
      invuln: s6(p.invuln), dash_cd_s: s6(p.dashCd), pulse_cd_s: s6(p.pulseCd), charm_s: s6(p.charm),
    },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited, fuel: l.lit ? f1(l.fuel) : 0, ever_lit: l.everLit, relit_count: l.relit })),
    shades: g.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.state, state_ticks_left: s.ticks, target_lantern_id: s.target })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3), kind: m.kind, ttl_s: m.ttl === null ? null : s6(m.ttl) })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: d.pos.map(r3), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: s6(c.respawn) })),
  };
}

export function eventLine(e) { return { type: 'event', tick: e.tick, name: e.name, data: e.data }; }
