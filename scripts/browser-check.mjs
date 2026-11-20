// Drives a real (headless) Chrome through the web build over the DevTools protocol:
// loads each Night, presses keys, records console errors, measures FPS, saves screenshots.
//   node scripts/browser-check.mjs [baseUrl]      (needs `npm start` running and Chrome installed)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs/evidence/screens');
mkdirSync(outDir, { recursive: true });
const base = process.argv[2] || 'http://localhost:8080';
const CHROME = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
if (!CHROME) { console.error('no Chrome/Edge found (set CHROME=...)'); process.exit(1); }

const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ddl-chrome-'))}`,
  '--window-size=1280,720', ...(process.env.GPU ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']), '--ignore-gpu-blocklist', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const killer = setTimeout(() => { console.error('TIMEOUT: killing browser'); chrome.kill(); process.exit(2); }, 150000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome DevTools did not come up');
}

const ws = new WebSocket(await connect());
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pending = new Map(); const problems = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result ?? msg.error); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.exceptionThrown') problems.push(`exception: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') problems.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') problems.push(`log: ${msg.params.entry.text} ${msg.params.entry.url ?? ''}`);
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
const key = async (code, key, down) => send('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', code, key, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0 });
const hold = async (code, k, ms) => { await key(code, k, true); await sleep(ms); await key(code, k, false); };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.data, 'base64')); };

await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
const report = [];

// 1. menu
await send('Page.navigate', { url: `${base}/?seed=5` });
await sleep(3500);
await shot('menu.png');
report.push({ check: 'menu loads', ok: (await evalJs("document.getElementById('card').innerText")).includes('Đảo Đèn Lồng') });

// 2. each night: start, move, jump, dash, pulse, pause/resume
for (const night of [1, 2, 3]) {
  await send('Page.navigate', { url: `${base}/?seed=5&night=${night}` });
  await sleep(3000);
  const s0 = await evalJs('JSON.stringify({tick: __ddl.game.simSteps, screen: __ddl.getScreen(), night: __ddl.game.night, pos: __ddl.game.player.pos})');
  await hold('KeyW', 'w', 1200);
  await hold('Space', ' ', 150);
  await hold('ShiftLeft', 'Shift', 100);
  const s1 = JSON.parse(await evalJs('JSON.stringify({tick: __ddl.game.simSteps, pos: __ddl.game.player.pos, fps: window.__fps, lanterns: __ddl.game.lanterns.length})'));
  await shot(`night${night}-play.png`);
  const moved = Math.hypot(s1.pos[0] - JSON.parse(s0).pos[0], s1.pos[2] - JSON.parse(s0).pos[2]);
  report.push({ check: `night ${night}: starts, simulates, W moves Mây (${moved.toFixed(1)} m), fps ${s1.fps?.toFixed(1)}`, ok: JSON.parse(s0).screen === 'play' && s1.tick > 60 && moved > 3 });
  // pause freezes the sim
  await hold('Escape', 'Escape', 80); await sleep(300);
  const p1 = await evalJs('__ddl.game.simSteps'); await sleep(700); const p2 = await evalJs('__ddl.game.simSteps');
  const pausedOk = (await evalJs('__ddl.game.paused')) === true && p1 === p2;
  await shot(`night${night}-paused.png`);
  report.push({ check: `night ${night}: Esc pauses (sim_tick frozen at ${p1})`, ok: pausedOk });
  await hold('Escape', 'Escape', 80); await sleep(500);
  report.push({ check: `night ${night}: Esc resumes`, ok: (await evalJs('__ddl.game.paused')) === false });
}

// 3. win path through the real UI: Night 1 with every lantern pre-lit except one is not reachable from the UI, so
//    only the overlay chain is checked via the exposed game object.
await send('Page.navigate', { url: `${base}/?seed=5&night=1` });
await sleep(2500);
await evalJs("(() => { const g = __ddl.game; g.lanterns.forEach((l) => { l.lit = true; }); })()");
await sleep(800);
report.push({ check: 'all lanterns lit -> win overlay (Đêm kế tiếp)', ok: (await evalJs("document.getElementById('card').innerText")).includes('Đêm 1 đã sáng') });
await shot('night1-win.png');

ws.close(); chrome.kill(); clearTimeout(killer);
const failed = report.filter((r) => !r.ok).length + problems.length;
const lines = [...report.map((r) => `${r.ok ? 'ĐẠT ' : 'TRƯỢT'} ${r.check}`), ...problems.map((p) => `LỖI  ${p}`)];
console.log(lines.join('\n'));
writeFileSync(join(outDir, 'browser-check.txt'), `${lines.join('\n')}\n\nChrome: ${CHROME}\nGPU: ${process.env.GPU ? 'real GPU (default ANGLE backend)' : 'software (SwiftShader), so FPS here is a lower bound'}.\n`);
process.exit(failed ? 1 : 0);
