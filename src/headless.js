#!/usr/bin/env node
// Headless runner implementing Test Contract v1.0.
//   node src/headless.js --seed N --night 1 [--scenario f.json] [--inputs f.json]
//                        --ticks N --out f.jsonl [--snapshot-every N]
// Exit codes: 0 ok, 2 malformed --inputs/--scenario file, 1 any other error (message on stderr).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGame, stepGame, snapshot, eventLine } from './sim.js';
import { validateInputs, validateScenario, InputError } from './validate.js';

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = {};
  const known = new Set(['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new UsageError(`unexpected argument: ${a}`);
    const key = a.slice(2);
    if (!known.has(key)) throw new UsageError(`unknown option: ${a}`);
    if (i + 1 >= argv.length) throw new UsageError(`missing value for ${a}`);
    opts[key] = argv[++i];
  }
  const int = (k, min, dflt) => {
    if (opts[k] === undefined) {
      if (dflt === undefined) throw new UsageError(`missing required option --${k}`);
      return dflt;
    }
    if (!/^-?\d+$/.test(opts[k])) throw new UsageError(`--${k} must be an integer`);
    const n = Number(opts[k]);
    if (n < min) throw new UsageError(`--${k} must be >= ${min}`);
    return n;
  };
  const night = int('night', 1, 1);
  if (night !== 1) throw new UsageError('only --night 1 exists in this build');
  if (!opts.out) throw new UsageError('missing required option --out');
  return {
    seed: int('seed', -2147483648),
    ticks: int('ticks', 0),
    snapshotEvery: int('snapshot-every', 1, 10),
    out: opts.out, scenario: opts.scenario, inputs: opts.inputs,
  };
}

function readJson(path, label) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch (e) { throw new InputError(`${label}: cannot read ${path}: ${e.message}`); }
  try { return JSON.parse(text); } catch (e) { throw new InputError(`${label}: invalid JSON in ${path}: ${e.message}`); }
}

export function run(opts) {
  const scenario = opts.scenario ? validateScenario(readJson(opts.scenario, 'scenario')) : {};
  const frames = opts.inputs ? validateInputs(readJson(opts.inputs, 'inputs')).frames : [];
  const g = createGame({ seed: opts.seed, scenario });

  const lines = [];
  const push = (o) => lines.push(JSON.stringify(o));
  push(snapshot(g)); // tick 0: after scenario setup, before any input
  let lastSnap = 0, fi = 0;
  const cur = { move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false, dash: false };

  for (let k = 0; k < opts.ticks && g.state === 'playing'; k++) {
    if (fi < frames.length && frames[fi].tick === k) {
      const f = frames[fi++];
      if (f.move !== undefined) cur.move = f.move;
      if (f.cam_yaw_deg !== undefined) cur.camYawDeg = f.cam_yaw_deg;
      for (const b of ['jump', 'interact', 'pulse', 'dash']) if (f[b] !== undefined) cur[b] = f[b];
    }
    stepGame(g, cur);
    for (const e of g.events) push(eventLine(e));
    g.events.length = 0;
    if (g.steps % opts.snapshotEvery === 0) { push(snapshot(g)); lastSnap = g.steps; }
  }
  if (lastSnap !== g.steps) push(snapshot(g)); // final state, in case the run did not end on a snapshot tick
  push({ type: 'end', ticks: g.steps, state: g.state, score: g.score });

  mkdirSync(dirname(opts.out) || '.', { recursive: true });
  writeFileSync(opts.out, lines.join('\n') + '\n');
  return g;
}

function main() {
  try {
    run(parseArgs(process.argv.slice(2)));
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(e instanceof InputError ? 2 : 1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
