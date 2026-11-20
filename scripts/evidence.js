// Regenerates docs/evidence/phase3/* (Phase 2 evidence is kept in docs/evidence/phase2/ at tag phase-2): runs the real headless CLI on fixed scenarios (twice, byte-compared),
// checks each result against the ticket, and writes docs/evidence/phase3/EVIDENCE.md.   `npm run evidence`
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNING as T } from '../src/tuning.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'docs/evidence/phase3');
mkdirSync(join(dir, 'scenarios'), { recursive: true });
const empty = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], drifters: [], charms: [] };
const sc = (o = {}) => ({ ...empty, ...o });
const lit4 = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
const last = (a) => a.at(-1);
const pr = (btn, at, extra = []) => {
  const m = new Map();
  for (const f of [...extra, ...at.flatMap((t) => [{ tick: t, [btn]: true }, { tick: t + 1, [btn]: false }])]) m.set(f.tick, { ...(m.get(f.tick) ?? {}), ...f });
  return [...m.values()].sort((a, b) => a.tick - b.tick);
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

const cases = [
  { id: 'E01-pickup', req: 'Số liệu: nhặt ≤ 1.0 m, sức chứa 10', night: 1, ticks: 3,
    sc: sc({ motes: Array.from({ length: 12 }, (_, i) => [0, 0, 0.05 * i]) }),
    ok: (r) => r.ev('mote_picked').length === 10 && last(r.snaps).motes_active === 2 },
  { id: 'E02-first-light', req: 'Ticket-03: đèn đầu tiên cần 10 đom đóm, +5/đom đóm +100; KHÔNG còn thắng sớm khi đủ đèn', night: 1, ticks: 600,
    sc: sc({ player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L1' }, ...lit4], time_left_s: 100 }), frames: pr('interact', [0]),
    ok: (r) => r.end.state === 'playing' && r.ev('lantern_lit')[0].data.relight === false && r.snap(10).score === 150 && r.ev('game_over').length === 0 },
  { id: 'E03-pulse', req: 'Tỏa Sáng: 3 đom đóm, 3D ≤ 5 m, choáng 120 tick, đẩy 4 m, +5/con', night: 1, ticks: 125, every: 1,
    sc: sc({ player: { carried: 10 }, shades: [{ id: 'S1', pos: [3, 1, 0] }, { id: 'S2', pos: [5.01, 0.8, 0] }] }), frames: pr('pulse', [0]),
    ok: (r) => r.ev('pulse')[0].data.stunned_ids.join() === 'S1' && near(r.snap(15).shades[0].pos[0], 7, 0.01) && r.snap(120).shades[0].state === 'stunned' && r.snap(121).shades[0].state !== 'stunned' && r.snap(1).score === 5 },
  { id: 'E04-hit', req: 'Bị đánh: −1 ngọn lửa, rơi floor(n/2) đom đóm, bất tử 90 tick, lùi 2 m', night: 1, ticks: 70, every: 1,
    sc: sc({ player: { carried: 5 }, shades: [{ pos: [1, 1, 0], state: 'chase' }] }),
    ok: (r) => r.ev('player_hit')[0].data.dropped === 2 && r.snap(1).player.invuln === 1.5 && r.snap(1).shades[0].state === 'recoil' && r.snap(1).motes.length === 2 },
  { id: 'E05-dawn', req: 'Hết giờ: thua (dawn)', night: 1, ticks: 1000, sc: sc({ time_left_s: 2 }),
    ok: (r) => r.end.state === 'lost' && last(r.events).data.reason === 'dawn' && r.end.ticks === 120 },
  { id: 'E06-safe-zone', req: 'Vùng an toàn 6 m chặn Bóng Mực', night: 1, ticks: 300, every: 1,
    sc: sc({ player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [12, 1, 25] }] }),
    ok: (r) => r.snaps.every((s) => d2(s.shades[0].pos, [0, 0, 25]) >= 5.99) },
  { id: 'E07-fall', req: 'Rơi khỏi đảo (Y < −10): 1 lần, mất hết đom đóm, chờ 60 tick, hồi sinh bất tử 90 tick', night: 1, ticks: 300, every: 1,
    sc: sc({ player: { pos: [39.9, 0, 0], carried: 5 } }), frames: [{ tick: 0, move: [1, 0] }, { tick: 10, move: [0, 0] }],
    ok: (r) => { const f = r.ev('player_hit'); const F = f[0].tick; return f.length === 1 && f[0].data.lost === 5 && d2(r.snap(F + 60).player.pos, [0, 0, 0]) < 1e-9 && r.snap(F + 60).player.invuln === 1.5; } },
  { id: 'E08-dash', req: 'Lướt: 14 m/s, 0.2 s, hồi chiêu 1.5 s từ lúc bắt đầu', night: 1, ticks: 100, every: 1,
    sc: sc(), frames: pr('dash', [0, 89], [{ tick: 0, move: [0, 1] }]),
    ok: (r) => near(r.snap(12).player.pos[2], 2.8, 0.01) && r.ev('dash').map((e) => e.tick).join() === '1' }, // 2nd press at tick 90 is still cooling down
  { id: 'E09-night2-bridge', req: 'Đêm 2: hai đảo + cầu tre không lan can, 6 đèn, 270 s (Ticket-03)', night: 2, ticks: 800, every: 50,
    sc: sc(), frames: [{ tick: 0, move: [1, 0] }],
    ok: (r) => r.snaps[0].lanterns.length === 6 && r.snaps[0].time_left_s === 270 && r.ev('player_hit').length === 0 && near(last(r.snaps).player.pos[0], 80, 0.01) },
  { id: 'E10-night2-pad', req: 'Đêm 2: bục nhảy vy 14 / 24 m/s bay sang đảo kia', night: 2, ticks: 120, every: 1,
    sc: sc({ player: { pos: [20, 0, 18] } }),
    ok: (r) => { const l = r.snaps.find((s) => s.tick > 10 && s.player.grounded); return l && d2(l.player.pos, [70, 0, 0]) < 28 && l.tick >= 84 && l.tick <= 90; } },
  { id: 'E11-night3-ramp', req: 'Đêm 3: leo dốc 30° lên tầng 1 (Y=3), 7 đèn, 300 s (Ticket-03)', night: 3, ticks: 160, every: 1,
    sc: sc({ player: { pos: [32 * Math.cos(Math.PI / 6), 0, 32 * Math.sin(Math.PI / 6)] } }), frames: [{ tick: 0, move: [-Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6)] }],
    ok: (r) => last(r.snaps).player.pos[1] === 3 && last(r.snaps).player.grounded && r.snaps[0].lanterns.length === 7 && r.snaps[0].time_left_s === 300 },
  { id: 'E12-night3-cliff-pad', req: 'Đêm 3: vách đứng chặn đi lên; bục nhảy (0,3,13) đáp lên tầng 2', night: 3, ticks: 90, every: 1,
    sc: sc({ player: { pos: [0, 3, 13] } }),
    ok: (r) => { const l = r.snaps.find((s) => s.tick > 5 && s.player.grounded); return l && l.player.pos[1] === 6 && Math.hypot(l.player.pos[0], l.player.pos[2]) < 8; } },
  { id: 'E13-wind', req: 'Đêm 3: gió 5 s mỗi 30 s đẩy 2 m/s, snapshot wind', night: 3, ticks: 2200, every: 1,
    sc: sc({ wind_enabled: true }),
    ok: (r) => !r.snap(1799).wind.active && r.snap(1800).wind.active && r.snap(2099).wind.active && !r.snap(2100).wind.active },
  { id: 'E14-drifter-steal', req: 'Gió Lạc: đuổi khi mang ≥ 5, cướp min(3, n) một lần, bay đi 240 tick', night: 2, ticks: 400, every: 1,
    sc: sc({ drifters: [{ id: 'D1', pos: [10, 1.5, 0] }], player: { carried: 6 } }),
    ok: (r) => { const s = r.ev('drifter_steal'); return s.length === 1 && s[0].data.amount === 3 && s[0].data.carried === 3 && r.snap(s[0].tick + 240).drifters.length === 0; } },
  { id: 'E15-drifter-pulse', req: 'Tỏa Sáng trúng Gió Lạc: chase → flee không cướp; flee mang đồ → thả hết', night: 2, ticks: 130, every: 1,
    sc: sc({ drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3, state_ticks_left: 200 }], player: { carried: 3 } }), frames: pr('pulse', [0]),
    ok: (r) => r.ev('drifter_drop')[0].data.amount === 3 && r.snap(1).motes.filter((m) => m.kind === 'dropped').length === 3 && r.snap(119).drifters.length === 1 && r.snap(120).drifters.length === 0 },
  { id: 'E16-charm', req: 'Bùa Gió: 600 tick, chạy 7.2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 tick', night: 2, ticks: 2800, every: 1,
    sc: { ...sc(), charms: undefined, player: { pos: [35, 0, 0] } }, frames: [{ tick: 4, move: [1, 0] }, { tick: 20, move: [0, 0] }],
    ok: (r) => r.ev('charm_picked')[0].data.charm_ticks === 600 && r.snap(2700).charms[0].available === false && r.snap(2701).charms[0].available === true },
  { id: 'E17-pause', req: 'Tạm dừng: tick chạy, sim_tick/thời gian/spawn đứng yên, snapshot "paused"', night: 1, ticks: 40, every: 1,
    sc: sc({ time_left_s: 100 }), frames: [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 20, pause: true }, { tick: 21, pause: false }],
    ok: (r) => r.snap(15).state === 'paused' && r.snap(15).sim_tick === 10 && r.snap(20).time_left_s === r.snap(10).time_left_s && last(r.snaps).sim_tick === 30 && r.end.ticks === 40 },
  // ---- Ticket-03 "Đèn cạn dầu" ----
  { id: 'F01-fuel-burn', req: 'Nhiên liệu: đèn sáng = 100, hao 1/s; đèn tối fuel 0; snapshot có fuel, ever_lit, relit_count', night: 1, ticks: 600, every: 60,
    sc: sc({ lanterns: [{ id: 'L1', lit: true }] }),
    ok: (r) => r.snaps[0].lanterns[0].fuel === 100 && r.snap(600).lanterns[0].fuel === 90 && r.snaps[0].lanterns[1].fuel === 0 },
  { id: 'F02-refuel', req: 'Châm dầu: used = min(mang, ceil((100−fuel)/10)), +10 fuel/đom đóm, +5 điểm/đom đóm, sự kiện refuel', night: 1, ticks: 3, every: 1,
    sc: sc({ player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L1', lit: true, fuel: 55 }] }), frames: pr('interact', [0]),
    ok: (r) => r.ev('refuel')[0].data.amount === 5 && r.ev('refuel')[0].data.fuel === 100 && r.snap(1).score === 25 && r.snap(1).player.carried === 5 },
  { id: 'F03-out-relight', req: 'Hết dầu: lantern_out, deposited 0, ever_lit giữ; thắp lại chỉ cần 5 (+40, relight: true)', night: 1, ticks: 20, every: 1,
    sc: sc({ player: { pos: [0, 0, 24], carried: 5 }, lanterns: [{ id: 'L1', lit: true, fuel: 0.05, deposited: 10 }] }), frames: pr('interact', [10]),
    ok: (r) => r.ev('lantern_out')[0].tick === 3 && r.snap(3).lanterns[0].ever_lit === true && r.snap(3).lanterns[0].deposited === 0 && r.ev('lantern_lit')[0].data.relight === true && r.end.score === 25 + 40 },
  { id: 'F04-capacity', req: 'Sức chứa = 10 + 2 × lần thắp thành công (tối đa 20); đèn đặt bằng scenario không tính', night: 1, ticks: 3, every: 1,
    sc: sc({ player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L5', lit: true }] }), frames: pr('interact', [0]),
    ok: (r) => r.snap(0).player.capacity === 10 && r.snap(1).player.capacity === 12 },
  { id: 'F05-drain', req: 'Bóng Mực hút dầu: tới đèn yếu (<30), đứng yên, 5/s cộng 1/s hao, fuel_drain mỗi 60 tick, đèn tắt thì thả ra', night: 1, ticks: 330, every: 1,
    sc: sc({ player: { pos: [0, 0, -30] }, lanterns: [{ id: 'L1', lit: true, fuel: 25 }], shades: [{ id: 'S1', pos: [8, 1, 25] }] }),
    ok: (r) => { const f = r.snaps.find((s) => s.shades[0].state === 'drain'); return f && r.ev('fuel_drain').length >= 1 && r.ev('lantern_out').length === 1 && last(r.snaps).shades[0].state === 'wander'; } },
  { id: 'F06-dawn-win', req: 'Thắng khi hết giờ nếu đèn sáng ≥ ceil(0.6 × n) (Đêm 1: 3/5); lý do dawn_survived; điểm bình minh', night: 1, ticks: 100,
    sc: sc({ time_left_s: 1, lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }, { id: 'L3', lit: true }] }),
    ok: (r) => r.end.state === 'won' && r.end.ticks === 60 && last(r.events).data.reason === 'dawn_survived' && r.end.score === 3 * (50 + 99) + 3 * 50 },
  { id: 'F07-dawn-lose', req: 'Hết giờ với 2/5 đèn sáng: thua (dawn), không có điểm thưởng', night: 1, ticks: 100,
    sc: sc({ time_left_s: 1, lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }] }),
    ok: (r) => r.end.state === 'lost' && last(r.events).data.reason === 'dawn' && r.end.score === 0 },
  { id: 'F08-low-fuel-zone', req: 'Vùng an toàn cần fuel ≥ 30: đúng 30 vẫn còn, dưới 30 mất', night: 1, ticks: 100, every: 1,
    sc: sc({ player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true, fuel: 31 }], shades: [{ pos: [7, 1, 25], state: 'chase' }] }),
    ok: (r) => { for (let t = 1; t <= 60; t++) if (d2(r.snap(t).shades[0].pos, [0, 0, 25]) < 5.99) return false; return r.snap(60).lanterns[0].fuel === 30 && d2(r.snap(100).shades[0].pos, [0, 0, 25]) < 5; } },
  { id: 'F09-drain-stun', req: 'Tỏa Sáng trúng Bóng Mực đang hút dầu: tổng +15 (thường +5)', night: 1, ticks: 3, every: 1,
    sc: sc({ lanterns: [{ id: 'L1', lit: true, fuel: 20 }], player: { pos: [0, 0, 21], carried: 3 }, shades: [{ id: 'S1', pos: [0, 1, 25], state: 'drain', target_lantern_id: 'L1' }] }), frames: pr('pulse', [0]),
    ok: (r) => r.snap(1).score === 15 && r.snap(1).shades[0].state === 'stunned' },
  { id: 'F10-refuel-push', req: 'Châm dầu lên ≥ 30 khi bóng trong vùng 6 m: đẩy ra ≤ 30 tick, không sát thương', night: 1, ticks: 40, every: 1,
    sc: sc({ player: { pos: [0, 0, 24.5], carried: 5 }, lanterns: [{ id: 'L1', lit: true, fuel: 10 }], shades: [{ pos: [0, 1, 25.2], state: 'chase' }] }), frames: pr('interact', [0]),
    ok: (r) => r.ev('player_hit').length === 0 && d2(r.snap(30).shades[0].pos, [0, 0, 25]) >= 5.99 },
  { id: 'E18-spawn-schedule', req: 'Lịch sinh Bóng Mực: 2 con tại tick 300, rồi mỗi 480 tick (Đêm 1), tối đa 6', night: 1, ticks: 3300, every: 100,
    sc: { random_motes: false, player: { flames: 99 } },
    ok: (r) => r.ev('shade_spawned').map((e) => e.tick).join() === '300,300,780,1260,1740,2220' },
];

function cli(c, tag) {
  const out = join(dir, `${c.id}${tag}.jsonl`);
  const sf = join(dir, 'scenarios', `${c.id}.scenario.json`);
  writeFileSync(sf, JSON.stringify(c.sc, null, 1));
  const args = [join(root, 'src/headless.js'), '--seed', '42', '--night', String(c.night), '--ticks', String(c.ticks), '--out', out, '--snapshot-every', String(c.every ?? 10), '--scenario', sf];
  if (c.frames) { const f = join(dir, 'scenarios', `${c.id}.inputs.json`); writeFileSync(f, JSON.stringify({ frames: c.frames }, null, 1)); args.push('--inputs', f); }
  const p = spawnSync('node', args, { encoding: 'utf8' });
  const text = readFileSync(out, 'utf8');
  const lines = text.trim().split('\n').map((l) => JSON.parse(l));
  const snaps = lines.filter((l) => l.type === 'snapshot'), events = lines.filter((l) => l.type === 'event');
  return { status: p.status, text, snaps, events, end: last(lines), out,
    snap: (t) => snaps.find((s) => s.tick === t), ev: (n) => events.filter((e) => e.name === n) };
}

const rows = []; let failed = 0;
for (const c of cases) {
  const a = cli(c, ''), b = cli(c, '.rerun');
  let ok = false;
  try { ok = a.status === 0 && c.ok(a); } catch { ok = false; }
  const same = a.text === b.text;
  if (!ok || !same) failed++;
  rmSync(b.out, { force: true });
  rows.push(`| ${c.id} | ${c.req} | Đêm ${c.night}: \`${a.end.state}\`, ${a.end.ticks} tick, điểm ${a.end.score} | ${createHash('sha256').update(a.text).digest('hex').slice(0, 10)} | ${same ? 'giống hệt' : 'KHÁC'} | ${ok ? 'ĐẠT' : 'TRƯỢT'} |`);
}

// performance: one complete Night per map (21600 ticks max)
const perf = [];
for (const night of [1, 2, 3]) {
  const out = join(dir, `perf-night${night}.jsonl`);
  const t0 = Date.now();
  const p = spawnSync('node', [join(root, 'src/headless.js'), '--seed', '7', '--night', String(night), '--scenario', (() => { const f = join(dir, 'scenarios', 'perf.scenario.json'); writeFileSync(f, JSON.stringify({ player: { flames: 99 } })); return f; })(), '--ticks', '21600', '--out', out], { encoding: 'utf8' });
  const ms = Date.now() - t0;
  const end = JSON.parse(readFileSync(out, 'utf8').trim().split('\n').at(-1));
  rmSync(out, { force: true });
  if (p.status !== 0 || ms > 30000) failed++;
  perf.push(`| Đêm ${night} | ${end.ticks} | \`${end.state}\` | ${ms} ms | ${ms <= 30000 ? 'ĐẠT' : 'TRƯỢT'} |`);
}

let browser = '';
try { browser = readFileSync(join(root, 'docs/evidence/screens/browser-check.txt'), 'utf8'); } catch { browser = '(chưa chạy scripts/browser-check.mjs)'; }

const md = `# Bằng chứng Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2)

Sinh tự động bởi \`npm run evidence\`. Mỗi dòng: chạy CLI headless thật (\`node src/headless.js --seed 42 --night N ...\`) hai lần, so sánh từng byte, rồi kiểm tra kết quả với yêu cầu của ticket.
Output JSONL, scenario và inputs nằm trong thư mục này. Chạy lại ở tag \`phase-2\` cho cùng kết quả (sha256 giống nhau).

## Kịch bản headless

| Mã | Yêu cầu được chứng minh | Kết quả chạy | sha256 | 2 lần chạy | Đánh giá |
|---|---|---|---|---|---|
${rows.join('\n')}

## Hiệu năng headless: một Đêm đầy đủ (giới hạn của ticket: ≤ 30 s)

| Bản đồ | Số tick | Trạng thái cuối | Thời gian | Đánh giá |
|---|---|---|---|---|
${perf.join('\n')}

## Test tự động

\`npm test\`: xem \`test-output.txt\` (hồi quy Phase 1 trong \`test/core.test.js\`, Phase 2 trong \`test/phase2.test.js\`, luật mới trong \`test/phase3.test.js\`).

## Bản web trong trình duyệt thật

Sinh bởi \`scripts/browser-check.mjs\` (Chrome điều khiển qua DevTools Protocol). Ảnh chụp trong \`../screens/\`.

\`\`\`
${browser.trim()}
\`\`\`

## Chưa kiểm chứng

- Chưa có bộ test ẩn của giảng viên để đối chiếu; các chỗ đề mơ hồ nằm trong \`docs/SPEC-PHASE3.md\` (mục Giả định).
- Chưa đo FPS trên máy khác ngoài máy làm bài; chưa chơi hết một Đêm bằng tay để đánh giá độ khó.
- Âm thanh được tổng hợp bằng Web Audio, chưa nghe thử trong phiên làm bài này (headless không có loa).
`;
writeFileSync(join(dir, 'EVIDENCE.md'), md);
console.log(md.split('## Test tự động')[0]);
process.exit(failed ? 1 : 0);
