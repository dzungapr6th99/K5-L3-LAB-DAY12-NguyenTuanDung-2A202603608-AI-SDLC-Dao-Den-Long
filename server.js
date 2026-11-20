// Tiny static server for the web build: `npm start` -> http://localhost:8080
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT) || 8080;
const allowed = ['web', 'src', join('node_modules', 'three')];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css' };

createServer(async (req, res) => {
  try {
    let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (url === '/') url = '/web/index.html';
    const file = normalize(join(root, url));
    const ok = file.startsWith(root + sep) && allowed.some((d) => file.startsWith(join(root, d) + sep));
    if (!ok) { res.writeHead(404); res.end('not found'); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(port, () => console.log(`Đảo Đèn Lồng: http://localhost:${port}`));
