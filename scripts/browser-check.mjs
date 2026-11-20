// Drives a real (headless) Chrome through the web build over the DevTools protocol: every Night, pause, fuel, colour-blind
// mode, UI text size, key rebinding, reduced motion, the leaderboard (saved on disk by the real server), screenshots.
//   node scripts/browser-check.mjs            starts its own server with a temporary data directory
//   node scripts/browser-check.mjs <baseUrl>  uses a server you already started (the leaderboard check then writes to it)
// Env: GPU=1 uses the real GPU instead of software rendering; CHROME=<path>.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs/evidence/screens');
mkdirSync(outDir, { recursive: true });
const CHROME = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
if (!CHROME) { console.error('no Chrome/Edge found (set CHROME=...)'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let base = process.argv[2], server = null, dataDir = null;
if (!base) {
  const sport = 9700 + Math.floor(Math.random() * 200);
  dataDir = mkdtempSync(join(tmpdir(), 'ddl-data-'));
  server = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(sport), DDL_DATA_DIR: dataDir }, stdio: 'ignore' });
  base = `http://127.0.0.1:${sport}`;
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base)).ok) break; } catch { /* wait */ } await sleep(200); }
}

const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ddl-chrome-'))}`,
  '--window-size=1280,720', ...(process.env.GPU ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']), '--ignore-gpu-blocklist', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch { /* gone */ } try { server?.kill(); } catch { /* gone */ } };
const killer = setTimeout(() => { console.error('TIMEOUT: killing browser'); cleanup(); process.exit(2); }, 240000);

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
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
const key = async (code, k, down) => send('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', code, key: k, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0 });
const hold = async (code, k, ms) => { await key(code, k, true); await sleep(ms); await key(code, k, false); };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.data, 'base64')); };
const go = async (path, wait = 2800) => { await send('Page.navigate', { url: `${base}${path}` }); await sleep(wait); };
const text = () => evalJs("document.getElementById('card').innerText");
const click = (cid) => evalJs(`document.getElementById('${cid}').click()`);

await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
const report = [];
const check = (name, ok) => report.push({ check: name, ok: !!ok });

// 1. menu
await go('/?seed=5', 3500);
await shot('menu.png');
check('menu loads', (await text()).includes('Đảo Đèn Lồng'));

// 2. each night: start, move, jump, dash, pause/resume
for (const night of [1, 2, 3]) {
  await go(`/?seed=5&night=${night}`, 3000);
  const s0 = JSON.parse(await evalJs('JSON.stringify({ screen: __ddl.getScreen(), pos: __ddl.game.player.pos })'));
  await hold('KeyW', 'w', 1200);
  await hold('Space', ' ', 150);
  await hold('ShiftLeft', 'Shift', 100);
  const s1 = JSON.parse(await evalJs('JSON.stringify({ tick: __ddl.game.simSteps, pos: __ddl.game.player.pos, fps: window.__fps })'));
  await shot(`night${night}-play.png`);
  const moved = Math.hypot(s1.pos[0] - s0.pos[0], s1.pos[2] - s0.pos[2]);
  check(`night ${night}: starts, simulates, W moves Mây (${moved.toFixed(1)} m), fps ${s1.fps?.toFixed(1)}`, s0.screen === 'play' && s1.tick > 60 && moved > 3);
  await hold('Escape', 'Escape', 80); await sleep(300);
  const p1 = await evalJs('__ddl.game.simSteps'); await sleep(700); const p2 = await evalJs('__ddl.game.simSteps');
  check(`night ${night}: Esc pauses (sim_tick frozen at ${p1})`, (await evalJs('__ddl.game.paused')) === true && p1 === p2);
  await shot(`night${night}-paused.png`);
  await hold('Escape', 'Escape', 80); await sleep(500);
  check(`night ${night}: Esc resumes`, (await evalJs('__ddl.game.paused')) === false);
}

// 3. Ticket-03: fuel burns in the page
await go('/?seed=5&night=1', 2500);
await evalJs("(() => { const g = __ddl.game; const l = g.lanterns[0]; l.lit = true; l.everLit = true; l.fuel = 2400; g.lanterns[1].lit = true; g.lanterns[1].everLit = true; g.lanterns[1].fuel = 6000; })()");
const f0 = await evalJs('__ddl.game.lanterns[0].fuel'); await sleep(1500);
const f1 = await evalJs('__ddl.game.lanterns[0].fuel');
check(`lit lantern burns fuel in the page (${f0} -> ${f1} units, about 1 per tick)`, f0 - f1 > 60 && f0 - f1 < 140);
await shot('night1-fuel.png');

// 4. Ticket-04 accessibility: UI text size (>= 18px at 1280x720; x1.25 with the large-text option)
const sizes = () => evalJs("JSON.stringify(['clock','lit','nightname','carry','score','prompt','toast','windwarn','dash','pulse'].map((i) => parseFloat(getComputedStyle(document.getElementById(i)).fontSize)))");
await go('/?seed=5&night=1', 2500);
const base18 = JSON.parse(await sizes());
check(`HUD text is at least 18 px at 1280x720 (smallest ${Math.min(...base18)} px)`, Math.min(...base18) >= 18);
await go('/?seed=5', 2500);
const cardSizes = JSON.parse(await evalJs("JSON.stringify([...document.querySelectorAll('#card, #card p, #card button, #card kbd, #card label')].map((e) => parseFloat(getComputedStyle(e).fontSize)))"));
check(`menu text is at least 18 px (smallest ${Math.min(...cardSizes)} px)`, Math.min(...cardSizes) >= 18);

// 5. settings: large text, reduce motion, colour-blind, key rebinding with conflict detection, reset
await click('set'); await sleep(300);
await click('big'); await click('rm'); await click('cb'); await sleep(300);
const big = JSON.parse(await sizes());
check(`large text option scales the UI (${big[0]} px)`, big.every((v, i) => Math.abs(v - base18[i] * 1.25) < 0.6));
check('reduce-motion, colour-blind and large-text options apply and are saved', await evalJs("document.body.classList.contains('rm') && document.body.classList.contains('cb') && (() => { const s = JSON.parse(localStorage.getItem('ddl-settings')); return s.reduceMotion && s.colorblind && s.bigText; })()"));
await shot('settings-accessibility.png');
await click('keys'); await sleep(300);
await click('k-jump'); await key('KeyZ', 'z', true); await key('KeyZ', 'z', false); await sleep(200);
check('rebind Nhảy to Z (saved)', await evalJs("__ddl.settings.keys.jump === 'KeyZ' && JSON.parse(localStorage.getItem('ddl-settings')).keys.jump === 'KeyZ'"));
await click('k-dash'); await key('KeyZ', 'z', true); await key('KeyZ', 'z', false); await sleep(200);
check('a clashing key is refused and reported', (await evalJs('__ddl.settings.keys.dash')) === 'ShiftLeft' && (await text()).includes('đang dùng cho'));
await click('k-pulse'); await key('ArrowLeft', 'ArrowLeft', true); await key('ArrowLeft', 'ArrowLeft', false); await sleep(200);
check('a fixed key (camera arrow) is refused', (await evalJs('__ddl.settings.keys.pulse')) === 'KeyF' && (await text()).includes('cố định'));
await shot('settings-keys.png');
await go('/?seed=5&night=1', 2500); // reload: bindings, text size and options persist
check('bindings and options survive a reload', await evalJs("__ddl.settings.keys.jump === 'KeyZ' && __ddl.settings.bigText === true && document.body.classList.contains('rm')"));
await hold('KeyZ', 'z', 150); // the new jump key works in play
check('the rebound jump key works in the game', await evalJs('__ddl.game.player.pos[1] > 0 || !__ddl.game.player.grounded'));
await go('/?seed=5', 2500);
await click('set'); await click('keys'); await sleep(200); await click('kreset'); await sleep(300);
check('"Khôi phục mặc định" restores the default keys', await evalJs("__ddl.settings.keys.jump === 'Space' && JSON.parse(localStorage.getItem('ddl-settings')).keys.jump === 'Space'"));
await click('kback'); await click('big'); await click('rm'); await click('cb'); // back to normal options for the rest

// 6. visual indicators
await go('/?seed=5&night=1', 2500);
await evalJs("(() => { const g = __ddl.game; g.lanterns[0].lit = true; g.lanterns[0].everLit = true; g.lanterns[0].fuel = 20 * 60; })()");
await sleep(400);
check('a nearly-empty lantern shows a text indicator', (await evalJs("document.getElementById('alerts').innerText")).includes('sắp hết dầu'));
await evalJs("(() => { const g = __ddl.game; g.ticksLeft0 = g.simSteps + 5 * 60; })()");
await sleep(1200);
check('the last 10 s show a big countdown', /^[1-5]$/.test((await evalJs("document.getElementById('count').innerText")).trim()));
await shot('countdown.png');

// 7. dawn overlay, then the leaderboard through the real server: lose -> name -> saved on disk -> shown in the menu
await go('/?seed=5&night=1', 2500);
await evalJs("(() => { const g = __ddl.game; for (const l of g.lanterns.slice(0, 3)) { l.lit = true; l.everLit = true; l.fuel = 6000; } g.ticksLeft0 = g.simSteps + 2; })()");
await sleep(1200);
check('dawn with 3/5 lanterns lit -> "Bình minh" overlay (no early win)', (await text()).includes('Bình minh đã tới'));
await shot('night1-dawn.png');
await go('/?seed=5&night=1', 2500);
await evalJs('(() => { __ddl.game.player.flames = 0; })()');
await sleep(800);
check('after losing, a name can be entered', (await text()).includes('Lưu điểm') && (await evalJs("!!document.getElementById('pname')")));
await evalJs("(() => { document.getElementById('pname').value = 'ab'; document.getElementById('save').click(); })()"); await sleep(400);
check('a too-short name is refused with a message', (await evalJs("document.getElementById('smsg').innerText")).includes('3–12'));
await evalJs("(() => { document.getElementById('pname').value = 'Mây_Nhỏ'; document.getElementById('save').click(); })()"); await sleep(800);
check('a valid name is saved and the rank is shown', (await evalJs("document.getElementById('smsg').innerText")).includes('Hạng #1'));
await shot('leaderboard-save.png');
if (dataDir) {
  const onDisk = JSON.parse(readFileSync(join(dataDir, 'leaderboard.json'), 'utf8'));
  check('the entry is on disk with name, score, nights_won, achieved_at, seed', onDisk.entries.length === 1 && onDisk.entries[0].name === 'Mây_Nhỏ' && onDisk.entries[0].nights_won === 0 && /T\d\d:\d\d:\d\d[+-]\d\d:\d\d$/.test(onDisk.entries[0].achieved_at) && Number.isInteger(onDisk.entries[0].seed));
}
await go('/?seed=5', 2500);
await click('lb'); await sleep(800);
check('the leaderboard screen from the main menu lists it', (await text()).includes('Mây_Nhỏ'));
await shot('leaderboard.png');

ws.close(); cleanup(); clearTimeout(killer);
const failed = report.filter((r) => !r.ok).length + problems.length;
const lines = [...report.map((r) => `${r.ok ? 'ĐẠT ' : 'TRƯỢT'} ${r.check}`), ...problems.map((p) => `LỖI  ${p}`)];
console.log(lines.join('\n'));
writeFileSync(join(outDir, 'browser-check.txt'), `${lines.join('\n')}\n\nChrome: ${CHROME}\nGPU: ${process.env.GPU ? 'real GPU (default ANGLE backend)' : 'software (SwiftShader), so FPS here is a lower bound'}.\n`);
process.exit(failed ? 1 : 0);
