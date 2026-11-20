import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const CLI = resolve('src/headless.js');
const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
let n = 0;

/** Runs the real headless CLI and parses its JSONL. */
export function run({ seed = 1, night = 1, scenario, frames, ticks, every = 10, raw } = {}) {
  const id = ++n;
  const out = join(dir, `o${id}.jsonl`);
  const args = [CLI, '--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every)];
  if (scenario !== undefined) { const f = join(dir, `s${id}.json`); writeFileSync(f, raw ? scenario : JSON.stringify(scenario)); args.push('--scenario', f); }
  if (frames !== undefined) { const f = join(dir, `i${id}.json`); writeFileSync(f, raw ? frames : JSON.stringify({ frames })); args.push('--inputs', f); }
  const t0 = Date.now();
  const r = spawnSync('node', args, { encoding: 'utf8' });
  const ms = Date.now() - t0;
  let lines = [];
  try { lines = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l)); } catch { /* error run */ }
  const snaps = lines.filter((l) => l.type === 'snapshot');
  const events = lines.filter((l) => l.type === 'event');
  return {
    r, lines, out, ms, snaps, events, end: lines.at(-1),
    snap: (tick) => snaps.find((s) => s.tick === tick),
    ev: (name) => events.filter((e) => e.name === name),
  };
}

/** A scenario with no random entities, so a test only sees what it places. */
export const empty = {
  random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
  motes: [], shades: [], drifters: [], charms: [],
};
export const last = (a) => a.at(-1);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const near = (a, b, tol, msg) => {
  if (Math.abs(a - b) > tol) throw new Error(`${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);
};
export const press = (...ticks) => ticks.flatMap((t) => [{ tick: t, k: true }, { tick: t + 1, k: false }]);
/** Build frames pressing `btn` (rising edge) at each given tick. */
export function pressFrames(btn, at, extra = []) {
  const frames = [...extra];
  for (const t of at) { frames.push({ tick: t, [btn]: true }); frames.push({ tick: t + 1, [btn]: false }); }
  return mergeFrames(frames);
}
/** Merge frames that share a tick, then sort strictly increasing. */
export function mergeFrames(frames) {
  const m = new Map();
  for (const f of frames) m.set(f.tick, { ...(m.get(f.tick) ?? {}), ...f });
  return [...m.values()].sort((a, b) => a.tick - b.tick);
}
