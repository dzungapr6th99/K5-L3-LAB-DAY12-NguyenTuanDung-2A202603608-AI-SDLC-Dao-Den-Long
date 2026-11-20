// Three.js scene for a Night. Reads the sim state; never changes it.
import * as THREE from 'three';
import { TUNING as T, RULES as R } from '/src/tuning.js';
const TICK = 60;

// Standard palette from Ticket-02
export const PAL = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lampLit: 0xffb347, lampCore: 0xffe9b0, lampOff: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shade: 0x120a1a, shadeRim: 0x7a3cff, shadeStun: 0x3a3450, coat: 0xe8e2d0, scarf: 0xc8102e,
  gold: 0xf2c14e, drifter: 0x8fa3b8, danger: 0xff5a5f, text: 0xf5f1e6,
};

// Ticket-03 section 6: colour-blind palette. Shade rim/eyes #7A3CFF -> #00B3FF.
export const style = { colorblind: false };
const rimColor = () => (style.colorblind ? 0x00b3ff : PAL.shadeRim);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra });
const basic = (color, opacity = 1, additive = false) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1 || additive, opacity, depthWrite: opacity >= 1 && !additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
const DEG = Math.PI / 180;

function disc(scene, cx, cz, r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r - 2, 2, 64), [mat(PAL.sand), mat(PAL.grass), mat(PAL.sand)]);
  m.position.set(cx, -1, cz);
  scene.add(m);
}

function buildTerrain(scene, night) {
  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), mat(PAL.sea, { roughness: 1 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -12;
  scene.add(sea);
  const cloudMat = mat(0x6a7aa8, { transparent: true, opacity: 0.35 });
  const clouds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), cloudMat, 40);
  const cm = new THREE.Object3D();
  for (let i = 0; i < 40; i++) {
    const ang = i * 2.399, r = 50 + (i * 17) % 60, size = 5 + (i % 4) * 2;
    cm.position.set(Math.sin(ang) * r + (night === 2 ? 35 : 0), -7 - (i % 3), Math.cos(ang) * r);
    cm.scale.set(size, size * 0.4, size); cm.updateMatrix();
    clouds.setMatrixAt(i, cm.matrix);
  }
  scene.add(clouds);
  if (night === 1) disc(scene, 0, 0, 40);
  if (night === 2) {
    disc(scene, 0, 0, 28); disc(scene, 70, 0, 28);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), mat(PAL.wood));
    bridge.position.set(35, -0.15, 0);
    scene.add(bridge);
    for (let x = 27; x < 44; x += 1) { // planks
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 4), mat(0x3d2a1a));
      p.position.set(x, 0.01, 0);
      scene.add(p);
    }
  }
  if (night === 3) {
    disc(scene, 0, 0, 45);
    const tier = (shape, h) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 48 });
      g.rotateX(-Math.PI / 2); // shape y -> world -z, depth -> +Y
      const m = new THREE.Mesh(g, [mat(PAL.grass), mat(PAL.sand)]);
      scene.add(m);
    };
    const ring = new THREE.Shape();
    ring.absarc(0, 0, 24, Math.PI, 2 * Math.PI, false);
    ring.lineTo(12, 0);
    ring.absarc(0, 0, 12, 2 * Math.PI, Math.PI, true);
    tier(ring, 3);
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), [mat(PAL.sand), mat(PAL.grass), mat(PAL.sand)]);
    t2.position.y = 3; scene.add(t2);
    for (const a of [30, 150]) { // ramps: wedge from r=30 (y=0) up to r=24 (y=3)
      const prof = new THREE.Shape();
      prof.moveTo(24, 0); prof.lineTo(30, 0); prof.lineTo(24, 3); prof.closePath();
      const g = new THREE.ExtrudeGeometry(prof, { depth: 3, bevelEnabled: false });
      g.translate(0, 0, -1.5);
      const m = new THREE.Mesh(g, [mat(PAL.wood), mat(PAL.wood)]);
      m.rotation.y = -a * DEG;
      scene.add(m);
    }
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.3, 8, 24), mat(PAL.sand));
    tower.position.y = 10; scene.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.2, 24), mat(PAL.wood));
    roof.position.y = 15.1; scene.add(roof);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), mat(PAL.gold, { emissive: PAL.gold, emissiveIntensity: 0.4 }));
    bell.position.y = 12.5; scene.add(bell);
  }
}

function lanternObj(scene, l) {
  const g = new THREE.Group();
  g.position.set(l.pos[0], l.pos[1], l.pos[2]);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3, 8), mat(PAL.wood));
  pole.position.y = 1.5;
  const lampMat = mat(PAL.lampOff, { emissive: PAL.lampLit, emissiveIntensity: 0 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), lampMat);
  lamp.position.y = 3.4;
  const tear = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 3), basic(0x1a1626)); // torn paper, only on a dark lantern
  tear.position.set(0.3, 3.5, 0.55); tear.rotation.z = 0.5;
  const barBack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 0.16), basic(0x1b2350, 0.8));
  barBack.position.y = 4.6;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.18), basic(PAL.lampLit));
  bar.position.y = 4.6;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), basic(PAL.lampCore, 0));
  core.position.y = 3.4;
  const light = new THREE.PointLight(PAL.lampLit, 0, 36, 1.3);
  light.position.y = 3.4;
  const safe = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.15, T.safe_radius, 64), basic(PAL.lampLit, 0.35));
  safe.rotation.x = -Math.PI / 2; safe.position.y = 0.05; safe.visible = false;
  g.add(pole, lamp, tear, barBack, bar, core, light, safe);
  scene.add(g);
  return { g, lamp, lampMat, core, light, safe, tear, bar, barBack };
}

function makePlayer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.9, 12), mat(PAL.coat));
  body.position.y = 0.55;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 8, 16), mat(PAL.scarf));
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.02;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat(0xf2c9a0));
  head.position.y = 1.25;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.38, 20), mat(PAL.sand)); // nón lá
  hat.position.y = 1.62;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), mat(PAL.wood));
  stick.position.set(0.45, 1.0, 0.1);
  const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), basic(PAL.lampLit));
  lampGlow.position.set(0.45, 0.5, 0.1);
  const lampLight = new THREE.PointLight(PAL.lampLit, 6, 14, 1.6);
  lampLight.position.copy(lampGlow.position);
  g.add(body, scarf, head, hat, stick, lampGlow, lampLight);
  return { g, lampLight };
}

function makeDrifterObj() {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: PAL.drifter, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 2.6, 1, 6), m);
    r.rotation.x = Math.PI / 2; r.position.x = (i - 1.5) * 0.28;
    g.add(r);
  }
  return { g, ribbons: g.children };
}

function makeCharm() {
  const g = new THREE.Group();
  const gold = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.92, 0.05), mat(PAL.gold, { emissive: PAL.gold, emissiveIntensity: 0.5 }));
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.07), mat(PAL.scarf, { emissive: PAL.scarf, emissiveIntensity: 0.3 }));
  g.add(gold, red);
  return g;
}

export function buildWorld(scene, game) {
  const map = game.map;
  const root = new THREE.Group();
  scene.add(root);
  const addTo = { add: (o) => root.add(o) };
  buildTerrain(addTo, game.night);

  const ambient = new THREE.AmbientLight(0x8d94d8, 0.15);
  const moon = new THREE.DirectionalLight(0xaab6ff, 0.9);
  moon.position.set(-20, 40, -10);
  const sky = new THREE.HemisphereLight(0x8d94d8, 0x1b2350, 0.5); // keeps the standard ground colours readable at night
  root.add(ambient, moon, sky);

  const lanterns = game.lanterns.map((l) => lanternObj(addTo, l));
  const player = makePlayer(); root.add(player.g);
  const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), basic(PAL.moteHalo, 0.7));
  pulseRing.rotation.x = -Math.PI / 2; pulseRing.visible = false; root.add(pulseRing);

  for (const pad of map.pads) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(pad.radius, pad.radius, 0.12, 24), mat(PAL.scarf, { emissive: PAL.scarf, emissiveIntensity: 0.5 }));
    m.position.set(pad.pos[0], pad.pos[1] + 0.06, pad.pos[2]);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(pad.radius, 0.07, 6, 24), mat(PAL.gold, { emissive: PAL.gold, emissiveIntensity: 0.6 }));
    rim.rotation.x = Math.PI / 2; rim.position.copy(m.position); rim.position.y += 0.07;
    root.add(m, rim);
  }
  const charmObjs = game.charms.map((c) => { const o = makeCharm(); o.position.set(c.pos[0], c.pos[1] + 1, c.pos[2]); root.add(o); return o; });

  const drifters = new Map();
  // Motes and shades are InstancedMesh: the benchmark scene has 200 shades and 100 motes.
  const dummy = new THREE.Object3D(), tmpM = new THREE.Matrix4(), tmpC = new THREE.Color();
  const inst = (geo, material, cap) => {
    const m = new THREE.InstancedMesh(geo, material, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; root.add(m); return m;
  };
  const SH_CAP = 256, MO_CAP = 256;
  const shBody = inst(new THREE.SphereGeometry(0.8, 12, 8), mat(0xffffff, { emissive: 0x1a0a2a, emissiveIntensity: 0.6 }), SH_CAP);
  const shRim = inst(new THREE.SphereGeometry(0.95, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, transparent: true, opacity: 0.55, depthWrite: false }), SH_CAP);
  const shEye = inst(new THREE.SphereGeometry(0.1, 6, 4), basic(0xffffff), SH_CAP * 2);
  const moCore = inst(new THREE.SphereGeometry(0.16, 6, 4), basic(PAL.moteCore), MO_CAP);
  const moHalo = inst(new THREE.SphereGeometry(0.4, 6, 4), basic(PAL.moteHalo, 0.35, true), MO_CAP);
  const leaves = Array.from({ length: 40 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ color: PAL.grass, side: THREE.DoubleSide }));
    m.visible = false; m.userData.seed = i; root.add(m); return m;
  });

  const sync = (store, items, make, parent = root) => {
    const seen = new Set();
    for (const it of items) {
      seen.add(it.id);
      if (!store.has(it.id)) { const o = make(); store.set(it.id, o); parent.add(o.g ?? o); }
    }
    for (const [id, o] of store) if (!seen.has(id)) { parent.remove(o.g ?? o); store.delete(id); }
  };

  const camPos = new THREE.Vector3();
  scene.background = new THREE.Color(PAL.sky);
  scene.fog = new THREE.FogExp2(PAL.fog, 0.012);

  return {
    root,
    update(game, t) {
      const p = game.player, lit = game.lanterns.filter((l) => l.lit).length, f = lit / game.lanterns.length;
      ambient.intensity = 0.15 + 0.55 * f; // ticket formula
      moon.intensity = 0.8 + 0.3 * f;
      player.g.position.set(p.pos[0], p.pos[1], p.pos[2]);
      player.g.rotation.y = p.facing;
      player.g.visible = !(p.invuln > 0 && Math.floor(t * 12) % 2 === 0) && p.fallWait === 0;
      player.lampLight.intensity = 5 + Math.sin(t * 6) * 0.6 + (p.charm > 0 ? 2 : 0);

      game.lanterns.forEach((l, i) => {
        const o = lanterns[i];
        const need = l.everLit ? T.relight_cost : T.lantern_cost;
        const fuel = l.fuel / TICK, low = l.lit && fuel < T.low_fuel_threshold;
        const blink = low ? (Math.floor(t * 2) % 2 === 0 ? 1 : 0.2) : 1; // 1 Hz when the fuel is low
        const level = l.lit ? Math.max(0.25, fuel / T.fuel_max) * blink : (l.deposited / need) * 0.6;
        o.lampMat.color.setHex(l.lit ? PAL.lampLit : PAL.lampOff);
        o.lampMat.emissiveIntensity = level * 2.4 * (l.lit && !low ? 1 + Math.sin(t * 3 + i) * 0.1 : 1);
        o.core.material.opacity = l.lit ? 0.95 * blink : 0; o.core.material.transparent = true;
        o.light.intensity = level * (l.lit ? 110 : 30);
        o.safe.visible = l.lit && fuel >= T.low_fuel_threshold; // below 30 fuel the safe zone is gone
        o.lamp.scale.y = l.lit ? 1 : 0.8; // a dark lantern is squashed by 20% and its paper is torn
        o.lamp.position.y = l.lit ? 3.4 : 3.26;
        o.tear.visible = !l.lit;
        o.bar.visible = o.barBack.visible = l.lit;
        o.bar.scale.x = Math.max(0.001, fuel / T.fuel_max);
        o.bar.position.x = -0.75 * (1 - fuel / T.fuel_max);
        o.bar.material.color.setHex(low ? 0xffffff : PAL.lampLit);
        o.bar.visible = l.lit && (!low || blink === 1);
      });

      let mi = 0;
      for (const m of game.motes) {
        if (mi >= MO_CAP) break;
        const visible = m.ttl === null || m.ttl > 120 || Math.floor(t * 8) % 2 === 0; // dropped motes blink before they vanish
        dummy.position.set(m.pos[0], m.pos[1] + 0.9 + Math.sin(t * 2 + m.pos[0]) * 0.18, m.pos[2]);
        dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(visible ? 1 : 0.0001); dummy.updateMatrix();
        moCore.setMatrixAt(mi, dummy.matrix); moHalo.setMatrixAt(mi, dummy.matrix); mi++;
      }
      moCore.count = moHalo.count = mi;
      moCore.instanceMatrix.needsUpdate = moHalo.instanceMatrix.needsUpdate = true;

      let si = 0, ei = 0;
      const eyeHex = style.colorblind ? 0x00b3ff : 0xd9b3ff, rim = rimColor();
      for (const s of game.shades) {
        if (si >= SH_CAP) break;
        const stunned = s.state === 'stunned';
        const yaw = stunned ? t * 6 : Math.atan2(p.pos[0] - s.pos[0], p.pos[2] - s.pos[2]);
        const grow = s.state === 'spawning' ? 1 - s.ticks / R.spawning_ticks : 1;
        const k = Math.max(0.15, grow) * (stunned ? 0.85 : 1 + Math.sin(t * 5 + s.pos[2]) * 0.05);
        const sy = s.state === 'drain' ? 0.7 + Math.sin(t * 6) * 0.05 : k; // hunched over the lantern while draining
        dummy.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + s.pos[0]) * 0.12, s.pos[2]);
        dummy.rotation.set(0, yaw, 0); dummy.scale.set(k, sy, k); dummy.updateMatrix();
        shBody.setMatrixAt(si, dummy.matrix); shRim.setMatrixAt(si, dummy.matrix);
        shBody.setColorAt(si, tmpC.setHex(stunned ? PAL.shadeStun : PAL.shade));
        tmpC.setHex(rim); if (stunned) tmpC.multiplyScalar(0.35);
        shRim.setColorAt(si, tmpC);
        for (const x of [-0.28, 0.28]) {
          tmpM.makeTranslation(x, 0.15, 0.7).premultiply(dummy.matrix);
          shEye.setMatrixAt(ei, tmpM); shEye.setColorAt(ei, tmpC.setHex(eyeHex)); ei++;
        }
        si++;
      }
      shBody.count = shRim.count = si; shEye.count = ei;
      for (const m of [shBody, shRim, shEye]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
      sync(drifters, game.drifters, makeDrifterObj);
      for (const d of game.drifters) {
        const o = drifters.get(d.id);
        o.g.position.set(d.pos[0], d.pos[1] + 0.5, d.pos[2]);
        o.g.rotation.y = t * (d.state === 'idle' ? 1 : 3);
        o.ribbons.forEach((r, i) => { r.rotation.z = Math.sin(t * 8 + i) * 0.35; });
      }
      game.charms.forEach((c, i) => {
        charmObjs[i].visible = c.available;
        charmObjs[i].rotation.y = t * 2;
        charmObjs[i].position.y = c.pos[1] + 1 + Math.sin(t * 2) * 0.12;
      });

      pulseRing.visible = p.pulseFx > 0;
      if (pulseRing.visible) {
        const k = 1 - p.pulseFx / 20;
        pulseRing.position.set(p.pos[0], p.pos[1] + 0.08, p.pos[2]);
        pulseRing.scale.setScalar(T.pulse_radius * (0.2 + 0.8 * k));
        pulseRing.material.opacity = 0.7 * (1 - k);
      }

      const w = game.wind, windOn = w.enabled && (w.active || w.warn);
      leaves.forEach((m, i) => {
        m.visible = windOn;
        if (!windOn) return;
        const a = (w.dirDeg * Math.PI) / 180, s = m.userData.seed;
        const along = ((t * (w.active ? 14 : 3) + s * 3.7) % 40) - 20, across = ((s * 7.31) % 30) - 15;
        m.position.set(p.pos[0] + Math.cos(a) * along - Math.sin(a) * across, p.pos[1] + 1 + ((s * 1.9) % 5), p.pos[2] + Math.sin(a) * along + Math.cos(a) * across);
        m.rotation.set(t * 3 + s, t * 2, s);
      });

      // third-person camera
      const th = (game.cameraYaw * Math.PI) / 180;
      camPos.set(p.pos[0] - Math.sin(th) * 9, p.pos[1] + 6.5, p.pos[2] - Math.cos(th) * 9);
      return { camPos, look: [p.pos[0], p.pos[1] + 1.4, p.pos[2]] };
    },
    dispose() {
      scene.remove(root);
      root.traverse((o) => { o.geometry?.dispose?.(); });
    },
  };
}
