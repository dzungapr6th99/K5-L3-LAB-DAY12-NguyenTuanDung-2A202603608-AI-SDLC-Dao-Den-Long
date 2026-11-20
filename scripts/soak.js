// Soak test (Ticket-04 section 2):   node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json
// Runs N Nights back to back in one process (Night 1 -> 2 -> 3, repeating), Night i with seed (seed + i), each until it ends
// or reaches its standard duration. Inputs are random but fully determined by the seed:
//   every 30 ticks a new move direction; each tick: 5% jump, 3% dash, 2% pulse, 10% interact.
// --expose-gc lets the script collect garbage before it reads the final memory figure; without the flag it still works.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createGame, stepGame } from '../src/sim.js';
import { makeRng } from '../src/rng.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const seed = Number(args.seed ?? 7), nights = Number(args.nights ?? 10), out = args.out;
if (!out || !Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) {
  console.error('usage: node scripts/soak.js --seed 7 --nights 10 --out soak.json'); process.exit(1);
}
const mb = () => Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// RSS is read after a settle: two garbage collections with a short wait, so that memory the engine has freed but not yet
// handed back is not counted. Without --expose-gc the raw RSS is used.
async function settledMb() {
  if (typeof globalThis.gc === 'function') { globalThis.gc(); await sleep(100); globalThis.gc(); await sleep(100); }
  return mb();
}

async function playNight(i) {
  const night = ((i - 1) % 3) + 1, nightSeed = seed + i;
  const game = createGame({ seed: nightSeed, night });
  const inputs = makeRng(nightSeed * 7919 + 13); // independent of the game's own random stream
  let move = [0, 0];
  const input = { move, camYawDeg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  const startMem = i === 1 ? await settledMb() : null; // "after the first Night has loaded"
  for (let tick = 0; game.state === 'playing'; tick++) {
    if (tick % 30 === 0) { const a = inputs.range(0, 2 * Math.PI); move = [Math.cos(a), Math.sin(a)]; input.move = move; }
    input.jump = inputs.next() < 0.05;
    input.dash = inputs.next() < 0.03;
    input.pulse = inputs.next() < 0.02;
    input.interact = inputs.next() < 0.10;
    stepGame(game, input);
    game.events.length = 0;
  }
  return { result: game.state, startMem };
}

// Loading phase: the engine is warmed up by playing a throwaway game (JIT, heap sizing), so that start-up cost is not
// mistaken for growth. The Nights below are then measured from a warm process.
{
  const warm = makeRng(1), g = createGame({ seed: 1, night: 1 });
  for (let t = 0; t < 3000 && g.state === 'playing'; t++) { stepGame(g, { move: [Math.cos(t / 30), Math.sin(t / 30)], interact: warm.next() < 0.1 }); g.events.length = 0; }
}
const t0 = Date.now();
let crashes = 0, memStart = null;
const results = [];
for (let i = 1; i <= nights; i++) {
  try {
    const { result, startMem } = await playNight(i);
    results.push(result);
    if (startMem !== null) memStart = startMem;
  } catch (e) {
    crashes += 1; results.push('crash');
    console.error(`night ${i} crashed: ${e.stack || e}`);
    if (memStart === null) memStart = await settledMb();
  }
}
const memEnd = await settledMb(); // after the last Night has been reset (its game object is unreachable now)
const doc = {
  nights, crashes, results,
  mem_start_mb: memStart,
  mem_end_mb: memEnd,
  duration_s: Math.round(((Date.now() - t0) / 1000) * 10) / 10,
};
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, `${JSON.stringify(doc)}\n`);
console.log(JSON.stringify(doc));
process.exit(crashes === 0 && doc.mem_end_mb <= 1.2 * doc.mem_start_mb ? 0 : 1);
