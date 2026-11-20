// Static web server + local leaderboard on disk.
//   node server.js                              -> http://localhost:8080  (PORT=3000 to change)
//   node server.js --export-leaderboard out.json -> writes {"entries": [...]} (top 10, in order) and exits 0
// The leaderboard lives in <DDL_DATA_DIR or ./data>/leaderboard.json and survives restarts.
import { createServer } from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEntry, addEntry, parseStored, LeaderboardError } from './src/leaderboard.js';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const dataDir = resolve(process.env.DDL_DATA_DIR || join(root, 'data'));
const lbFile = join(dataDir, 'leaderboard.json');
const allowed = ['web', 'src', join('node_modules', 'three')];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css' };

function loadBoard() {
  if (!existsSync(lbFile)) return [];
  return parseStored(JSON.parse(readFileSync(lbFile, 'utf8')));
}

// --- CLI: export and exit ---
const exportAt = process.argv.indexOf('--export-leaderboard');
if (exportAt !== -1) {
  const out = process.argv[exportAt + 1];
  if (!out) { process.stderr.write('error: --export-leaderboard needs an output file\n'); process.exit(1); }
  try {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, `${JSON.stringify({ entries: loadBoard() }, null, 2)}\n`);
    process.exit(0);
  } catch (e) { process.stderr.write(`error: ${e.message}\n`); process.exit(1); }
}

const port = Number(process.env.PORT) || 8080;
let saving = Promise.resolve();

async function saveBoard(entries) {
  await mkdir(dataDir, { recursive: true });
  const tmp = `${lbFile}.tmp`;
  await writeFile(tmp, `${JSON.stringify({ entries }, null, 2)}\n`);
  await rename(tmp, lbFile); // atomic replace: a crash never leaves a half-written file
}

const readBody = (req) => new Promise((ok, fail) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > 10000) { fail(new LeaderboardError('body too large')); req.destroy(); } });
  req.on('end', () => ok(s));
  req.on('error', fail);
});
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

createServer(async (req, res) => {
  try {
    let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (url === '/api/leaderboard') {
      if (req.method === 'GET') return json(res, 200, { entries: loadBoard() });
      if (req.method === 'POST') {
        let body;
        try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'invalid JSON' }); }
        try {
          const entry = makeEntry(body);
          let rank = -1, entries;
          saving = saving.then(async () => { // serialise writes
            entries = addEntry(loadBoard(), entry);
            rank = entries.indexOf(entry);
            await saveBoard(entries);
          });
          await saving;
          return json(res, 200, { entries, rank, saved: rank !== -1 });
        } catch (e) { return json(res, e instanceof LeaderboardError ? 400 : 500, { error: e.message }); }
      }
      return json(res, 405, { error: 'method not allowed' });
    }
    if (url === '/') url = '/web/index.html';
    if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const file = normalize(join(root, url));
    const ok = file.startsWith(root + sep) && allowed.some((d) => file.startsWith(join(root, d) + sep));
    if (!ok) { res.writeHead(404); res.end('not found'); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch (e) {
    if (e instanceof LeaderboardError) return json(res, 500, { error: `leaderboard file is corrupt: ${e.message}` });
    res.writeHead(404); res.end('not found');
  }
}).listen(port, () => console.log(`Đảo Đèn Lồng: http://localhost:${port}`));
