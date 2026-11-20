// The three standard maps from Ticket-02 and their terrain queries.
// Angles: position = (r cos a, y, r sin a) in the XZ plane (a measured from +X toward +Z, so the
// Night 3 "z > 0" half matches the 20..160 degree spawn points).
import { TUNING as T, RULES as R } from './tuning.js';
import { r3 } from './rng.js';

const D2R = Math.PI / 180;
const pt = (r, a, y = 0, cx = 0, cz = 0) => [r3(cx + r * Math.cos(a * D2R)), y, r3(cz + r * Math.sin(a * D2R))];
const ring = (r, start, step, count, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: count }, (_, i) => pt(r, start + i * step, y, cx, cz));

const rad = (x, z) => Math.hypot(x, z);

// ---- terrain: list of solid top heights at (x, z) (empty = void) ----
function tops1(x, z) { return rad(x, z) <= 40 ? [0] : []; }

function tops2(x, z) {
  const inA = rad(x, z) <= 28, inB = rad(x - 70, z) <= 28;
  const bridge = x >= 26 && x <= 44 && Math.abs(z) <= 2;
  return inA || inB || bridge ? [0] : [];
}

const RAMP_ANGLES = [30, 150];
function tops3(x, z) {
  const r = rad(x, z), t = [];
  if (r <= 45) t.push(0);
  if (r >= 12 && r <= 24 && z > 0) t.push(3);
  if (r <= 8) t.push(6);
  if (r <= 2) t.push(14); // bell tower: 8 m on top of tier 2, not climbable
  for (const a of RAMP_ANGLES) {
    const ux = Math.cos(a * D2R), uz = Math.sin(a * D2R);
    const along = x * ux + z * uz, perp = Math.abs(-x * uz + z * ux);
    if (along >= 24 && along <= 30 && perp <= 1.5) t.push((3 * (30 - along)) / 6);
  }
  return t;
}

const NIGHTS = {
  1: {
    id: 1, name: 'Đảo Bến', duration_s: T.night1_duration_s,
    start: [0, 0, 0], tops: tops1,
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motePoints: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
    shadePoints: ring(37, 15, 30, 12),
    shadeEvery: 480, shadeMax: 6, shadeSpeed: T.shade_speed,
    pads: [], charms: [], drifters: false, wind: false,
    bounds: { cx: 0, cz: 0, r: 40 },
  },
  2: {
    id: 2, name: 'Đảo Cau', duration_s: T.night2_duration_s,
    start: [0, 0, 0], tops: tops2,
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    motePoints: [
      ...ring(10, 0, 90, 4), ...ring(22, 0, 45, 8),
      ...ring(10, 0, 90, 4, 0, 70, 0), ...ring(22, 0, 45, 8, 0, 70, 0),
    ],
    shadePoints: [...ring(26, 22.5, 45, 8), ...ring(26, 22.5, 45, 8, 0, 70, 0)],
    shadeEvery: 420, shadeMax: 8, shadeSpeed: T.shade_speed,
    pads: [
      { pos: [20, 0, 18], radius: 1, vy: 14, hspeed: 24, target: [70, 0, 0] },
      { pos: [50, 0, -18], radius: 1, vy: 14, hspeed: 24, target: [0, 0, 0] },
    ],
    charms: [{ id: 'C1', pos: [35, 0, 0] }], drifters: true, wind: false,
    bounds: { cx: 35, cz: 0, r: 60 },
  },
  3: {
    id: 3, name: 'Đảo Chuông', duration_s: T.night3_duration_s,
    start: [0, 0, -15], tops: tops3, // (0,0,0) is inside the tier-2 disc, so Night 3 starts on tier 0 (assumption)
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motePoints: [...ring(34, 0, 20, 18), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
    shadePoints: ring(43, 0, 22.5, 16),
    shadeEvery: 360, shadeMax: 10, shadeSpeed: 4.5,
    pads: [{ pos: [0, 3, 13], radius: 1, vy: 12, hspeed: 8, dir: [0, -1] }],
    charms: [{ id: 'C1', pos: [30, 0, 25] }, { id: 'C2', pos: [-30, 0, 25] }], drifters: true, wind: true,
    bounds: { cx: 0, cz: 0, r: 45 },
  },
};

export function getMap(night) {
  const m = NIGHTS[night];
  if (!m) throw new Error(`unknown night ${night}`);
  return m;
}

/** Highest surface a walker standing at height y can be on at (x,z), or null (void). */
export function groundAt(map, x, z, y) {
  let best = null;
  for (const t of map.tops(x, z)) if (t <= y + R.step_height && (best === null || t > best)) best = t;
  return best;
}

/** True if something at (x,z) stands higher than a walker at height y can step onto. */
export function blockedAt(map, x, z, y) {
  return map.tops(x, z).some((t) => t > y + R.step_height);
}

/** Can a ground-bound creature standing on floor `fl` move to (x,z)? Returns the new floor or null. */
export function walkFloor(map, x, z, fl) {
  const g = groundAt(map, x, z, fl);
  if (g === null || Math.abs(g - fl) > R.step_height || blockedAt(map, x, z, fl)) return null;
  return g;
}

export const MAP_IDS = [1, 2, 3];
