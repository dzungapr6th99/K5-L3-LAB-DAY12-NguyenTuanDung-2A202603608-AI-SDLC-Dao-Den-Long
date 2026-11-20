// Web client: menu -> night intro -> play -> result -> next night -> dawn. Renders the SAME deterministic
// sim (src/sim.js) that the headless mode runs.
import * as THREE from 'three';
import { createGame, stepGame, timeLeft, capacity, TICK_RATE } from '/src/sim.js';
import { TUNING as T } from '/src/tuning.js';
import { getMap } from '/src/maps.js';
import { validateName, makeEntry, addEntry, parseStored } from '/src/leaderboard.js';
import { ACTIONS, DEFAULT_KEYS, assignKey, normalizeKeys, keyLabel } from '/src/keybinds.js';
import { buildWorld, style } from './world.js';
import { initAudio, setVolume, startMusic, stopMusic, sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// DOM writes are cached: touching the DOM every frame made the page hitch (found with the benchmark).
const hc = new Map();
const setT = (el, v) => { if (hc.get(el) !== v) { hc.set(el, v); el.textContent = v; } };
const setH = (el, v) => { if (hc.get(el) !== v) { hc.set(el, v); el.innerHTML = v; } };
const setS = (el, prop, v) => { const k = `${el.id}|${prop}`; if (hc.get(k) !== v) { hc.set(k, v); el.style.setProperty(prop, v); } };
const setC = (el, cls, on) => { const k = `${el.id}.${cls}`; if (hc.get(k) !== on) { hc.set(k, on); el.classList.toggle(cls, on); } };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- settings (persisted in the browser) ----------
const settings = { volume: 0.7, sens: 0.4, colorblind: false, reduceMotion: false, bigText: false, lastName: '', keys: { ...DEFAULT_KEYS } };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}')); } catch { /* storage blocked */ }
settings.keys = normalizeKeys(settings.keys); // missing, duplicated or reserved keys fall back to the defaults
function saveSettings() { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch { /* ignore */ } }
setVolume(settings.volume);

function refreshKeyLabels() {
  setH($('dash'), `Lướt<br>${esc(keyLabel(settings.keys.dash))}`);
  setH($('pulse'), `Tỏa sáng<br>${esc(keyLabel(settings.keys.pulse))}`);
}
function applyAccessibility() {
  style.colorblind = !!settings.colorblind; // Ticket-03: Bóng Mực #00B3FF, warning colour white with a sign
  style.reduceMotion = !!settings.reduceMotion; // Ticket-04: no camera shake, no screen flash, no blinking
  document.body.classList.toggle('cb', style.colorblind);
  document.body.classList.toggle('rm', style.reduceMotion);
  document.documentElement.style.setProperty('--ui', settings.bigText ? '1.25' : '1'); // UI text >= 18px, or x1.25
  refreshKeyLabels();
}
applyAccessibility();

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: !params.has('noaa') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

// ---------- campaign state ----------
const INTRO = {
  1: { title: 'Đêm 1 · Đảo Bến', text: 'Ông Đăng gõ tẩu vào mạn thuyền: "Đảo Bến tắt hết rồi, cháu. Thắp đèn rồi còn phải giữ cho nó cháy: dầu hao từng giây, mà Bóng Mực thì chuyên đi hút dầu. Giữ cho ít nhất ba ngọn còn sáng tới bình minh."' },
  2: { title: 'Đêm 2 · Đảo Cau', text: 'Ông Đăng chỉ về phía cầu tre: "Hai hòn đảo, một cây cầu không lan can. Gặp bục đỏ viền vàng thì cứ bước lên, nó sẽ đưa cháu bay sang bên kia. Coi chừng Gió Lạc, nó thích đom đóm."' },
  3: { title: 'Đêm 3 · Đảo Chuông', text: 'Ông Đăng ngửa cổ nhìn tháp: "Ba tầng đảo, bảy ngọn đèn. Lên bằng dốc, hoặc nhảy bục. Mười đom đóm cho đèn lần đầu, năm cho lần thắp lại. Năm ngọn còn sáng lúc bình minh là đủ. Gió sẽ nổi lên mỗi nửa phút."' },
};
const camp = { night: 1, total: 0, nightScore: 0, won: 0, seed: Number(params.get('seed')) || (Date.now() % 2147483000) };
let game = null, world = null, screen = 'menu', paused = false, pausePulse = false, camYaw = 0;
const keys = new Set();
let lastSecond = -1, capturing = null, shakeUntil = 0;
const marks = new Map(), captions = []; // newly spawned shades: edge arrows and captions

// ---------- overlay UI ----------
const overlay = $('overlay'), card = $('card');
function show(html, handlers = {}) {
  card.innerHTML = html;
  overlay.style.display = 'flex';
  for (const [id, fn] of Object.entries(handlers)) { const el = $(id); if (el) el.onclick = () => { initAudio(); fn(); }; }
  card.querySelector('button')?.focus({ preventScroll: true });
}
const hide = () => { overlay.style.display = 'none'; };

function settingsCard(back) {
  const chk = (id, on, text) => `<label class="row"><input id="${id}" type="checkbox" ${on ? 'checked' : ''}><span>${text}</span></label>`;
  show(`<h1>Cài đặt</h1>
    <label>Âm lượng <output id="vo">${Math.round(settings.volume * 100)}</output>%<input id="vol" type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}"></label>
    <label>Độ nhạy chuột <output id="so">${settings.sens.toFixed(2)}</output><input id="sens" type="range" min="10" max="100" value="${Math.round(settings.sens * 100)}"></label>
    ${chk('cb', settings.colorblind, 'Bảng màu dễ phân biệt (Bóng Mực xanh lam, cảnh báo màu trắng kèm ⚠)')}
    ${chk('rm', settings.reduceMotion, 'Giảm chuyển động (tắt rung camera, chớp màn hình và nhấp nháy)')}
    ${chk('big', settings.bigText, 'Chữ lớn (×1,25)')}
    <button id="keys" class="alt">Đổi phím</button> <button id="back">Quay lại</button>`, { back, keys: () => keysCard(back) });
  const bind = (id, key) => { $(id).onchange = (e) => { settings[key] = e.target.checked; applyAccessibility(); saveSettings(); }; };
  bind('cb', 'colorblind'); bind('rm', 'reduceMotion'); bind('big', 'bigText');
  $('vol').oninput = (e) => { settings.volume = e.target.value / 100; $('vo').textContent = e.target.value; setVolume(settings.volume); saveSettings(); };
  $('sens').oninput = (e) => { settings.sens = e.target.value / 100; $('so').textContent = settings.sens.toFixed(2); saveSettings(); };
}

// ---------- key rebinding ----------
function keysCard(back) {
  capturing = null;
  const rows = ACTIONS.map((a) => `<div class="row"><span>${a.label}</span><button class="keybtn alt" id="k-${a.id}" aria-label="Đổi phím: ${a.label}">${esc(keyLabel(settings.keys[a.id]))}</button></div>`).join('');
  show(`<h1>Đổi phím</h1>${rows}<p class="msg" id="kmsg" role="alert"></p>
    <p>Phím cố định: ← → xoay camera, R chơi lại Đêm, Enter xác nhận.</p>
    <button id="kreset" class="alt">Khôi phục mặc định</button> <button id="kback">Quay lại</button>`,
  { kreset: () => { settings.keys = { ...DEFAULT_KEYS }; saveSettings(); refreshKeyLabels(); keysCard(back); }, kback: () => { capturing = null; settingsCard(back); } });
  for (const a of ACTIONS) $(`k-${a.id}`).onclick = () => startCapture(a.id);
}
function startCapture(action) {
  const was = capturing;
  endCapture();
  if (was === action) return; // clicking the same button again cancels
  capturing = action;
  $(`k-${action}`).textContent = 'Nhấn một phím…';
  $('kmsg').textContent = '';
}
function endCapture() {
  if (!capturing) return;
  const b = $(`k-${capturing}`);
  if (b) b.textContent = keyLabel(settings.keys[capturing]);
  capturing = null;
}
function onCapture(e) {
  const action = capturing;
  const r = assignKey(settings.keys, action, e.code);
  const msg = $('kmsg');
  if (e.code === settings.keys[action]) { endCapture(); return; } // the same key: nothing changes
  if (!r.ok) {
    msg.textContent = r.reason === 'conflict'
      ? `⚠ Phím ${keyLabel(e.code)} đang dùng cho "${r.with}". Hãy đổi phím đó trước.`
      : `⚠ Phím ${keyLabel(e.code)} là phím cố định (${r.with}).`;
    endCapture(); return;
  }
  settings.keys = r.keys; saveSettings(); refreshKeyLabels();
  msg.textContent = '';
  endCapture();
}

// ---------- leaderboard (disk through the local server, browser storage as the fallback) ----------
const LS_BOARD = 'ddl-leaderboard';
function loadLocalBoard() { try { return parseStored(JSON.parse(localStorage.getItem(LS_BOARD) || '{"entries":[]}')); } catch { return []; } }
function saveLocalBoard(entries) { try { localStorage.setItem(LS_BOARD, JSON.stringify({ entries })); } catch { /* ignore */ } }
async function fetchBoard() {
  try {
    const r = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (!r.ok) throw new Error('no server');
    return { entries: (await r.json()).entries, where: 'ghi trên đĩa của máy này' };
  } catch { return { entries: loadLocalBoard(), where: 'lưu trong trình duyệt này' }; }
}
async function submitScore(name) {
  const body = { name, score: camp.total, nights_won: camp.won, seed: camp.seed };
  let r;
  try { r = await fetch('/api/leaderboard', { method: 'POST', body: JSON.stringify(body) }); } catch { r = null; }
  if (r && r.ok) { const j = await r.json(); return { rank: j.rank, where: 'đĩa' }; }
  if (r && r.status === 400) throw new Error((await r.json()).error);
  const entry = makeEntry(body); // no server (static hosting): keep it in the browser
  const entries = addEntry(loadLocalBoard(), entry);
  saveLocalBoard(entries);
  return { rank: entries.indexOf(entry), where: 'trình duyệt' };
}
let lbToken = 0;
async function leaderboardCard(back) {
  const token = ++lbToken;
  show('<h1>Bảng xếp hạng</h1><p>Đang tải…</p><button id="lbback">Quay lại</button>', { lbback: back });
  const { entries, where } = await fetchBoard();
  if (token !== lbToken) return;
  const rows = entries.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${esc(e.achieved_at.slice(0, 10))}</td></tr>`).join('');
  show(`<h1>Bảng xếp hạng</h1>
    ${entries.length ? `<table><thead><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Ngày</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>Chưa có ai trên bảng. Hãy là người đầu tiên!</p>'}
    <p style="font-size:1rem;opacity:.85">Top 10, ${where}.</p><button id="lbback">Quay lại</button>`, { lbback: back });
}
const saveFormHtml = () => `<div id="saveBox"><label for="pname">Lưu điểm: nhập tên 3–12 ký tự (chữ, số hoặc _)</label>
  <input id="pname" maxlength="12" autocomplete="off" value="${esc(settings.lastName)}"><button id="save">Lưu điểm</button><p class="msg" id="smsg" role="status"></p></div>`;
function wireSave() {
  const btn = $('save');
  if (!btn) return;
  btn.onclick = async () => {
    const name = $('pname').value.trim(), msg = $('smsg');
    try { validateName(name); } catch { msg.className = 'msg'; msg.textContent = '⚠ Tên phải gồm 3–12 ký tự: chữ, số hoặc _.'; return; }
    btn.disabled = true;
    try {
      const { rank, where } = await submitScore(name);
      settings.lastName = name; saveSettings();
      msg.className = 'msg ok';
      msg.textContent = rank >= 0 ? `Đã lưu (${where}). Hạng #${rank + 1}.` : `Đã ghi nhận (${where}), chưa vào top 10.`;
    } catch (e) { btn.disabled = false; msg.className = 'msg'; msg.textContent = `⚠ ${e.message}`; }
  };
}

// ---------- screens ----------
const keysLine = () => ['forward', 'left', 'back', 'right'].map((k) => keyLabel(settings.keys[k])).join(' ');
function menuCard() {
  screen = 'menu'; stopMusic();
  show(`<h1>Đảo Đèn Lồng</h1>
    <p>Đêm nay sương đen đã nuốt hết ánh sáng của đảo. Mây phải gom đom đóm, thắp các Đèn Lồng Lớn và <b>giữ cho đảo sáng tới bình minh</b>: đèn hao dầu mỗi giây, Bóng Mực hút dầu, và cần ít nhất 60% số đèn còn sáng khi trời sáng.</p>
    <p><kbd>${esc(keysLine())}</kbd> đi · <kbd>${esc(keyLabel(settings.keys.jump))}</kbd> nhảy · <kbd>${esc(keyLabel(settings.keys.dash))}</kbd> lướt · <kbd>${esc(keyLabel(settings.keys.interact))}</kbd> nạp đèn / châm dầu · <kbd>${esc(keyLabel(settings.keys.pulse))}</kbd> tỏa sáng · <kbd>${esc(keyLabel(settings.keys.pause))}</kbd> tạm dừng</p>
    <button id="play">Bắt đầu</button> <button id="lb" class="alt">Bảng xếp hạng</button> <button id="set" class="alt">Cài đặt</button>`,
  { play: () => { camp.total = 0; camp.won = 0; camp.seed = Number(params.get('seed')) || (Date.now() % 2147483000); introCard(1); }, lb: () => leaderboardCard(menuCard), set: () => settingsCard(menuCard) });
}

function introCard(n) {
  camp.night = n; screen = 'intro';
  loadNight(n);
  const i = INTRO[n], dur = getMap(n).duration_s;
  show(`<h1>${i.title}</h1><p class="quote">${i.text}</p><p>Thời gian: <b>${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}</b> · Số đèn: <b>${game.lanterns.length}</b></p>
    <button id="go">Vào đêm (Enter)</button>`, { go: beginNight });
}

function beginNight() { hide(); screen = 'play'; paused = false; startMusic(); }

function pauseCard() {
  show(`<h1>Tạm dừng</h1>
    <button id="res">Tiếp tục</button> <button id="again" class="alt">Chơi lại Đêm</button><br>
    <button id="set" class="alt">Cài đặt</button> <button id="menu" class="alt">Về menu</button>`,
  { res: togglePause, again: () => introCard(camp.night), set: () => settingsCard(pauseCard), menu: menuCard });
}

function togglePause() { if (screen === 'play') pausePulse = true; }

function endCard() {
  stopMusic();
  const won = game.state === 'won';
  screen = 'result';
  if (won) {
    camp.nightScore = game.score; camp.total += game.score; camp.won += 1;
    sfx.win();
    if (camp.night < 3) {
      show(`<h1>Bình minh đã tới!</h1><p>Đêm ${camp.night}: đảo vẫn sáng khi trời sáng.</p><p>Điểm đêm: <b class="gold">${game.score}</b> · Tổng: <b class="gold">${camp.total}</b></p>
        <button id="next">Đêm kế tiếp</button>`, { next: () => introCard(camp.night + 1) });
    } else {
      screen = 'dawn';
      show(`<h1>Bình Minh</h1><p>Cả ba hòn đảo còn sáng đèn khi trời sáng. Ông Đăng mỉm cười: "Cháu giữ được đảo rồi."</p>
        <p>Tổng điểm: <b class="gold big">${camp.total}</b></p>${saveFormHtml()}
        <button id="lb" class="alt">Bảng xếp hạng</button> <button id="menu">Về menu</button>`, { menu: menuCard, lb: () => leaderboardCard(menuCard) });
      wireSave();
    }
  } else {
    sfx.lose();
    const need = Math.ceil(T.win_ratio * game.lanterns.length - 1e-9);
    const why = game.player.flames <= 0 ? 'Mây hết Ngọn Lửa.' : `Trời sáng mà chỉ còn ${game.lanterns.filter((l) => l.lit).length}/${game.lanterns.length} đèn sáng (cần ít nhất ${need}).`;
    show(`<h1>Đêm vẫn còn dài…</h1><p>${why}</p><p>Điểm đêm này: <b class="gold">${game.score}</b> · Tổng đã có: <b class="gold">${camp.total}</b></p>${saveFormHtml()}
      <button id="again">Chơi lại Đêm ${camp.night}</button> <button id="menu" class="alt">Về menu</button>`,
    { again: () => introCard(camp.night), menu: menuCard });
    wireSave();
  }
}

// ---------- night setup ----------
function loadNight(n) {
  world?.dispose();
  game = createGame({ seed: camp.seed + n, night: n });
  game.cameraYaw = 0; camYaw = 0; lastSecond = -1; marks.clear(); captions.length = 0;
  world = buildWorld(scene, game);
  const p = game.player.pos;
  camera.position.set(p[0], p[1] + 6.5, p[2] - 9);
  window.__ddl = { game, camp, settings, getScreen: () => screen };
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  if (capturing) { e.preventDefault(); onCapture(e); return; }
  if (e.target instanceof HTMLInputElement && e.target.type === 'text') return; // typing a name
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  initAudio();
  if (e.code === 'Enter' && screen === 'intro' && overlay.style.display !== 'none') { beginNight(); return; }
  if (e.code === settings.keys.pause && screen === 'play') { togglePause(); return; }
  if (e.code === 'KeyR' && screen === 'play' && !paused) { introCard(camp.night); return; }
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (screen === 'play' && !paused) togglePause(); });
let dragging = false;
addEventListener('mousedown', () => { dragging = true; });
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => { if (dragging && screen === 'play' && !paused) camYaw -= e.movementX * settings.sens; });

function readInput(dt) {
  if (keys.has('ArrowLeft')) camYaw += 120 * dt;
  if (keys.has('ArrowRight')) camYaw -= 120 * dt;
  const K = settings.keys, k = (c) => (keys.has(c) ? 1 : 0);
  const input = {
    // the camera looks along +Z at yaw 0, so screen-right is world -X
    move: [k(K.left) - k(K.right), k(K.forward) - k(K.back)],
    camYawDeg: camYaw,
    jump: keys.has(K.jump),
    interact: keys.has(K.interact),
    pulse: keys.has(K.pulse),
    dash: keys.has(K.dash),
    pause: pausePulse,
  };
  game.cameraYaw = camYaw;
  return input;
}

// ---------- events -> sound + toasts + visual indicators ----------
let toastTimer = 0;
function toast(msg, danger = false) {
  const t = $('toast');
  t.textContent = (danger && style.colorblind ? '⚠ ' : '') + msg; t.style.opacity = 1; t.style.color = danger ? (style.colorblind ? '#ffffff' : '#ff5a5f') : '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = 0; }, 1700);
}
/** Where a point is relative to the camera: in words and as an arrow. */
function bearing(x, z) {
  const th = (camYaw * Math.PI) / 180, p = game.player.pos, dx = x - p[0], dz = z - p[2];
  const fwd = dx * Math.sin(th) + dz * Math.cos(th), right = -dx * Math.cos(th) + dz * Math.sin(th);
  if (Math.abs(fwd) >= Math.abs(right)) return fwd >= 0 ? ['phía trước', '↑'] : ['phía sau', '↓'];
  return right >= 0 ? ['bên phải', '→'] : ['bên trái', '←'];
}
function handleEvents() {
  for (const e of game.events) {
    const d = e.data;
    switch (e.name) {
      case 'mote_picked': sfx.pick(); break;
      case 'deposit': sfx.deposit(); toast(`Nạp ${d.amount} ánh sáng vào ${d.lantern_id} (${d.deposited}/${(() => { const l = game.lanterns.find((x) => x.id === d.lantern_id); return l.lit ? d.deposited : (l.everLit ? T.relight_cost : T.lantern_cost); })()})`); break;
      case 'lantern_lit': sfx.light(); toast(d.relight ? `Đã thắp lại đèn ${d.lantern_id}!` : `Đèn ${d.lantern_id} đã sáng!`); break;
      case 'refuel': sfx.deposit(); toast(`Châm ${d.amount} đom đóm vào ${d.lantern_id}: dầu ${d.fuel}`); break;
      case 'lantern_out': sfx.lose(); toast(`Đèn ${d.lantern_id} đã tắt!`, true); break;
      case 'fuel_drain': toast(`Bóng Mực đang hút dầu đèn ${d.lantern_id} (còn ${d.fuel})`, true); break;
      case 'pulse': sfx.pulse(); if (d.stunned_ids.length) toast(`Xua ${d.stunned_ids.length} Bóng Mực!`); break;
      case 'dash': sfx.dash(); break;
      case 'shade_spawned': {
        sfx.spawn();
        const s = game.shades.find((x) => x.id === d.id);
        const [word, glyph] = s ? bearing(s.pos[0], s.pos[2]) : ['', ''];
        toast(`Bóng Mực xuất hiện ${word} ${glyph}`.trim(), true);
        marks.set(d.id, performance.now() + 5000); // an arrow at the screen edge for 5 s
        captions.push({ text: `⚠ Bóng Mực xuất hiện ${word} ${glyph}`.trim(), until: performance.now() + 6000 });
        break;
      }
      case 'charm_picked': sfx.charm(); toast('Bùa Gió! Chạy nhanh hơn, lướt không cần chờ.'); break;
      case 'drifter_steal': sfx.steal(); toast(`Gió Lạc cướp ${d.amount} đom đóm!`, true); break;
      case 'drifter_drop': toast(`Đã đòi lại ${d.amount} đom đóm!`); break;
      case 'player_hit':
        sfx.hit(); toast(d.by === 'fall' ? 'Mây rơi khỏi đảo!' : 'Bóng Mực chạm vào Mây!', true);
        if (!settings.reduceMotion) { shakeUntil = performance.now() + 300; $('hit').style.opacity = 1; setTimeout(() => { $('hit').style.opacity = 0; }, 350); }
        break;
      case 'game_over': endCard(); break;
      case 'paused': pauseCard(); break;
      case 'resumed': hide(); break;
      default: break;
    }
  }
  game.events.length = 0;
}

// ---------- HUD ----------
const flamesEl = $('flames'), cells = $('cells');
let cellEls = [], cellCap = 0;
function buildCells(n) { cells.innerHTML = Array.from({ length: n }, () => '<i></i>').join(''); cellEls = [...cells.children]; cellCap = n; }
buildCells(T.carry_capacity);
const arrow = $('arrow'), sarrows = $('sarrows');
const sarrowEls = [];
const v3 = new THREE.Vector3();

/** Screen-edge position and rotation for a world point that is off screen, or null when it is visible. */
function edgeArrow(x, y, z) {
  v3.set(x, y, z).project(camera);
  const behind = v3.z > 1, off = behind || Math.abs(v3.x) > 0.92 || Math.abs(v3.y) > 0.88;
  if (!off) return null;
  let sx = behind ? -v3.x : v3.x, sy = behind ? -v3.y : v3.y;
  const m = Math.max(Math.abs(sx), Math.abs(sy)) || 1;
  sx /= m; sy /= m;
  return `translate(${Math.round((sx * 0.9 * 0.5 + 0.5) * innerWidth)}px, ${Math.round((-sy * 0.66 * 0.5 + 0.5) * innerHeight)}px) rotate(${(Math.atan2(-sy, sx) + Math.PI / 2).toFixed(2)}rad)`; // clear of the HUD panels
}

function updateHud() {
  const p = game.player, tl = Math.max(0, Math.ceil(timeLeft(game)));
  setH(flamesEl, Array.from({ length: T.flames }, (_, i) => `<span class="${i < p.flames ? '' : 'off'}">♨</span>`).join(''));
  const clock = $('clock');
  const warnIcon = style.colorblind ? '⚠ ' : '';
  setT(clock, `${tl <= 30 ? warnIcon : ''}${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`);
  setC(clock, 'low', tl <= 30);
  const need = Math.ceil(T.win_ratio * game.lanterns.length - 1e-9);
  setT($('lit'), `${game.lanterns.filter((l) => l.lit).length}/${game.lanterns.length} (cần ${need})`);
  setT($('score'), String(game.state === 'won' ? camp.total : camp.total + game.score)); // total already includes a won night
  setT($('nightname'), INTRO[game.night].title);
  const cap = capacity(game);
  if (cap !== cellCap) { buildCells(cap); hc.delete('carried'); } // capacity grows by 2 with every successful light (max 20)
  if (hc.get('carried') !== p.carried) { hc.set('carried', p.carried); cellEls.forEach((c, i) => c.classList.toggle('on', i < p.carried)); }
  setT($('carry'), `${p.carried}/${cap}`);
  const dashFrac = p.charm > 0 ? 0 : p.dashCd / (T.dash_cooldown_s * TICK_RATE);
  const pulseFrac = p.pulseCd / (T.pulse_cooldown_s * TICK_RATE);
  setS($('dash'), '--cd', `${Math.round(dashFrac * 360)}deg`);
  setC($('dash'), 'charm', p.charm > 0);
  setS($('pulse'), '--cd', `${Math.round(pulseFrac * 360)}deg`);
  setC($('pulse'), 'dim', p.carried < T.pulse_cost);
  setT($('charmt'), p.charm > 0 ? `Bùa Gió ${(p.charm / TICK_RATE).toFixed(0)}s` : '');
  setS($('windwarn'), 'opacity', game.wind.enabled && (game.wind.warn || game.wind.active) ? '1' : '0');
  setT($('windwarn'), game.wind.active ? '⚠ Gió mạnh!' : '⚠ Gió sắp nổi…');

  // visual indicators (the "subtitles" of the sound cues): last 10 s, lanterns that are nearly out, new shades
  const counting = tl <= 10 && tl > 0 && game.state === 'playing' && screen === 'play';
  setT($('count'), counting ? String(tl) : '');
  setS($('count'), 'opacity', counting ? '1' : '0');
  const now = performance.now();
  while (captions.length && captions[0].until < now) captions.shift();
  const lines = captions.map((c) => c.text);
  for (const l of game.lanterns) if (l.lit && l.fuel < T.low_fuel_threshold * TICK_RATE) lines.push(`⚠ Đèn ${l.id} sắp hết dầu (${Math.floor(l.fuel / TICK_RATE)})`);
  setH($('alerts'), lines.slice(-4).map((t) => `<div>${esc(t)}</div>`).join(''));
  let n = 0;
  for (const [id, until] of marks) {
    if (until < now) { marks.delete(id); continue; }
    const s = game.shades.find((x) => x.id === id);
    const tf = s && edgeArrow(s.pos[0], s.pos[1] + 0.5, s.pos[2]);
    if (!tf) continue;
    if (!sarrowEls[n]) { const el = document.createElement('div'); el.className = 'sarrow'; el.id = `sa${n}`; sarrows.appendChild(el); sarrowEls[n] = el; }
    setS(sarrowEls[n], 'opacity', '1'); setS(sarrowEls[n], 'transform', tf); n++;
  }
  for (let i = n; i < sarrowEls.length; i++) setS(sarrowEls[i], 'opacity', '0');

  // prompt near a lantern that can take motes; arrow to the nearest dark or nearly-out lantern
  let near = null, nd = Infinity, target = null, td = Infinity;
  for (const l of game.lanterns) {
    const d = Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
    if ((!l.lit || l.fuel < T.fuel_max * TICK_RATE) && d < nd) { nd = d; near = l; }
    if ((!l.lit || l.fuel < T.low_fuel_threshold * TICK_RATE) && d < td) { td = d; target = l; }
  }
  const pr = $('prompt'), ik = keyLabel(settings.keys.interact);
  if (near && nd <= T.interact_radius) {
    setT(pr, near.lit ? `${ik} — Châm dầu (${(near.fuel / TICK_RATE).toFixed(0)}/${T.fuel_max})` : `${ik} — Nạp ánh sáng (${near.deposited}/${near.everLit ? T.relight_cost : T.lantern_cost})`);
    setS(pr, 'opacity', '1');
  } else setS(pr, 'opacity', '0');

  const tf = target ? edgeArrow(target.pos[0], target.pos[1] + 3.4, target.pos[2]) : null;
  setS(arrow, 'opacity', tf ? '1' : '0');
  if (tf) setS(arrow, 'transform', tf);
  if (tl <= 10 && tl > 0 && tl !== lastSecond && screen === 'play' && !game.paused) { sfx.tick(); lastSecond = tl; }
}

// ---------- benchmark mode (?bench=1&seed=42&duration=30), driven by scripts/bench.mjs ----------
const B = { on: params.has('bench'), t0: null, prev: null, dts: [], done: false, acc: 0, last: 0 };
function startBench() {
  const seed = Number(params.get('seed')) || 42;
  world?.dispose();
  game = createGame({ seed, night: 1, bench: true });
  game.cameraYaw = 0;
  world = buildWorld(scene, game);
  renderer.setPixelRatio(1); // the benchmark is defined at 1280x720
  if (params.has('nohud')) $('hud').style.display = 'none'; // diagnostic only
  hide();
  screen = 'bench';
  window.__ddl = { game, camp, settings, getScreen: () => screen };
}
function benchFrame(now) {
  const duration = Number(params.get('duration')) || 30;
  if (B.t0 === null) {
    B.t0 = now; B.prev = now; B.last = now;
    window.__benchFirstFrameEpochMs = performance.timeOrigin + now;
  }
  const t = (now - B.t0) / 1000;
  B.acc += Math.min(0.1, (now - B.last) / 1000); B.last = now;
  for (let guard = 0; B.acc >= 1 / TICK_RATE && guard < 10; guard++) { stepGame(game, {}); B.acc -= 1 / TICK_RATE; game.events.length = 0; }
  // camera circles (0,0,0): radius 30, height 15, 15 s per revolution, counter-clockwise from above, starting at (30,15,0)
  const a = (2 * Math.PI * t) / 15;
  camera.position.set(30 * Math.cos(a), 15, 30 * Math.sin(a));
  camera.lookAt(0, 0, 0);
  updateHud();
  world.update(game, now / 1000);
  renderer.render(scene, camera);
  if (t >= 3 && t < 3 + duration) B.dts.push(now - B.prev); // the first 3 s are warm-up
  B.prev = now;
  if (t >= 3 + duration && !B.done) {
    B.done = true;
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    window.__bench = {
      dts: B.dts, firstFrameEpochMs: window.__benchFirstFrameEpochMs,
      renderer: `three.js r${THREE.REVISION} / WebGL: ${ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}`,
      shades: game.shades.length, motes: game.motes.length,
    };
  }
}

// ---------- main loop: fixed 60 Hz sim, render every frame ----------
let last = performance.now(), acc = 0, fpsFrames = 0, fpsT = last;
function frame(now) {
  if (screen === 'bench') { benchFrame(now); requestAnimationFrame(frame); return; }
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game) {
    if (screen === 'play') {
      acc += dt;
      let guard = 0;
      while (acc >= 1 / TICK_RATE && game.state === 'playing' && guard++ < 10) {
        stepGame(game, readInput(1 / TICK_RATE));
        pausePulse = false;
        acc -= 1 / TICK_RATE;
        handleEvents();
      }
      paused = game.paused;
    } else acc = 0;
    updateHud();
    const view = world.update(game, now / 1000);
    camera.position.lerp(view.camPos, 0.18);
    camera.lookAt(view.look[0], view.look[1], view.look[2]);
    const shaking = !settings.reduceMotion && performance.now() < shakeUntil;
    const ox = shaking ? (Math.random() - 0.5) * 0.5 : 0, oy = shaking ? (Math.random() - 0.5) * 0.5 : 0;
    camera.position.x += ox; camera.position.y += oy; // camera shake after a hit (off with "giảm chuyển động")
    renderer.render(scene, camera);
    camera.position.x -= ox; camera.position.y -= oy;
  }
  fpsFrames++;
  if (now - fpsT >= 1000) { window.__fps = (fpsFrames * 1000) / (now - fpsT); fpsFrames = 0; fpsT = now; }
  requestAnimationFrame(frame);
}

// ---------- boot ----------
loadNight(1);
if (B.on) startBench(); else menuCard();
const startNightParam = Number(params.get('night'));
if (!B.on && (params.has('autostart') || startNightParam)) { camp.night = startNightParam || 1; loadNight(camp.night); beginNight(); }
requestAnimationFrame(frame);
