// Regenerates docs/evidence/*: runs the real headless CLI on fixed scenarios, checks the result
// against the requirement, and writes docs/evidence/EVIDENCE.md. `npm run evidence`
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNING as T } from '../src/tuning.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'docs/evidence');
mkdirSync(join(dir, 'scenarios'), { recursive: true });
const empty = { random_motes: false, random_shades: false, motes: [], shades: [] };
const lit4 = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));

const cases = [
  { id: 'E1-pickup', req: 'Nhặt đom đóm: mote_picked, carried, điểm',
    sc: { ...empty, motes: [[0, 0, 1], [0, 0, 1.2]] }, ticks: 5,
    check: (r) => r.events.filter((e) => e.name === 'mote_picked').length === 2 && last(r.snaps).score === 2 * T.score.per_mote },
  { id: 'E2-deposit-win', req: 'Nạp đèn, thắp đèn, thắng (all_lit) + điểm thưởng',
    sc: { ...empty, player: { pos: [0, 0, 24], carried: 5, flames: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 25], deposited: 3 }, ...lit4], time_left_s: 100 },
    frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }], ticks: 10,
    check: (r) => r.end.state === 'won' && r.events.map((e) => e.name).join() === 'deposit,lantern_lit,game_over'
      && r.end.score === T.score.per_lantern + T.score.per_second_left * 99 + T.score.per_flame_left * 2 },
  { id: 'E3-pulse', req: 'Tỏa sáng xua Bóng Mực: tốn ánh sáng, stun, đẩy lùi, điểm',
    sc: { ...empty, player: { carried: 3 }, shades: [{ id: 'S1', pos: [5, 1, 0] }] },
    frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }], ticks: 10,
    check: (r) => r.events[0].name === 'pulse' && r.events[0].data.stunned_ids[0] === 'S1'
      && r.snaps[1].shades[0].state === 'stunned' && r.snaps[1].player.carried === 3 - T.pulse_cost },
  { id: 'E4-hit-lose', req: 'Bóng Mực đuổi và chạm: mất máu, thua (no_flames)',
    sc: { ...empty, player: { flames: 1 }, shades: [{ pos: [20, 1, 0] }] }, ticks: 600,
    check: (r) => r.end.state === 'lost' && last(r.events).data.reason === 'no_flames' && r.end.ticks > 60 },
  { id: 'E5-dawn', req: 'Hết giờ: thua (dawn), time_left_s = 0',
    sc: { ...empty, time_left_s: 2 }, ticks: 1000,
    check: (r) => r.end.state === 'lost' && last(r.events).data.reason === 'dawn' && r.end.ticks === 120 },
  { id: 'E6-safe-radius', req: 'Bóng Mực không vào bán kính an toàn quanh đèn đã sáng',
    sc: { ...empty, player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [12, 1, 25] }] }, ticks: 300, every: 1,
    check: (r) => r.snaps.every((s) => Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2] - 25) >= T.safe_radius - 0.01) },
  { id: 'E7-random-run', req: 'Màn thật (seed 42, đứng yên 30 s): shade/mote tự sinh, state hợp lệ',
    sc: { player: { flames: 99 } }, ticks: 1800, every: 60,
    check: (r) => r.snaps[0].motes_active === 40 && r.snaps[0].shades.length === 2 && r.end.type === 'end' },
];
const last = (a) => a.at(-1);

function cli(c, tag) {
  const out = join(dir, `${c.id}${tag}.jsonl`);
  const args = [join(root, 'src/headless.js'), '--seed', '42', '--night', '1', '--ticks', String(c.ticks), '--out', out, '--snapshot-every', String(c.every ?? 10)];
  const sf = join(dir, 'scenarios', `${c.id}.scenario.json`);
  writeFileSync(sf, JSON.stringify(c.sc, null, 1)); args.push('--scenario', sf);
  if (c.frames) { const f = join(dir, 'scenarios', `${c.id}.inputs.json`); writeFileSync(f, JSON.stringify({ frames: c.frames }, null, 1)); args.push('--inputs', f); }
  const p = spawnSync('node', args, { encoding: 'utf8' });
  const text = readFileSync(out, 'utf8');
  const lines = text.trim().split('\n').map((l) => JSON.parse(l));
  return { status: p.status, text, lines, out };
}

const rows = [];
let failed = 0;
for (const c of cases) {
  const a = cli(c, ''), b = cli(c, '.rerun');
  const r = { snaps: a.lines.filter((l) => l.type === 'snapshot'), events: a.lines.filter((l) => l.type === 'event'), end: last(a.lines) };
  const same = a.text === b.text;
  const ok = a.status === 0 && same && c.check(r);
  if (!ok) failed++;
  rows.push(`| ${c.id} | ${c.req} | \`${r.end.state}\`, ${r.end.ticks} tick, điểm ${r.end.score}, ${r.events.length} sự kiện | ${createHash('sha256').update(a.text).digest('hex').slice(0, 12)} | ${same ? 'giống hệt' : 'KHÁC'} | ${ok ? 'ĐẠT' : 'TRƯỢT'} |`);
}
// rerun files are only needed for the byte comparison
for (const c of cases) spawnSync('node', ['-e', `require('fs').rmSync(${JSON.stringify(join(dir, c.id + '.rerun.jsonl'))},{force:true})`]);

const md = `# Bằng chứng Phase 1 (sinh tự động bởi \`npm run evidence\`)

Mỗi dòng: chạy CLI headless thật (\`node src/headless.js --seed 42 ...\`) hai lần, so sánh byte, rồi kiểm tra kết quả với yêu cầu.
Output JSONL và file scenario/inputs nằm cạnh file này. Chạy lại ở tag \`phase-1\` cho cùng kết quả.

| Mã | Yêu cầu được chứng minh | Kết quả chạy | sha256 (12 ký tự) | 2 lần chạy | Đánh giá |
|---|---|---|---|---|---|
${rows.join('\n')}

Test tự động (\`npm test\`): xem \`test-output.txt\`.
Chưa có ảnh chụp màn hình/video của bản web (xem mục "Giới hạn" trong README).
`;
writeFileSync(join(dir, 'EVIDENCE.md'), md);
console.log(md);
process.exit(failed ? 1 : 0);
