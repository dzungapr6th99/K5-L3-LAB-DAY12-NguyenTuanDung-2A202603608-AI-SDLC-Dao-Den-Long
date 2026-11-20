// Web client: renders the SAME deterministic sim (src/sim.js) used by the headless mode.
import * as THREE from 'three';
import { createGame, stepGame, timeLeft, TICK_RATE } from '/src/sim.js';
import { TUNING as T, WORLD as W } from '/src/tuning.js';

const $ = (id) => document.getElementById(id);
const AMBER = 0xffb84a;

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

scene.fog = new THREE.FogExp2(0x120a24, 0.04);
const ambient = new THREE.AmbientLight(0x6a5aa8, 0.5);
const moon = new THREE.DirectionalLight(0x9aa8ff, 0.5);
moon.position.set(-20, 40, -10);
scene.add(ambient, moon);

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const glow = (color, op = 1) => new THREE.MeshBasicMaterial({ color, transparent: op < 1, opacity: op });

// island + sea of clouds (decor only)
const ground = new THREE.Mesh(new THREE.CylinderGeometry(W.island_radius, W.island_radius - 3, 2, 64), std(0x3b2f55));
ground.position.y = -1;
scene.add(ground);
const grass = new THREE.Mesh(new THREE.CircleGeometry(W.island_radius - 0.3, 64), std(0x4a4a3a));
grass.rotation.x = -Math.PI / 2; grass.position.y = 0.01;
scene.add(grass);
const cloudMat = std(0xb9a8e0, { transparent: true, opacity: 0.55 });
for (let i = 0; i < 26; i++) { // fixed pseudo-random layout; purely visual
  const a = i * 2.399, r = 46 + (i % 5) * 7;
  const c = new THREE.Mesh(new THREE.SphereGeometry(5 + (i % 4) * 2, 12, 8), cloudMat);
  c.position.set(Math.sin(a) * r, -4 - (i % 3), Math.cos(a) * r);
  c.scale.y = 0.45;
  scene.add(c);
}
for (let i = 0; i < 30; i++) { // little stones
  const a = i * 5.13, r = 6 + ((i * 37) % 31);
  const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + (i % 3) * 0.2), std(0x55486f));
  s.position.set(Math.sin(a) * r, 0.1, Math.cos(a) * r);
  scene.add(s);
}

// ---------- player model ----------
const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.9, 12), std(0xd9744a));
body.position.y = 0.55;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), std(0xf2c9a0));
head.position.y = 1.2;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.38, 20), std(0xe8cf8a)); // nón lá
hat.position.y = 1.55;
const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), std(0x6b4a2a));
stick.position.set(0.45, 1.0, 0.1);
const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), glow(AMBER));
lampGlow.position.set(0.45, 0.5, 0.1);
const lampLight = new THREE.PointLight(AMBER, 6, 14, 1.6);
lampLight.position.copy(lampGlow.position);
player.add(body, head, hat, stick, lampGlow, lampLight);
scene.add(player);

const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), glow(0xffd27a, 0.7));
pulseRing.rotation.x = -Math.PI / 2; pulseRing.visible = false;
scene.add(pulseRing);

// ---------- dynamic entities (rebuilt per game) ----------
let game, lanternObjs, moteObjs, shadeObjs;
let paused = true; // true while a start/end overlay is up
const moteGeo = new THREE.SphereGeometry(0.16, 8, 6), moteHalo = new THREE.SphereGeometry(0.36, 8, 6);
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12);
const shadeMat = std(0x1b0d33, { emissive: 0x2a0f55, emissiveIntensity: 0.6 });
const stunMat = std(0x6a58a8, { emissive: 0x5a4aa0, emissiveIntensity: 0.8 });

function buildLantern(l) {
  const g = new THREE.Group();
  g.position.set(l.pos[0], 0, l.pos[2]);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3, 8), std(0x5a4030));
  pole.position.y = 1.5;
  const lampMat = std(0x3a2a20, { emissive: AMBER, emissiveIntensity: 0 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), lampMat);
  lamp.position.y = 3.4;
  const light = new THREE.PointLight(AMBER, 0, 30, 1.4);
  light.position.y = 3.4;
  const safe = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.15, T.safe_radius, 48), glow(AMBER, 0.35));
  safe.rotation.x = -Math.PI / 2; safe.position.y = 0.03; safe.visible = false;
  g.add(pole, lamp, light, safe);
  scene.add(g);
  return { g, lampMat, light, safe };
}

function clearEntities() {
  for (const o of [...(lanternObjs ?? []), ...(moteObjs?.values() ?? []), ...(shadeObjs?.values() ?? [])]) scene.remove(o.g ?? o);
}

function newGame() {
  clearEntities();
  const seed = Number(new URLSearchParams(location.search).get('seed')) || (Date.now() % 2147483647);
  game = createGame({ seed });
  lanternObjs = game.lanterns.map(buildLantern);
  moteObjs = new Map();
  shadeObjs = new Map();
  camYaw = 0;
  toast('Thắp lại 5 Đèn Lồng Lớn!');
  window.__ddl = { game, T }; // debugging / verification hook
  $('overlay').style.display = 'none';
  paused = false;
}

// ---------- input ----------
const keys = new Set();
let camYaw = 0, dragging = false;
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyR') newGame();
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('mousedown', () => { dragging = true; });
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => { if (dragging) camYaw -= e.movementX * 0.4; });

function readInput(dtFrame) {
  if (keys.has('ArrowLeft')) camYaw += 120 * dtFrame;
  if (keys.has('ArrowRight')) camYaw -= 120 * dtFrame;
  const k = (c) => (keys.has(c) ? 1 : 0);
  return {
    // camera looks along +Z at yaw 0: screen-right is -X in world space
    move: [k('KeyA') - k('KeyD'), k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown')].map((v) => Math.max(-1, Math.min(1, v))),
    camYawDeg: camYaw,
    jump: keys.has('Space'),
    interact: keys.has('KeyE'),
    pulse: keys.has('KeyF') || keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}

// ---------- HUD ----------
let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = 0; }, 1800);
}
const EVENT_TEXT = {
  mote_picked: (d) => `Nhặt đốm sáng (${d.carried}/${T.carry_capacity})`,
  deposit: (d) => `Nạp ${d.amount} ánh sáng vào ${d.lantern_id} (${d.deposited}/${T.lantern_cost})`,
  lantern_lit: (d) => `Đèn ${d.lantern_id} đã sáng!`,
  pulse: (d) => (d.stunned_ids.length ? `Xua ${d.stunned_ids.length} Bóng Mực!` : 'Tỏa sáng!'),
  shade_spawned: () => 'Một Bóng Mực mới trong sương…',
};
function handleEvents() {
  for (const e of game.events) {
    if (EVENT_TEXT[e.name]) toast(EVENT_TEXT[e.name](e.data));
    if (e.name === 'player_hit') {
      toast('Bóng Mực chạm vào Mây!');
      $('hit').style.opacity = 1; setTimeout(() => { $('hit').style.opacity = 0; }, 350);
    }
    if (e.name === 'game_over') showEnd();
  }
  game.events.length = 0;
}
function showEnd() {
  const won = game.state === 'won';
  const reason = { all_lit: 'Cả năm Đèn Lồng đã sáng.', dawn: 'Trời sáng, đèn vẫn chưa thắp đủ.', no_flames: 'Mây hết ngọn lửa.' };
  const ev = won ? 'all_lit' : (game.player.flames <= 0 ? 'no_flames' : 'dawn');
  $('card').innerHTML = `<h1>${won ? 'Đảo đã sáng!' : 'Đêm vẫn còn dài…'}</h1>
    <p>${reason[ev]}</p><p>Điểm: <b style="color:#ffb84a;font-size:26px">${game.score}</b></p>
    <button id="again">Chơi lại (R)</button>`;
  $('again').onclick = newGame;
  $('overlay').style.display = 'flex';
  paused = true;
}
function updateHud() {
  const p = game.player;
  $('flames').innerHTML = Array.from({ length: T.flames }, (_, i) => `<span class="${i < p.flames ? '' : 'off'}">♨</span>`).join('');
  const lit = game.lanterns.filter((l) => l.lit).length;
  $('lit').textContent = `${lit}/${game.lanterns.length}`;
  $('score').textContent = game.score;
  const tl = Math.max(0, Math.ceil(timeLeft(game)));
  $('time').textContent = `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`;
  $('carried').textContent = `${p.carried}/${T.carry_capacity}`;
  $('carbar').style.width = `${(p.carried / T.carry_capacity) * 100}%`;
  $('pcd').textContent = p.pulseCd > 0 ? `${(p.pulseCd / TICK_RATE).toFixed(1)}s` : (p.carried >= T.pulse_cost ? 'sẵn sàng' : 'cần ánh sáng');
}

// ---------- sync sim -> meshes ----------
function syncMap(map, items, make) {
  const seen = new Set();
  for (const it of items) {
    seen.add(it.id);
    let o = map.get(it.id);
    if (!o) { o = make(it); map.set(it.id, o); scene.add(o); }
  }
  for (const [id, o] of map) if (!seen.has(id)) { scene.remove(o); map.delete(id); }
}
const makeMote = () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(moteGeo, glow(0xfff0a0)), new THREE.Mesh(moteHalo, glow(0xffc84a, 0.25)));
  return g;
};
const makeShade = () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(shadeGeo, shadeMat));
  for (const x of [-0.28, 0.28]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), glow(0xd9b3ff));
    e.position.set(x, 0.15, 0.7);
    g.add(e);
  }
  return g;
};

function render(now) {
  const t = now / 1000, p = game.player;
  const lit = game.lanterns.filter((l) => l.lit).length;
  const f = lit / game.lanterns.length;

  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.rotation.y = p.facing;
  player.visible = !(p.invuln > 0 && Math.floor(t * 12) % 2 === 0);
  lampLight.intensity = 5 + Math.sin(t * 6) * 0.6;

  game.lanterns.forEach((l, i) => {
    const o = lanternObjs[i];
    const level = l.lit ? 1 : l.deposited / T.lantern_cost * 0.55;
    o.lampMat.emissiveIntensity = level * 2.2 * (l.lit ? 1 + Math.sin(t * 3 + i) * 0.1 : 1);
    o.light.intensity = level * (l.lit ? 90 : 30);
    o.safe.visible = l.lit;
  });

  syncMap(moteObjs, game.motes, makeMote);
  for (const m of game.motes) {
    const o = moteObjs.get(m.id);
    o.position.set(m.pos[0], 0.9 + Math.sin(t * 2 + m.pos[0]) * 0.18, m.pos[2]);
  }
  syncMap(shadeObjs, game.shades, makeShade);
  for (const s of game.shades) {
    const o = shadeObjs.get(s.id);
    const stunned = s.state === 'stunned';
    o.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + s.pos[0]) * 0.12, s.pos[2]);
    o.children[0].material = stunned ? stunMat : shadeMat;
    o.rotation.y = stunned ? t * 6 : Math.atan2(p.pos[0] - s.pos[0], p.pos[2] - s.pos[2]);
    o.scale.setScalar(stunned ? 0.8 : 1 + Math.sin(t * 5 + s.pos[2]) * 0.05);
  }

  pulseRing.visible = p.pulseFx > 0;
  if (pulseRing.visible) {
    const k = 1 - p.pulseFx / 20;
    pulseRing.position.set(p.pos[0], 0.05, p.pos[2]);
    pulseRing.scale.setScalar(T.pulse_radius * k + 0.5);
    pulseRing.material.opacity = 0.7 * (1 - k);
  }

  // the island brightens as lanterns are lit
  ambient.intensity = 0.4 + 0.9 * f;
  moon.intensity = 0.4 + 0.5 * f;
  scene.fog.density = 0.05 - 0.028 * f;
  scene.fog.color.setHSL(0.72 - 0.08 * f, 0.5, 0.06 + 0.12 * f);
  scene.background = scene.fog.color;

  const th = (camYaw * Math.PI) / 180;
  const cx = p.pos[0] - Math.sin(th) * 9, cz = p.pos[2] - Math.cos(th) * 9;
  camera.position.lerp(new THREE.Vector3(cx, p.pos[1] + 6.5, cz), 0.15);
  camera.lookAt(p.pos[0], p.pos[1] + 1.4, p.pos[2]);
  renderer.render(scene, camera);
}

// ---------- main loop (fixed 60 Hz sim, render every frame) ----------
let last = performance.now(), acc = 0;
function frame(now) {
  const dtFrame = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game.state === 'playing' && !paused) {
    acc += dtFrame;
    const input = readInput(dtFrame);
    while (acc >= 1 / TICK_RATE && game.state === 'playing') {
      stepGame(game, input);
      acc -= 1 / TICK_RATE;
      handleEvents();
    }
  } else acc = 0;
  updateHud();
  render(now);
  requestAnimationFrame(frame);
}

// ---------- start screen ----------
game = createGame({ seed: 1 });
lanternObjs = game.lanterns.map(buildLantern);
moteObjs = new Map(); shadeObjs = new Map();
$('card').innerHTML = `<h1>Đảo Đèn Lồng</h1>
  <p>Đêm nay sương đen đã nuốt hết ánh sáng của đảo. Mây phải gom đom đóm, mang về thắp lại <b>5 Đèn Lồng Lớn</b>, và tránh <b>Bóng Mực</b>.</p>
  <p><kbd>WASD</kbd> đi · <kbd>Space</kbd> nhảy · <kbd>E</kbd> nạp ánh sáng vào đèn (đứng gần) · <kbd>F</kbd> tỏa sáng xua Bóng Mực (tốn ${T.pulse_cost} ánh sáng)</p>
  <p>Đứng gần đèn đã sáng: Bóng Mực không dám vào.</p>
  <button id="go">Bắt đầu</button>`;
$('go').onclick = newGame;
addEventListener('keydown', (e) => { if (e.code === 'Enter' && $('overlay').style.display !== 'none') newGame(); });
requestAnimationFrame(frame);
if (new URLSearchParams(location.search).has('autostart')) newGame();
