// Strict validation of --inputs and --scenario files. Throws InputError (headless -> exit 2).
export class InputError extends Error {}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const fail = (msg) => { throw new InputError(msg); };

function vec(v, n, where) {
  if (!Array.isArray(v) || v.length !== n || !v.every(isNum)) fail(`${where} must be an array of ${n} numbers`);
  return v;
}

export function validateInputs(doc) {
  if (!isObj(doc) || !Array.isArray(doc.frames)) fail('inputs: expected {"frames": [...]}');
  let last = -Infinity;
  const frames = doc.frames.map((f, i) => {
    const w = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${w} must be an object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) fail(`${w}.tick must be a non-negative integer`);
    if (f.tick <= last) fail(`${w}.tick must be strictly increasing`);
    last = f.tick;
    if (f.move !== undefined) {
      vec(f.move, 2, `${w}.move`);
      if (f.move.some((c) => c < -1 || c > 1)) fail(`${w}.move components must be in [-1, 1]`);
    }
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) fail(`${w}.cam_yaw_deg must be a number`);
    for (const k of ['jump', 'interact', 'pulse', 'dash', 'pause']) {
      if (f[k] !== undefined && typeof f[k] !== 'boolean') fail(`${w}.${k} must be a boolean`);
    }
    return f;
  });
  return { frames };
}

export function validateScenario(doc) {
  if (!isObj(doc)) fail('scenario: expected an object');
  if (doc.player !== undefined) {
    const p = doc.player;
    if (!isObj(p)) fail('scenario.player must be an object');
    if (p.pos !== undefined) vec(p.pos, 3, 'scenario.player.pos');
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks']) {
      if (p[k] !== undefined && (!Number.isInteger(p[k]) || p[k] < 0)) fail(`scenario.player.${k} must be a non-negative integer`);
    }
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (doc[k] !== undefined && typeof doc[k] !== 'boolean') fail(`scenario.${k} must be a boolean`);
  }
  if (doc.motes !== undefined) {
    if (!Array.isArray(doc.motes)) fail('scenario.motes must be an array');
    doc.motes.forEach((m, i) => {
      if (isObj(m)) { vec(m.pos, 3, `scenario.motes[${i}].pos`); if (m.kind !== undefined && !['random', 'dropped'].includes(m.kind)) fail(`scenario.motes[${i}].kind must be random or dropped`); }
      else vec(m, 3, `scenario.motes[${i}]`);
    });
  }
  if (doc.shades !== undefined) {
    if (!Array.isArray(doc.shades)) fail('scenario.shades must be an array');
    doc.shades.forEach((s, i) => {
      if (!isObj(s)) fail(`scenario.shades[${i}] must be an object`);
      vec(s.pos, 3, `scenario.shades[${i}].pos`);
      if (s.id !== undefined && typeof s.id !== 'string') fail(`scenario.shades[${i}].id must be a string`);
      if (s.state !== undefined && !['spawning', 'wander', 'chase', 'recoil', 'stunned'].includes(s.state)) fail(`scenario.shades[${i}].state is not a valid shade state`);
      if (s.state_ticks_left !== undefined && (!Number.isInteger(s.state_ticks_left) || s.state_ticks_left < 0)) fail(`scenario.shades[${i}].state_ticks_left must be a non-negative integer`);
    });
  }
  if (doc.lanterns !== undefined) {
    if (!Array.isArray(doc.lanterns)) fail('scenario.lanterns must be an array');
    doc.lanterns.forEach((l, i) => {
      if (!isObj(l) || typeof l.id !== 'string') fail(`scenario.lanterns[${i}] needs a string id`);
      if (l.pos !== undefined) vec(l.pos, 3, `scenario.lanterns[${i}].pos`);
      if (l.deposited !== undefined && (!isNum(l.deposited) || l.deposited < 0)) fail(`scenario.lanterns[${i}].deposited must be >= 0`);
      if (l.lit !== undefined && typeof l.lit !== 'boolean') fail(`scenario.lanterns[${i}].lit must be a boolean`);
    });
  }
  if (doc.drifters !== undefined) {
    if (!Array.isArray(doc.drifters)) fail('scenario.drifters must be an array');
    doc.drifters.forEach((d, i) => {
      if (!isObj(d)) fail(`scenario.drifters[${i}] must be an object`);
      vec(d.pos, 3, `scenario.drifters[${i}].pos`);
      if (d.state !== undefined && !['idle', 'chase', 'flee'].includes(d.state)) fail(`scenario.drifters[${i}].state must be idle, chase or flee`);
      if (d.stolen !== undefined && (!Number.isInteger(d.stolen) || d.stolen < 0)) fail(`scenario.drifters[${i}].stolen must be a non-negative integer`);
    });
  }
  if (doc.charms !== undefined) {
    if (!Array.isArray(doc.charms)) fail('scenario.charms must be an array');
    doc.charms.forEach((c, i) => {
      if (!isObj(c) || typeof c.id !== 'string') fail(`scenario.charms[${i}] needs a string id`);
      if (c.pos !== undefined) vec(c.pos, 3, `scenario.charms[${i}].pos`);
      if (c.available !== undefined && typeof c.available !== 'boolean') fail(`scenario.charms[${i}].available must be a boolean`);
    });
  }
  if (doc.time_left_s !== undefined && (!isNum(doc.time_left_s) || doc.time_left_s < 0)) fail('scenario.time_left_s must be a number >= 0');
  return doc;
}
