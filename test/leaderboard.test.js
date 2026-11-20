// Ticket-04 section 3: local leaderboard (rules, disk persistence across restarts, export command).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { makeEntry, addEntry, sortEntries, validateName, isoWithOffset, parseStored, LeaderboardError, TOP_N } from '../src/leaderboard.js';

const SERVER = resolve('server.js');
const at = (min) => new Date(Date.UTC(2026, 10, 20, 8, min, 0));
const mk = (name, score, min, nights = 1) => makeEntry({ name, score, nights_won: nights, seed: 7 }, at(min));

test('name rules: 3-12 characters of letters, digits, underscore; Vietnamese accents accepted', () => {
  for (const ok of ['abc', 'Mây_Nhỏ', 'A1_b2_C3_d4e', 'Đăng123']) assert.equal(validateName(ok), ok);
  for (const bad of ['ab', 'abcdefghijklm', 'has space', 'dash-ed', 'dot.name', '', 'a\nb', 'x'.repeat(13)]) {
    assert.throws(() => validateName(bad), LeaderboardError, bad);
  }
  assert.throws(() => validateName(42), LeaderboardError);
});

test('entry fields: name, score, nights_won (0-3), achieved_at ISO 8601 with offset, seed', () => {
  const e = makeEntry({ name: 'Alice', score: 1200, nights_won: 3, seed: 5 }, new Date(2026, 10, 20, 9, 30, 15));
  assert.deepEqual(Object.keys(e), ['name', 'score', 'nights_won', 'achieved_at', 'seed']);
  assert.match(e.achieved_at, /^2026-11-20T09:30:15[+-]\d\d:\d\d$/);
  assert.equal(Date.parse(isoWithOffset(new Date(0))), 0); // the offset round-trips to the same instant
  assert.throws(() => makeEntry({ name: 'Alice', score: -1, nights_won: 0, seed: 1 }), LeaderboardError);
  assert.throws(() => makeEntry({ name: 'Alice', score: 1.5, nights_won: 0, seed: 1 }), LeaderboardError);
  assert.throws(() => makeEntry({ name: 'Alice', score: 1, nights_won: 4, seed: 1 }), LeaderboardError);
  assert.throws(() => makeEntry({ name: 'Alice', score: 1, nights_won: 1, seed: 'x' }), LeaderboardError);
  assert.equal(makeEntry({ name: 'Alice', score: 0, nights_won: 0, seed: 1 }).score, 0);
});

test('order: score descending; equal scores: whoever achieved it first is higher; top 10 only', () => {
  let list = [];
  list = addEntry(list, mk('late', 500, 30));
  list = addEntry(list, mk('best', 900, 40));
  list = addEntry(list, mk('early', 500, 10));
  list = addEntry(list, mk('same_time_a', 300, 50));
  list = addEntry(list, mk('same_time_b', 300, 50)); // identical timestamp: insertion order decides
  assert.deepEqual(list.map((e) => e.name), ['best', 'early', 'late', 'same_time_a', 'same_time_b']);
  for (let i = 0; i < 12; i++) list = addEntry(list, mk(`player${i}`, 100 + i, i));
  assert.equal(list.length, TOP_N);
  assert.deepEqual(list.slice(0, 3).map((e) => e.name), ['best', 'early', 'late']);
  assert.ok(list.every((e, i) => i === 0 || list[i - 1].score >= e.score));
  assert.ok(!list.some((e) => e.name === 'player0')); // pushed out
  assert.equal(sortEntries(list).length, TOP_N);
});

test('an entry that does not reach the top 10 is not kept', () => {
  let list = [];
  for (let i = 0; i < TOP_N; i++) list = addEntry(list, mk(`top${i}`, 1000 + i, i));
  const low = mk('lowscore', 5, 99);
  assert.ok(!addEntry(list, low).includes(low));
});

test('parseStored rejects malformed files', () => {
  assert.throws(() => parseStored({}), LeaderboardError);
  assert.throws(() => parseStored({ entries: [{ name: 'ab', score: 1, nights_won: 0, achieved_at: 'x', seed: 1 }] }), LeaderboardError);
  assert.throws(() => parseStored({ entries: [{ name: 'Alice', score: 1, nights_won: 0, achieved_at: 'not a date', seed: 1 }] }), LeaderboardError);
  assert.deepEqual(parseStored({ entries: [] }), []);
});

async function startServer(dir, port) {
  const p = spawn('node', [SERVER], { env: { ...process.env, PORT: String(port), DDL_DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, fail) => {
    p.stdout.on('data', (d) => { if (String(d).includes('http://')) ok(); });
    p.on('exit', (c) => fail(new Error(`server exited ${c}`)));
    setTimeout(() => fail(new Error('server did not start')), 8000);
  });
  return p;
}
const post = (port, body) => fetch(`http://127.0.0.1:${port}/api/leaderboard`, { method: 'POST', body: JSON.stringify(body) });

test('disk: scores survive a restart; export command prints the same ordered entries; bad requests are refused', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-lb-'));
  const port = 9100 + Math.floor(Math.random() * 400);
  let srv = await startServer(dir, port);
  try {
    assert.deepEqual(await (await fetch(`http://127.0.0.1:${port}/api/leaderboard`)).json(), { entries: [] });
    assert.equal((await post(port, { name: 'ab', score: 1, nights_won: 0, seed: 1 })).status, 400);
    assert.equal((await post(port, { name: 'Alice', score: -5, nights_won: 0, seed: 1 })).status, 400);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/leaderboard`, { method: 'POST', body: '{nope' })).status, 400);
    const r1 = await (await post(port, { name: 'Alice', score: 700, nights_won: 2, seed: 7 })).json();
    assert.equal(r1.rank, 0);
    await post(port, { name: 'Bob_99', score: 900, nights_won: 3, seed: 8 });
    const r3 = await (await post(port, { name: 'Chi', score: 700, nights_won: 1, seed: 9 })).json();
    assert.deepEqual(r3.entries.map((e) => e.name), ['Bob_99', 'Alice', 'Chi']); // tie on 700: Alice was first
  } finally { srv.kill(); }
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(existsSync(join(dir, 'leaderboard.json')));
  srv = await startServer(dir, port); // restarted: still there
  try {
    const again = await (await fetch(`http://127.0.0.1:${port}/api/leaderboard`)).json();
    assert.deepEqual(again.entries.map((e) => [e.name, e.score, e.nights_won, e.seed]), [['Bob_99', 900, 3, 8], ['Alice', 700, 2, 7], ['Chi', 700, 1, 9]]);
    assert.ok(again.entries.every((e) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/.test(e.achieved_at)));
  } finally { srv.kill(); }
  // export without starting the web server
  const out = join(dir, 'sub', 'out.json');
  const r = spawnSync('node', [SERVER, '--export-leaderboard', out], { env: { ...process.env, DDL_DATA_DIR: dir }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const exported = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(Object.keys(exported), ['entries']);
  assert.deepEqual(exported.entries.map((e) => e.name), ['Bob_99', 'Alice', 'Chi']);
  // an empty data directory exports an empty list; a corrupt file is an error, not a crash loop
  const empty = spawnSync('node', [SERVER, '--export-leaderboard', join(dir, 'e.json')], { env: { ...process.env, DDL_DATA_DIR: join(dir, 'none') }, encoding: 'utf8' });
  assert.equal(empty.status, 0); assert.deepEqual(JSON.parse(readFileSync(join(dir, 'e.json'), 'utf8')), { entries: [] });
  writeFileSync(join(dir, 'leaderboard.json'), '{"entries": "oops"}');
  const bad = spawnSync('node', [SERVER, '--export-leaderboard', join(dir, 'b.json')], { env: { ...process.env, DDL_DATA_DIR: dir }, encoding: 'utf8' });
  assert.notEqual(bad.status, 0); assert.ok(bad.stderr.length > 0);
  assert.notEqual(spawnSync('node', [SERVER, '--export-leaderboard'], { encoding: 'utf8' }).status, 0);
});
