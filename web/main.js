// Web client: menu -> night intro -> play -> result -> next night -> dawn. Renders the SAME deterministic
// sim (src/sim.js) that the headless mode runs.
import * as THREE from 'three';
import { createGame, stepGame, timeLeft, capacity, TICK_RATE } from '/src/sim.js';
import { TUNING as T } from '/src/tuning.js';
import { getMap } from '/src/maps.js';
import { buildWorld, style } from './world.js';
import { initAudio, setVolume, startMusic, stopMusic, sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// ---------- settings (persisted) ----------
const settings = { volume: 0.7, sens: 0.4, colorblind: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}')); } catch { /* storage blocked */ }
function saveSettings() { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch { /* ignore */ } }
setVolume(settings.volume);
style.colorblind = !!settings.colorblind;
function applyPalette() { // Ticket-03: warning colour #FF5A5F -> #FFFFFF with a warning sign
  style.colorblind = !!settings.colorblind;
  document.body.classList.toggle('cb', style.colorblind);
}
applyPalette();

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
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
const camp = { night: 1, total: 0, nightScore: 0 };
let game = null, world = null, screen = 'menu', paused = false, pausePulse = false, camYaw = 0;
const keys = new Set();
let lastSecond = -1;

// ---------- overlay UI ----------
const overlay = $('overlay'), card = $('card');
function show(html, handlers = {}) {
  card.innerHTML = html;
  overlay.style.display = 'flex';
  for (const [id, fn] of Object.entries(handlers)) { const el = $(id); if (el) el.onclick = () => { initAudio(); fn(); }; }
}
const hide = () => { overlay.style.display = 'none'; };

function settingsCard(back) {
  show(`<h1>Cài đặt</h1>
    <label>Âm lượng <output id="vo">${Math.round(settings.volume * 100)}</output>%<input id="vol" type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}"></label>
    <label>Độ nhạy chuột <output id="so">${settings.sens.toFixed(2)}</output><input id="sens" type="range" min="10" max="100" value="${Math.round(settings.sens * 100)}"></label>
    <label style="display:flex;gap:10px;align-items:center"><input id="cb" type="checkbox" ${settings.colorblind ? 'checked' : ''}> Bảng màu dễ phân biệt (Bóng Mực xanh lam, cảnh báo màu trắng ⚠)</label>
    <button id="back">Quay lại</button>`, { back });
  $('cb').onchange = (e) => { settings.colorblind = e.target.checked; applyPalette(); saveSettings(); };
  $('vol').oninput = (e) => { settings.volume = e.target.value / 100; $('vo').textContent = e.target.value; setVolume(settings.volume); saveSettings(); };
  $('sens').oninput = (e) => { settings.sens = e.target.value / 100; $('so').textContent = settings.sens.toFixed(2); saveSettings(); };
}

function menuCard() {
  screen = 'menu'; stopMusic();
  show(`<h1>Đảo Đèn Lồng</h1>
    <p>Đêm nay sương đen đã nuốt hết ánh sáng của đảo. Mây phải gom đom đóm, thắp các Đèn Lồng Lớn và <b>giữ cho đảo sáng tới bình minh</b>: đèn hao dầu mỗi giây, Bóng Mực hút dầu, và cần ít nhất 60% số đèn còn sáng khi trời sáng.</p>
    <p class="keys"><kbd>WASD</kbd> đi · <kbd>Space</kbd> nhảy · <kbd>Shift</kbd> lướt · <kbd>E</kbd> nạp đèn / châm dầu · <kbd>F</kbd> tỏa sáng · <kbd>Esc</kbd>/<kbd>P</kbd> tạm dừng</p>
    <button id="play">Bắt đầu</button> <button id="set" class="alt">Cài đặt</button>`,
  { play: () => { camp.total = 0; introCard(1); }, set: () => settingsCard(menuCard) });
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
    camp.nightScore = game.score; camp.total += game.score;
    sfx.win();
    if (camp.night < 3) {
      show(`<h1>Bình minh đã tới!</h1><p>Đêm ${camp.night}: đảo vẫn sáng khi trời sáng.</p><p>Điểm đêm: <b class="gold">${game.score}</b> · Tổng: <b class="gold">${camp.total}</b></p>
        <button id="next">Đêm kế tiếp</button>`, { next: () => introCard(camp.night + 1) });
    } else {
      screen = 'dawn';
      show(`<h1>Bình Minh</h1><p>Cả ba hòn đảo còn sáng đèn khi trời sáng. Ông Đăng mỉm cười: "Cháu giữ được đảo rồi."</p>
        <p>Tổng điểm: <b class="gold big">${camp.total}</b></p><button id="menu">Về menu</button>`, { menu: menuCard });
    }
  } else {
    sfx.lose();
    const need = Math.ceil(T.win_ratio * game.lanterns.length - 1e-9);
    const why = game.player.flames <= 0 ? 'Mây hết Ngọn Lửa.' : `Trời sáng mà chỉ còn ${game.lanterns.filter((l) => l.lit).length}/${game.lanterns.length} đèn sáng (cần ít nhất ${need}).`;
    show(`<h1>Đêm vẫn còn dài…</h1><p>${why}</p><p>Điểm đêm này: <b class="gold">${game.score}</b></p>
      <button id="again">Chơi lại Đêm ${camp.night}</button> <button id="menu" class="alt">Về menu</button>`,
    { again: () => introCard(camp.night), menu: menuCard });
  }
}

// ---------- night setup ----------
function loadNight(n) {
  world?.dispose();
  const seed = Number(params.get('seed')) || (Date.now() % 2147483647);
  game = createGame({ seed, night: n });
  game.cameraYaw = 0; camYaw = 0; lastSecond = -1;
  world = buildWorld(scene, game);
  const p = game.player.pos;
  camera.position.set(p[0], p[1] + 6.5, p[2] - 9);
  window.__ddl = { game, camp, getScreen: () => screen };
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  initAudio();
  if (e.code === 'Enter' && screen === 'intro' && overlay.style.display !== 'none') { beginNight(); return; }
  if ((e.code === 'Escape' || e.code === 'KeyP') && screen === 'play') { togglePause(); return; }
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
  const k = (c) => (keys.has(c) ? 1 : 0);
  const input = {
    // the camera looks along +Z at yaw 0, so screen-right is world -X
    move: [k('KeyA') - k('KeyD'), k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown')].map((v) => Math.max(-1, Math.min(1, v))),
    camYawDeg: camYaw,
    jump: keys.has('Space'),
    interact: keys.has('KeyE'),
    pulse: keys.has('KeyF'),
    dash: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    pause: pausePulse,
  };
  game.cameraYaw = camYaw;
  return input;
}

// ---------- events -> sound + toasts ----------
let toastTimer = 0;
function toast(msg, danger = false) {
  const t = $('toast');
  t.textContent = (danger && style.colorblind ? '⚠ ' : '') + msg; t.style.opacity = 1; t.style.color = danger ? (style.colorblind ? '#ffffff' : '#ff5a5f') : '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = 0; }, 1700);
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
      case 'shade_spawned': sfx.spawn(); toast('Một Bóng Mực trồi lên từ sương…', true); break;
      case 'charm_picked': sfx.charm(); toast('Bùa Gió! Chạy nhanh hơn, lướt không cần chờ.'); break;
      case 'drifter_steal': sfx.steal(); toast(`Gió Lạc cướp ${d.amount} đom đóm!`, true); break;
      case 'drifter_drop': toast(`Đã đòi lại ${d.amount} đom đóm!`); break;
      case 'player_hit':
        sfx.hit(); toast(d.by === 'fall' ? 'Mây rơi khỏi đảo!' : 'Bóng Mực chạm vào Mây!', true);
        $('hit').style.opacity = 1; setTimeout(() => { $('hit').style.opacity = 0; }, 350); break;
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
const arrow = $('arrow');
const v3 = new THREE.Vector3();

function updateHud() {
  const p = game.player, tl = Math.max(0, Math.ceil(timeLeft(game)));
  flamesEl.innerHTML = Array.from({ length: T.flames }, (_, i) => `<span class="${i < p.flames ? '' : 'off'}">♨</span>`).join('');
  const clock = $('clock');
  const warnIcon = style.colorblind ? '⚠ ' : '';
  clock.textContent = `${tl <= 30 ? warnIcon : ''}${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`;
  clock.className = tl <= 30 ? 'low' : '';
  const need = Math.ceil(T.win_ratio * game.lanterns.length - 1e-9);
  $('lit').textContent = `${game.lanterns.filter((l) => l.lit).length}/${game.lanterns.length} (cần ${need})`;
  $('score').textContent = game.state === 'won' ? camp.total : camp.total + game.score; // total already includes a won night
  $('nightname').textContent = INTRO[game.night].title;
  const cap = capacity(game);
  if (cap !== cellCap) buildCells(cap); // capacity grows by 2 with every successful light (max 20)
  cellEls.forEach((c, i) => c.classList.toggle('on', i < p.carried));
  $('carry').textContent = `${p.carried}/${cap}`;
  const dashFrac = p.charm > 0 ? 0 : p.dashCd / (T.dash_cooldown_s * TICK_RATE);
  const pulseFrac = p.pulseCd / (T.pulse_cooldown_s * TICK_RATE);
  $('dash').style.setProperty('--cd', `${dashFrac * 360}deg`);
  $('dash').classList.toggle('charm', p.charm > 0);
  $('pulse').style.setProperty('--cd', `${pulseFrac * 360}deg`);
  $('pulse').classList.toggle('dim', p.carried < T.pulse_cost);
  $('charmt').textContent = p.charm > 0 ? `Bùa Gió ${(p.charm / TICK_RATE).toFixed(0)}s` : '';
  $('windwarn').style.opacity = game.wind.enabled && (game.wind.warn || game.wind.active) ? 1 : 0;
  $('windwarn').textContent = game.wind.active ? 'Gió mạnh!' : 'Gió sắp nổi…';

  // prompt near an unlit lantern; arrow to the nearest unlit lantern
  let near = null, nd = Infinity, target = null, td = Infinity;
  for (const l of game.lanterns) {
    const d = Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
    if ((!l.lit || l.fuel < T.fuel_max * TICK_RATE) && d < nd) { nd = d; near = l; } // can take motes
    if ((!l.lit || l.fuel < T.low_fuel_threshold * TICK_RATE) && d < td) { td = d; target = l; } // dark or nearly out: needs help
  }
  const pr = $('prompt');
  if (near && nd <= T.interact_radius) {
    pr.textContent = near.lit ? `E — Châm dầu (${(near.fuel / TICK_RATE).toFixed(0)}/${T.fuel_max})` : `E — Nạp ánh sáng (${near.deposited}/${near.everLit ? T.relight_cost : T.lantern_cost})`;
    pr.style.opacity = 1;
  } else pr.style.opacity = 0;

  arrow.style.opacity = 0;
  if (target) {
    v3.set(target.pos[0], target.pos[1] + 3.4, target.pos[2]).project(camera);
    const behind = v3.z > 1, off = behind || Math.abs(v3.x) > 0.92 || Math.abs(v3.y) > 0.88;
    if (off) {
      let x = behind ? -v3.x : v3.x, y = behind ? -v3.y : v3.y;
      const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
      x /= m; y /= m;
      const sx = (x * 0.9 * 0.5 + 0.5) * innerWidth, sy = (-y * 0.66 * 0.5 + 0.5) * innerHeight; // stays clear of the HUD panels
      arrow.style.opacity = 1;
      arrow.style.transform = `translate(${sx}px, ${sy}px) rotate(${Math.atan2(-y, x) + Math.PI / 2}rad)`;
    }
  }
  if (tl <= 10 && tl > 0 && tl !== lastSecond && screen === 'play' && !game.paused) { sfx.tick(); lastSecond = tl; }
}

// ---------- main loop: fixed 60 Hz sim, render every frame ----------
let last = performance.now(), acc = 0, fpsFrames = 0, fpsT = last;
function frame(now) {
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
    renderer.render(scene, camera);
  }
  fpsFrames++;
  if (now - fpsT >= 1000) { window.__fps = (fpsFrames * 1000) / (now - fpsT); fpsFrames = 0; fpsT = now; }
  requestAnimationFrame(frame);
}

// ---------- boot ----------
loadNight(1);
menuCard();
const startNightParam = Number(params.get('night'));
if (params.has('autostart') || startNightParam) { camp.night = startNightParam || 1; loadNight(camp.night); beginNight(); }
requestAnimationFrame(frame);
