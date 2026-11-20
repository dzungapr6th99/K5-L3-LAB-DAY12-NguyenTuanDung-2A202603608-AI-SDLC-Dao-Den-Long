// Procedural audio (Web Audio API). Everything is synthesised in code: no sample files, no licences.
let ctx = null, master = null, musicBus = null, sfxBus = null, musicTimer = null, step = 0;
let volume = 0.7;

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = volume;
}

/** Must be called from a user gesture (click / key). */
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.28; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
  } catch { ctx = null; }
}

function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = null, bus = sfxBus } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus || sfxBus);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.25, from = 2000, to = 400, at = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at, len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start(t);
}

export const sfx = {
  pick: () => { tone(880, 0.12, { type: 'triangle', vol: 0.25 }); tone(1320, 0.14, { type: 'sine', vol: 0.18, at: 0.06 }); },
  deposit: () => tone(520, 0.18, { type: 'triangle', vol: 0.25, slide: 700 }),
  light: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { type: 'sine', vol: 0.22, at: i * 0.09 })),
  pulse: () => { noise(0.5, { vol: 0.3, from: 3000, to: 300 }); tone(300, 0.45, { type: 'sine', vol: 0.3, slide: 900 }); },
  hit: () => { tone(160, 0.35, { type: 'sawtooth', vol: 0.3, slide: 60 }); noise(0.25, { vol: 0.25, from: 800, to: 120 }); },
  jump: () => tone(300, 0.16, { type: 'square', vol: 0.12, slide: 620 }),
  dash: () => noise(0.22, { vol: 0.3, from: 5000, to: 900 }),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.6, { type: 'triangle', vol: 0.25, at: i * 0.12 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.6, { type: 'sawtooth', vol: 0.15, at: i * 0.18 })),
  spawn: () => tone(90, 0.7, { type: 'sine', vol: 0.3, slide: 55 }),
  tick: () => tone(1000, 0.08, { type: 'square', vol: 0.1 }),
  charm: () => { tone(660, 0.2, { type: 'triangle', vol: 0.25 }); tone(990, 0.3, { type: 'triangle', vol: 0.2, at: 0.1 }); },
  steal: () => tone(700, 0.3, { type: 'sawtooth', vol: 0.18, slide: 200 }),
};

// Night music: a slow pentatonic arpeggio over a drone, scheduled a little ahead of time.
const SCALE = [0, 2, 4, 7, 9];
const ROOTS = [57, 53, 55, 52]; // A F G E (MIDI), one per bar
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export function startMusic() {
  if (!ctx || musicTimer) return;
  step = 0;
  const beat = 0.5;
  const schedule = () => {
    for (let i = 0; i < 4; i++, step++) {
      const bar = Math.floor(step / 8) % ROOTS.length, root = ROOTS[bar];
      const at = i * beat;
      if (step % 8 === 0) tone(mtof(root - 12), beat * 8, { type: 'sine', vol: 0.5, at, bus: musicBus });
      const n = root + 12 + SCALE[(step * 3 + bar) % SCALE.length] + (step % 5 === 0 ? 12 : 0);
      tone(mtof(n), 1.2, { type: 'triangle', vol: 0.35, at, bus: musicBus });
    }
  };
  schedule();
  musicTimer = setInterval(schedule, 4 * 0.5 * 1000);
}

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
