// Benchmark (Ticket-04 section 1):   node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
// Starts the local server, opens the standard benchmark scene in Chrome at 1280x720 (not fullscreen, GPU vsync and the
// frame-rate limit turned off with Chrome flags), measures frame times, then writes bench.json and exits 0.
// Env: CHROME=<path to chrome/edge>, HEADED=1 for a visible window instead of headless (both use the GPU).
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir, platform, release, arch, cpus, totalmem } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { benchStats, round1 } from '../src/benchstats.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const seed = Number(args.seed ?? 42), duration = Number(args.duration ?? 30), out = args.out;
if (!out || !Number.isFinite(seed) || !Number.isFinite(duration) || duration <= 0) {
  console.error('usage: node scripts/bench.mjs --seed 42 --duration 30 --out bench.json'); process.exit(1);
}
const CHROME = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
if (!CHROME) { console.error('no Chrome/Chromium/Edge found (set CHROME=...)'); process.exit(1); }

const t0Epoch = Date.now(); // "process start": load_ms is measured from here
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9600 + Math.floor(Math.random() * 300), cdp = 9200 + Math.floor(Math.random() * 300);
const profile = mkdtempSync(join(tmpdir(), 'ddl-bench-'));
const server = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(port), DDL_DATA_DIR: join(profile, 'data') }, stdio: 'ignore' });
const flags = [process.env.HEADED ? '' : '--headless=new', `--remote-debugging-port=${cdp}`, `--user-data-dir=${profile}`, '--window-size=1280,720',
  '--disable-gpu-vsync', ...(process.env.KEEP_FRAME_LIMIT ? [] : ['--disable-frame-rate-limit']), '--ignore-gpu-blocklist', '--no-first-run', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required', 'about:blank'].filter(Boolean);
const chrome = spawn(CHROME, flags, { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch { /* gone */ } try { server.kill(); } catch { /* gone */ } };
process.on('exit', cleanup);
const killer = setTimeout(() => { console.error('TIMEOUT'); cleanup(); process.exit(2); }, (duration + 120) * 1000);

// memory of the whole browser process tree (every process that was started with our profile directory)
function treeRssMb() {
  try {
    if (platform() === 'win32') {
      const ps = `(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${profile}*' } | Measure-Object -Property WorkingSetSize -Sum).Sum`;
      const exe = join(process.env.SystemRoot ?? 'C:\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const r = spawnSync(exe, ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
      const v = Number(r.stdout.trim());
      return Number.isFinite(v) && v > 0 ? v / 1048576 : null;
    }
    const r = spawnSync('sh', ['-c', `ps -eo rss=,args= | grep -F -- '${profile}' | grep -v grep | awk '{s+=$1} END {print s}'`], { encoding: 'utf8' });
    const v = Number(r.stdout.trim());
    return Number.isFinite(v) && v > 0 ? v / 1024 : null;
  } catch { return null; }
}

async function connect() {
  for (let i = 0; i < 80; i++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${cdp}/json`)).json()).find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome DevTools did not come up');
}
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break; } catch { /* wait */ } await sleep(200); }

const ws = new WebSocket(await connect());
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result ?? msg.error); pending.delete(msg.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value;

await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${port}/?bench=1&seed=${seed}&duration=${duration}${process.env.BENCH_QUERY ?? ""}` });

// Memory is sampled twice, outside the measured window (a sample spawns a process, which would disturb the frame
// times): at the end of the warm-up and right after the measurement ends. peak_mem_mb is the larger of the two.
let peak = null, sampledWarmup = false, result = null;
const note = () => { const m = treeRssMb(); if (m !== null) peak = Math.max(peak ?? 0, m); };
const deadline = Date.now() + (duration + 60) * 1000;
while (Date.now() < deadline) {
  await sleep(400);
  const st = JSON.parse((await evalJs('JSON.stringify({ f: window.__benchFirstFrameEpochMs || 0, done: !!window.__bench })')) || '{"f":0,"done":false}');
  if (!sampledWarmup && st.f && Date.now() - st.f > 1500 && Date.now() - st.f < 2800) { note(); sampledWarmup = true; }
  if (sampledWarmup && !st.done && st.f) { // stay quiet while measuring: talking to the page would disturb the frame times
    const until = st.f + (3 + duration) * 1000 + 300;
    if (Date.now() < until) { await sleep(until - Date.now()); continue; }
  }
  if (st.done) { result = await evalJs('JSON.stringify(window.__bench)'); break; }
}
if (!result) { console.error('benchmark did not finish'); cleanup(); process.exit(3); }
note();
const r = JSON.parse(result);
const ver = (await send('Browser.getVersion')).product;
const stats = benchStats(r.dts);
if (process.env.DUMP_FRAMES) writeFileSync(process.env.DUMP_FRAMES, JSON.stringify(r.dts)); // raw frame times (ms), for debugging
const doc = {
  contract_version: '1.3',
  avg_fps: round1(stats.avg_fps),
  p1_low_fps: round1(stats.p1_low_fps),
  frame_ms_p95: round1(stats.frame_ms_p95),
  frames: stats.frames,
  load_ms: Math.round(r.firstFrameEpochMs - t0Epoch),
  peak_mem_mb: peak === null ? null : Math.round(peak),
  vsync_off: true, // --disable-gpu-vsync --disable-frame-rate-limit; see "Benchmark" in README for what this does and does not guarantee
  renderer: `${ver}; ${r.renderer}`,
  os: `${platform()} ${release()} ${arch()}; ${cpus()[0]?.model?.trim() ?? 'cpu'} x${cpus().length}; ${Math.round(totalmem() / 1073741824)} GB RAM`,
};
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
clearTimeout(killer);
console.log(JSON.stringify(doc, null, 2));
cleanup();
process.exit(0);
